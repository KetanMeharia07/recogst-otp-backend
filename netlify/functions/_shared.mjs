import nodemailer from 'nodemailer';

// Only recogst.com (and localhost, for testing) may call these endpoints.
// Both http:// and https:// are listed because the site's SSL certificate
// hasn't finished provisioning yet — remove the http:// entries once
// "Enforce HTTPS" is available and turned on in GitHub Pages settings.
const ALLOWED_ORIGINS = new Set([
  'https://recogst.com',
  'https://www.recogst.com',
  'http://recogst.com',
  'http://www.recogst.com',
  'http://localhost:8080'
]);

export function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://recogst.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

export function jsonResponse(statusCode, body, origin) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: corsHeaders(origin)
  });
}

export function preflightResponse(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

let transporter;
export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}
