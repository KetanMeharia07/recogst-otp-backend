import { getStore } from '@netlify/blobs';
import { jsonResponse, preflightResponse, isValidEmail, sendEmail, FROM_ADDRESS_HELLO } from './_shared.mjs';

const MAX_ATTEMPTS = 5;
const ENQUIRY_RECIPIENT = 'recogst.contact@gmail.com';

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
    await sendEmail({
      to: ENQUIRY_RECIPIENT,
      replyTo: email,
      subject: `New verified enquiry — RecoGST website (${name})`,
      text: `New enquiry (email verified)\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\n\nMessage:\n${message}`,
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
    console.error('enquiry sendEmail failed', err);
    return jsonResponse(502, { success: false, error: 'email_send_failed' }, origin);
  }

  // Confirmation to the visitor — best-effort, doesn't fail the request if it has a hiccup
  try {
    await sendEmail({
      to: email,
      from: FROM_ADDRESS_HELLO,
      subject: `We've received your enquiry, ${name.split(' ')[0]}`,
      text: `Hi ${name},\n\nThanks for reaching out to RecoGST — we've received your message and will get in touch shortly.\n\nYour message:\n${message}\n\n— Team RecoGST`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:440px;margin:0 auto;padding:32px 28px;border:1px solid #dfe9e3;border-radius:14px;">
          <div style="width:38px;height:38px;background:#107c41;color:#fff;font-weight:800;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;margin-bottom:18px;">R</div>
          <h2 style="color:#143a2b;margin:0 0 8px;">Thanks, ${escapeHtml(name.split(' ')[0])} — we've got it!</h2>
          <p style="color:#5b6b7d;font-size:0.95rem;margin:0 0 20px;">Your enquiry has reached the RecoGST team. We usually reply within a few hours.</p>
          <div style="background:#f2f9f5;border:1px solid #dfe9e3;border-radius:10px;padding:16px 18px;margin-bottom:20px;">
            <p style="color:#5b6b7d;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 6px;">Your message</p>
            <p style="color:#22313f;font-size:0.92rem;margin:0;">${escapeHtml(message)}</p>
          </div>
          <p style="color:#5b6b7d;font-size:0.85rem;margin:0;">— Team RecoGST</p>
        </div>
      `
    });
  } catch (err) {
    console.error('visitor confirmation sendEmail failed', err);
  }

  return jsonResponse(200, { success: true }, origin);
};
