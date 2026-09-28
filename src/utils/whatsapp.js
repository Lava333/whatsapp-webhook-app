/**
 * whatsapp.js
 * Helper utility to send WhatsApp messages via the Cloud API.
 * Used for outbound replies and for logging outbound messages to the DB.
 */
const axios = require('axios');
const { saveMessage } = require('../db/messages');

const BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * Send a text message to a WhatsApp number.
 * @param {string} to - Recipient phone number (E.164 format, no +)
 * @param {string} text - Message body
 */
async function sendTextMessage(to, text) {
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set in .env');
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // Log outbound message to DB
  const messageId = response.data?.messages?.[0]?.id;
  saveMessage({
    messageId,
    senderPhone: to,
    senderName: null,
    messageType: 'text',
    body: text,
    direction: 'outbound',
    timestamp: Math.floor(Date.now() / 1000),
    wabaId: process.env.WABA_ID,
  });

  return response.data;
}

module.exports = { sendTextMessage };
