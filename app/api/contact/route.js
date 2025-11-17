import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import axios from "axios";
import https from "https";

/*
  CONTACT API (Next.js App Router)
  - Uses Zoho SMTP + Telegram Bot for contact notifications.
  - Forwards email via Zoho SMTP and posts to Telegram Bot API.
  - Includes verbose Telegram debugging, forces IPv4 and disables proxy for Telegram requests.
  - Basic input validation + simple in-memory rate limiter (demo only).
*/

/* ----------------------------- Config (env only) ---------------------------- */
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.EMAIL_ADDRESS;
const SMTP_PASS = process.env.EMAIL_PASS; // Zoho app password
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || SMTP_USER;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/* --------------------------- Validate required envs ------------------------- */
function validateSMTPEnv() {
  const missing = [];
  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_PORT) missing.push("SMTP_PORT");
  if (typeof SMTP_SECURE !== "boolean") missing.push("SMTP_SECURE");
  if (!SMTP_USER) missing.push("EMAIL_ADDRESS");
  if (!SMTP_PASS) missing.push("EMAIL_PASS");

  if (missing.length > 0) {
    console.error(`❌ Missing required SMTP env vars: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

/* ------------------------ Simple in-memory rate limiter --------------------- */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 6;
const ipRequestMap = new Map();

function rateLimit(ip) {
  const now = Date.now();
  const entry = ipRequestMap.get(ip) || { count: 0, ts: now };
  if (now - entry.ts > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.ts = now;
  } else {
    entry.count += 1;
  }
  ipRequestMap.set(ip, entry);
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

/* -------------------- Input validation & sanitization ---------------------- */
function validatePayload({ name, email, message }) {
  if (!name || !email || !message) return { ok: false, error: "Missing required fields" };
  if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string")
    return { ok: false, error: "Invalid field types" };
  if (name.length > 100 || email.length > 320 || message.length > 5000)
    return { ok: false, error: "Payload too large" };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { ok: false, error: "Invalid email" };

  const sanitize = (s) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  return { ok: true, payload: { name: sanitize(name), email: sanitize(email), message: sanitize(message) } };
}

/* ------------------------------ Create transporter -------------------------- */
let transporter;
if (validateSMTPEnv()) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  transporter.verify()
    .then(() => console.log("✅ SMTP transporter verified (Zoho connection OK)"))
    .catch(() => console.warn("⚠️ SMTP transporter warning:"));
} else {
  console.warn("⚠️ SMTP configuration incomplete. Email sending disabled.");
}

/* ---------------------------- Telegram Helper ------------------------------ */
/**
 * Sends a message to Telegram.
 * Uses an axios instance configured with:
 *  - https.Agent({ family: 4 }) to force IPv4
 *  - proxy: false to ignore HTTP_PROXY / HTTPS_PROXY envs for this request
 */
async function sendTelegramMessage(token, chat_id, text) {
  try {
    if (!token || !chat_id) {
      console.error("❌ Telegram missing token/chat_id:", { token: !!token, chat_id });
      return false;
    }

    console.log("📨 Telegram send");
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    // Force IPv4 and ignore proxy envs for reliability
    const httpsAgent = new https.Agent({ family: 4 });
    const instance = axios.create({
      httpsAgent,
      proxy: false,
      timeout: 15000,
    });

    const res = await instance.post(url, { chat_id, text, parse_mode: "HTML" });

    return !!res.data?.ok;
  } catch (err) {
    if (err?.response) {
      console.error("❌ Telegram send error - response data:", JSON.stringify(err.response.data));
      console.error("❌ Telegram send error - response status:", err.response.status);
    } else {
      console.error("❌ Telegram send error (network/timeout):", err.message || err);
    }
    return false;
  }
}

/* ----------------------------- Email Helper -------------------------------- */
function generateEmailTemplate(name, email, userMessage) {
  return `
    <div style="font-family: Arial, sans-serif; color: #222; padding: 20px;">
      <h3>New Contact Message</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <div style="margin-top:10px; border-left: 4px solid #007BFF; padding-left: 10px;">
        ${userMessage.replace(/\n/g, "<br/>")}
      </div>
      <p style="font-size:12px; color:#666; margin-top:10px;">Reply to this email to respond to the sender.</p>
    </div>`;
}

async function sendEmail(payload) {
  if (!transporter) throw new Error("SMTP transporter is not configured");
  const { name, email, message } = payload;

  const mailOptions = {
    from: `"Website Contact" <${SMTP_USER}>`,
    to: CONTACT_EMAIL,
    subject: `New message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: generateEmailTemplate(name, email, message),
    replyTo: email,
  };

  const info = await transporter.sendMail(mailOptions);
  return !!info?.messageId;
}

/* ----------------------------- Main Route Handler -------------------------- */
export async function POST(request) {
  try {
    // rate-limit by IP (support x-forwarded-for)
    const ip = request.headers.get("x-forwarded-for")?.split(",")?.[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    if (!rateLimit(ip)) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    // Ensure SMTP is configured
    if (!transporter) {
      console.error("❌ SMTP not configured properly.");
      return NextResponse.json({ success: false, error: "Mail service unavailable" }, { status: 500 });
    }

    // Validate incoming body
    const body = await request.json();
    const validation = validatePayload(body);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }
    const payload = validation.payload;

    const telegramText = `
      📨 <b>New Message</b>
      <b>Name:</b> ${payload.name}
      <b>Email:</b> ${payload.email}
      <b>Message:</b>
      ${payload.message.slice(0, 800)}
    `;

    // Send both email and Telegram in parallel
    const sendActions = [
      sendEmail(payload),
      TELEGRAM_TOKEN && TELEGRAM_CHAT_ID
        ? sendTelegramMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, telegramText)
        : Promise.resolve(false),
    ];

    const [emailResult, telegramResult] = await Promise.allSettled(sendActions);
    const emailOk = emailResult.status === "fulfilled" && !!emailResult.value;
    const telegramOk = telegramResult.status === "fulfilled" && !!telegramResult.value;

    if (emailOk && telegramOk)
      return NextResponse.json({ success: true, message: "Sent via email & Telegram" });

    if (emailOk && !telegramOk)
      return NextResponse.json({ success: true, message: "Email sent; Telegram failed" });

    if (!emailOk && telegramOk)
      return NextResponse.json({ success: true, message: "Telegram sent; email failed" });

    console.error("❌ Both channels failed:", { emailResult, telegramResult });
    return NextResponse.json({ success: false, error: "Failed to send message" }, { status: 500 });

  } catch (err) {
    console.error("🚨 Contact route error:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
