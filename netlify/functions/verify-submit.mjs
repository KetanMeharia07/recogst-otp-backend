import { getStore } from '@netlify/blobs';
import { corsHeaders, jsonResponse, preflightResponse, isValidEmail, getTransporter } from './_shared.mjs';

const MAX_ATTEMPTS = 5;

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

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
  const otp = (body.otp || '').trim();
  const name = (body.name || '').trim();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();

  if (!isValidEmail(email) || !otp || !name || !message) {
    return jsonResponse(400, { success: false, error: 'missing_fields' }, origin);
  }

  const store = getStore('otp-store');
  const record = await store.get(email, { type: 'json' });

  if (!record) {
    return jsonResponse(400, { success: false, error: 'not_found' }, origin);
  }
  if (Date.now() > record.expiresAt) {
    await store.delete(email);
    return jsonResponse(400, { success: false, error: 'expired' }, origin);
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await store.delete(email);
    return jsonResponse(400, { success: false, error: 'too_many_attempts' }, origin);
  }
  if (record.otp !== otp) {
    record.attempts += 1;
    await store.setJSON(email, record);
    return jsonResponse(400, {
      success: false,
      error: 'invalid_otp',
      attemptsLeft: MAX_ATTEMPTS - record.attempts
    }, origin);
  }

  // OTP verified — one-time use, remove it immediately
  await store.delete(email);

  try {
    await getTransporter().sendMail({
      from: `RecoGST Website <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `New verified enquiry — RecoGST website (${name})`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;">
          <h2 style="color:#143a2b;">New enquiry — email verified ✔</h2>
          <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
            <tr><td style="padding:8px 0;color:#5b6b7d;width:110px;">Name</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b7d;">Email</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b7d;">Phone</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(phone) || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b7d;vertical-align:top;">Message</td><td style="padding:8px 0;">${escapeHtml(message)}</td></tr>
          </table>
        </div>
      `
    });
  } catch (err) {
    console.error('enquiry sendMail failed', err);
    return jsonResponse(502, { success: false, error: 'email_send_failed' }, origin);
  }

  return jsonResponse(200, { success: true }, origin);
};
