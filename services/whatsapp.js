// WhatsApp notifications. Configure with Twilio or WhatsApp Business API.
// Set WHATSAPP_ENABLED=1 and add credentials in .env to enable.

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886

async function sendWhatsApp(toPhone, message) {
  const enabled = process.env.WHATSAPP_ENABLED === '1';
  if (!enabled || !accountSid || !authToken) {
    console.log('[WhatsApp] Not configured. Would send to', toPhone, ':', message.slice(0, 50) + '...');
    return { ok: true, skipped: true };
  }
  const to = toPhone.replace(/^0/, '+91').replace(/\D/g, '');
  const toWa = to.length === 10 ? `whatsapp:+91${to}` : `whatsapp:${to}`;
  try {
    const client = require('twilio')(accountSid, authToken);
    await client.messages.create({
      from: whatsappFrom || 'whatsapp:+14155238886',
      to: toWa,
      body: message
    });
    return { ok: true };
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendWhatsApp };
