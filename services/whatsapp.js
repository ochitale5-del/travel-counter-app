// WhatsApp notifications: simplified to always return a wa.me URL
// (no Twilio usage). The app will redirect users to WhatsApp Web/mobile
// with a prefilled message. Attachments are not supported by wa.me URLs.

function normalizeToE164Indian(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const cleaned = '+' + raw.slice(1).replace(/\D/g, '');
    if (cleaned.length >= 11) return cleaned;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

function waMeUrl(toPhone, message) {
  const e164 = normalizeToE164Indian(toPhone);
  if (!e164) return null;
  const waNumber = e164.replace('+', '');
  return `https://wa.me/${encodeURIComponent(waNumber)}?text=${encodeURIComponent(message || '')}`;
}

// Keep the same function signature used across routes. Instead of attempting
// to call an API, always return the wa.me fallback URL so callers can redirect.
async function sendWhatsApp(toPhone, message /*, mediaUrls ignored */) {
  const url = waMeUrl(toPhone, message);
  if (!url) return { ok: false, error: 'Invalid phone number' };
  return { ok: true, skipped: true, fallbackUrl: url };
}

module.exports = { sendWhatsApp, waMeUrl, normalizeToE164Indian };
