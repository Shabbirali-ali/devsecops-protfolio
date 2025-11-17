// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    includePaths: [path.join(__dirname, 'styles')],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.dev.to',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media2.dev.to',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'dev-to-uploads.s3.amazonaws.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
