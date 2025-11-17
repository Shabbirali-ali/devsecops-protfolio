import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

(async () => {
  // 👇 Debug print to confirm .env values are loaded
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_ADDRESS,
      to: process.env.EMAIL_ADDRESS,
      subject: "SMTP test",
      text: "SMTP test body"
    });
  } catch (err) {
    console.error("❌ SMTP test failed:", err);
  }
})();
