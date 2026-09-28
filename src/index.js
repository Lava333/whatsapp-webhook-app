/**
 * index.js
 * Main entry point with session-based authentication.
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db/database');
const { requireLogin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Trust Railway / reverse proxy (required for HTTPS) ───────
if (IS_PROD) app.set('trust proxy', 1);

// ─── Core Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Session ──────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'whatsapp_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,   // HTTPS-only cookies on Railway
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ─── Request Logger ───────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ──────────────────────────────────────────────────
function mountRoutes() {
  const webhookRouter  = require('./routes/webhook');
  const dashboardRouter = require('./routes/dashboard');
  const authRouter     = require('./routes/auth');
  const sendRouter     = require('./routes/send');

  // ── Public: WhatsApp webhook (Meta must reach this without auth)
  app.use('/whatsapp/webhook', webhookRouter);

  // ── Public: Login page & auth actions
  app.use('/login', authRouter);

  // ── Public: Logout shortcut
  app.get('/logout', (req, res) => res.redirect('/login/logout'));

  // ── Public: Login static assets (CSS, JS)
  app.use('/login-assets', express.static(path.join(__dirname, '../public/login')));

  // ── Public: Health check
  app.get('/health', (req, res) =>
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
  );

  // ── Protected: current user info
  app.get('/api/me', requireLogin, (req, res) =>
    res.json({ loggedIn: true, user: req.session.user })
  );

  // ── Protected: Analytics REST API
  app.use('/api', requireLogin, dashboardRouter);

  // ── Protected: Send WhatsApp message
  app.use('/api/send', requireLogin, sendRouter);

  // ── Protected: Dashboard UI
  app.use('/dashboard', requireLogin, express.static(path.join(__dirname, '../public/dashboard')));

  // ── Root → redirect to dashboard (auth middleware will redirect to login if needed)
  app.get('/', (req, res) => res.redirect('/dashboard'));

  // ── 404
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // ── Global error handler
  app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// ─── Start Server ─────────────────────────────────────────────
async function main() {
  try {
    console.log('[DB] Initializing sql.js database...');
    await initDB();
    mountRoutes();

    const server = app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║   WhatsApp Webhook App — Server Started          ║');
      console.log(`║   Port    : ${PORT}                                  ║`);
      console.log(`║   Login   : http://localhost:${PORT}/login           ║`);
      console.log(`║   Dashboard: http://localhost:${PORT}/dashboard      ║`);
      console.log(`║   Webhook : /whatsapp/webhook                    ║`);
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
      console.log('[Config]');
      console.log(`  ADMIN_USER:            ${process.env.ADMIN_USER ? '✅ ' + process.env.ADMIN_USER : '❌ NOT SET (default: admin)'}`);
      console.log(`  ADMIN_PASS:            ${process.env.ADMIN_PASS ? '✅ Set' : '❌ NOT SET (default: admin@123)'}`);
      console.log(`  VERIFY_TOKEN:          ${process.env.VERIFY_TOKEN ? '✅ Set' : '❌ NOT SET'}`);
      console.log(`  WHATSAPP_ACCESS_TOKEN: ${process.env.WHATSAPP_ACCESS_TOKEN ? '✅ Set' : '❌ NOT SET'}`);
      console.log('');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Stop the other process first, or set a different PORT in .env\n`);
        process.exit(1);
      } else throw err;
    });

  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

main();
module.exports = app;
