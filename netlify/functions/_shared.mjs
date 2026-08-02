import nodemailer from 'nodemailer';

// Only recogst.com (and localhost, for testing) may call these endpoints
const ALLOWED_ORIGINS = new Set([
  'https://recogst.com',
  'https://www.recogst.com',
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
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body)
  };
}

export function preflightResponse(origin) {
  return { statusCode: 204, headers: corsHeaders(origin), body: '' };
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
