// Only recogst.com (and localhost, for testing) may call these endpoints.
const ALLOWED_ORIGINS = new Set([
  'https://recogst.com',
  'https://www.recogst.com',
  'http://localhost:8080'
]);

const FROM_ADDRESS = 'RecoGST <otp@recogst.com>';
export const FROM_ADDRESS_HELLO = 'RecoGST <sales@recogst.com>';

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

// Sends via Resend's HTTP API, authenticated for recogst.com (SPF/DKIM verified)
export async function sendEmail({ to, subject, html, text, replyTo, from }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: from || FROM_ADDRESS,
      to: [to],
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {})
    })
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${errBody}`);
  }
  return res.json();
}
