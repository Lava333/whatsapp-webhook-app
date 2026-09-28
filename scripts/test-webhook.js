/**
 * test-webhook.js
 * Local test script to simulate a Meta webhook POST payload.
 * Run with: node scripts/test-webhook.js
 */
const http = require('http');

const PORT = process.env.PORT || 3001;

// Simulated Meta webhook payload — mimics a real inbound text message
const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA_TEST_ID_123',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15550001234',
              phone_number_id: 'PHONE_ID_TEST',
            },
            contacts: [
              {
                profile: { name: 'Test User' },
                wa_id: '919876543210',
              },
            ],
            messages: [
              {
                from: '919876543210',
                id: `wamid.test_${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                text: { body: 'Hello! This is a test message 👋' },
                type: 'text',
              },
            ],
          },
        },
      ],
    },
  ],
});

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/whatsapp/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log(`[Test] Sending simulated webhook POST to http://localhost:${PORT}/whatsapp/webhook`);
console.log('[Test] Payload:', JSON.parse(payload).entry[0].changes[0].value.messages[0].text.body);

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    console.log(`[Test] ✅ Response: ${res.statusCode} — ${data}`);
    console.log('[Test] Check your server logs and dashboard for the new message!');
  });
});

req.on('error', (err) => {
  console.error('[Test] ❌ Error — is the server running? Error:', err.message);
});

req.write(payload);
req.end();
