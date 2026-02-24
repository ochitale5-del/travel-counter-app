const nodemailer = require('nodemailer');
const fs = require('fs');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || '';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  if (!host || !user) {
    console.warn('Email: SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    return null;
  }
  transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return transporter;
}

async function sendTicketEmail(to, subject, text, pdfPath) {
  const trans = getTransporter();
  if (!trans) return { ok: false, error: 'Email not configured' };
  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({ filename: require('path').basename(pdfPath), content: fs.readFileSync(pdfPath) });
  }
  try {
    await trans.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      attachments
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { sendTicketEmail, getTransporter };
