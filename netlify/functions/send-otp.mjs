import { getStore } from '@netlify/blobs';
import { jsonResponse, preflightResponse, isValidEmail, generateOtp, sendEmail } from './_shared.mjs';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds between sends to the same email

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return preflightResponse(origin);
  if (req.method !== 'POST') return jsonResponse(405, { success: false, error: 'method_not_allowed' }, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'invalid_body' }, origin);
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return jsonResponse(400, { success: false, error: 'invalid_email' }, origin);
  }

  const store = getStore('otp-store');
  const existing = await store.get(email, { type: 'json' });

  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
    return jsonResponse(429, { success: false, error: 'cooldown', waitSeconds }, origin);
  }

  const otp = generateOtp();
  const record = { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, lastSentAt: Date.now() };

  try {
    await sendEmail({
      to: email,
      subject: `Your RecoGST verification code: ${otp}`,
      text: `Your RecoGST verification code is ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px 28px;border:1px solid #dfe9e3;border-radius:14px;">
          <div style="width:38px;height:38px;background:#107c41;color:#fff;font-weight:800;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;margin-bottom:18px;">R</div>
          <h2 style="color:#143a2b;margin:0 0 8px;">Verify your email</h2>
          <p style="color:#5b6b7d;font-size:0.95rem;margin:0 0 22px;">Enter this code on the RecoGST website to confirm your enquiry:</p>
          <div style="background:#e6f4ec;color:#0b5e30;font-size:2rem;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;border-radius:10px;margin-bottom:22px;">${otp}</div>
          <p style="color:#5b6b7d;font-size:0.85rem;margin:0;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('sendEmail failed', err);
    return jsonResponse(502, { success: false, error: 'email_send_failed' }, origin);
  }

  await store.setJSON(email, record);
  return jsonResponse(200, { success: true }, origin);
};
