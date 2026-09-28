/**
 * send.js
 * POST /api/send — Send a WhatsApp text message to any phone number.
 * Protected: requires login session.
 */
const express = require('express');
const router  = express.Router();
const { sendTextMessage } = require('../utils/whatsapp');

/**
 * POST /api/send
 * Body: { to: "919876543210", message: "Hello!" }
 */
router.post('/', async (req, res) => {
  const { to, message } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Both "to" and "message" are required.' });
  }

  // Sanitise phone: strip spaces, dashes, leading +
  const phone = String(to).replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  if (!/^\d{7,15}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number. Use digits only with country code e.g. 919876543210' });
  }

  const text = String(message).trim();
  if (!text || text.length > 4096) {
    return res.status(400).json({ success: false, error: 'Message must be 1–4096 characters.' });
  }

  // ── Send via WhatsApp Cloud API ──────────────────────────────
  try {
    const result = await sendTextMessage(phone, text);
    console.log(`[Send] ✅ Outbound message to ${phone}: "${text.slice(0, 60)}"`);
    return res.json({
      success: true,
      to: phone,
      messageId: result?.messages?.[0]?.id || null,
      message: text,
    });
  } catch (err) {
    const status   = err?.response?.status;
    const apiError = err?.response?.data?.error;
    const apiMsg   = apiError?.message;
    const apiCode  = apiError?.code;

    console.error(`[Send] ❌ WhatsApp API Error for ${phone}:`, {
      status,
      code: apiCode,
      message: apiMsg || err.message,
      details: apiError
    });

    let readable = apiMsg || err.message || 'Unknown error';

    // Prioritize specific Meta API error codes first
    if (apiCode === 131030) {
      readable = 'Recipient number not allowed in Sandbox mode. Add this number in Meta Developer Portal → WhatsApp → API Setup → "To" recipient list.';
    } else if (apiCode === 131047) {
      readable = '24-hour window closed. The recipient must message your WhatsApp business number first, or you must send an approved template message.';
    } else if (apiCode === 131026) {
      readable = 'Message undeliverable: The recipient number is not registered on WhatsApp or is unable to receive messages.';
    } else if (status === 401 || apiCode === 190) {
      readable = 'Access token expired or invalid. Generate a new token in Meta Developer Portal → WhatsApp → API Setup.';
    } else if (apiCode === 100 || (status === 400 && /invalid.*parameter|phone.*format/i.test(apiMsg || ''))) {
      readable = 'Invalid phone number format. Use country code + number without + or spaces, e.g. 919876543210';
    } else if (!apiMsg && err.message === 'Got unexpected null') {
      readable = 'Access token is invalid or expired. Update WHATSAPP_ACCESS_TOKEN in your .env file.';
    }

    return res.status(502).json({ success: false, error: readable });
  }
});

module.exports = router;
