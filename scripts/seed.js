/**
 * seed.js
 * Seeds the DB with realistic multi-client WhatsApp message data
 * to demonstrate client segregation in the dashboard.
 * Run: node scripts/seed.js
 */
require('dotenv').config();
const { initDB } = require('../src/db/database');
const { saveMessage } = require('../src/db/messages');

const CLIENTS = [
  { phone: '919876543210', name: 'Test Client 1' },
  { phone: '918765432109', name: 'Test Client 2' },
  { phone: '917654321098', name: 'Test Client 3' },
  { phone: '916543210987', name: 'Test Client 4' },
  { phone: '915432109876', name: 'Test Client 5' },
  { phone: '914321098765', name: 'Test Client 6' },
  { phone: '913210987654', name: 'Test Client 7' },
  { phone: '912109876543', name: 'Test Client 8' },
  { phone: '911098765432', name: 'Test Client 9' },
  { phone: '910987654321', name: 'Test Client 10' },
];

const MESSAGES = [
  { type: 'text', bodies: [
    'Hello, I need help with my order',
    'Can you check my account status?',
    'When will my package arrive?',
    'I have a billing issue',
    'Please update my delivery address',
    'Thank you for your help!',
    'I received a damaged product',
    'Can I get a refund?',
    'What are your working hours?',
    'I want to track my shipment',
  ]},
  { type: 'image',    bodies: ['[Image]'] },
  { type: 'audio',    bodies: ['[Audio]'] },
  { type: 'document', bodies: ['[Document: invoice.pdf]'] },
];

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function randomDaysAgo(maxDays) {
  const d = new Date();
  d.setDate(d.getDate() - randomBetween(0, maxDays));
  d.setHours(randomBetween(8, 21), randomBetween(0, 59), randomBetween(0, 59));
  return d;
}

async function seed() {
  await initDB();
  console.log('\n🌱 Seeding database with multi-client WhatsApp messages...\n');

  let total = 0;

  for (const client of CLIENTS) {
    // Each client sends between 2 and 12 messages over the last 30 days
    const msgCount = randomBetween(2, 12);
    for (let i = 0; i < msgCount; i++) {
      const msgTypeData = MESSAGES[Math.random() < 0.85 ? 0 : randomBetween(1, 3)];
      const body = msgTypeData.bodies[randomBetween(0, msgTypeData.bodies.length - 1)];
      const ts = randomDaysAgo(30);

      saveMessage({
        messageId:   `wamid.seed_${client.phone}_${i}_${Date.now()}${Math.random()}`,
        senderPhone: client.phone,
        senderName:  client.name,
        messageType: msgTypeData.type,
        body,
        direction:   'inbound',
        timestamp:   Math.floor(ts.getTime() / 1000),
        wabaId:      process.env.WABA_ID || 'SEED_WABA_ID',
      });
      total++;
    }
    console.log(`  ✅ ${client.name} (${client.phone}) — ${msgCount} messages seeded`);
  }

  console.log(`\n✅ Done! Seeded ${total} messages from ${CLIENTS.length} clients.\n`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
