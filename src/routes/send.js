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
    const apiError = err?.response?.data?.error?.message || err.message;
    console.error(`[Send] ❌ Failed to send to ${phone}:`, apiError);
    return res.status(502).json({ success: false, error: apiError });
  }
});

module.exports = router;
