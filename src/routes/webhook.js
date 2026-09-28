/**
 * webhook.js
 * Handles WhatsApp webhook verification (GET) and message reception (POST).
 *
 * GET  /whatsapp/webhook  → Verifies the webhook with Meta
 * POST /whatsapp/webhook  → Receives incoming message events
 */
const express = require('express');
const router = express.Router();
const { saveMessage } = require('../db/messages');

// ─────────────────────────────────────────────
// GET /whatsapp/webhook
// Meta calls this to verify the webhook endpoint.
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[Webhook] Verification request — mode: ${mode}, token: ${token}`);

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log('[Webhook] ✅ Webhook verified successfully!');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] ❌ Verification failed — token mismatch or wrong mode.');
  return res.status(403).json({ error: 'Forbidden: invalid verify token' });
});

// ─────────────────────────────────────────────
// POST /whatsapp/webhook
// Meta sends message events here in real-time.
// MUST respond 200 OK quickly; do heavy work async.
// ─────────────────────────────────────────────
router.post('/', (req, res) => {
  // Respond immediately to Meta (within 5 seconds required)
  res.status(200).json({ status: 'ok' });

  try {
    const body = req.body;

    // Validate it's a WhatsApp event
    if (body.object !== 'whatsapp_business_account') {
      console.log('[Webhook] Ignoring non-WhatsApp event:', body.object);
      return;
    }

    const entries = body.entry || [];

    entries.forEach((entry) => {
      const wabaId = entry.id;
      const changes = entry.changes || [];

      changes.forEach((change) => {
        if (change.field !== 'messages') return;

        const value = change.value;
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        // Build a contacts lookup map: phone → name
        const contactMap = {};
        contacts.forEach((c) => {
          contactMap[c.wa_id] = c.profile?.name || null;
        });

        messages.forEach((msg) => {
          const messageId = msg.id;
          const senderPhone = msg.from;
          const senderName = contactMap[senderPhone] || null;
          const messageType = msg.type || 'text';
          const timestamp = parseInt(msg.timestamp, 10);

          // Extract body depending on message type
          let body = null;
          switch (messageType) {
            case 'text':
              body = msg.text?.body || null;
              break;
            case 'image':
              body = msg.image?.caption || '[Image]';
              break;
            case 'video':
              body = msg.video?.caption || '[Video]';
              break;
            case 'audio':
              body = '[Audio]';
              break;
            case 'document':
              body = msg.document?.filename || '[Document]';
              break;
            case 'sticker':
              body = '[Sticker]';
              break;
            case 'location':
              body = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
              break;
            case 'interactive':
              body = msg.interactive?.button_reply?.title
                || msg.interactive?.list_reply?.title
                || '[Interactive]';
              break;
            default:
              body = `[${messageType}]`;
          }

          console.log(`[Webhook] 📩 Message from ${senderName || senderPhone} (${messageType}): ${body}`);

          // Save to database
          try {
            saveMessage({
              messageId,
              senderPhone,
              senderName,
              messageType,
              body,
              direction: 'inbound',
              timestamp,
              wabaId,
            });
          } catch (dbErr) {
            console.error('[Webhook] DB save error:', dbErr.message);
          }
        });

        // Log delivery/read status updates (optional — not stored)
        const statuses = value.statuses || [];
        statuses.forEach((status) => {
          console.log(`[Webhook] 📬 Status update — Message ${status.id}: ${status.status} for ${status.recipient_id}`);
        });
      });
    });
  } catch (err) {
    console.error('[Webhook] ❌ Error processing payload:', err.message);
  }
});

module.exports = router;
