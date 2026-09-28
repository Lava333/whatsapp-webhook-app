/**
 * auth.js — Login / Logout routes
 *
 * GET  /login          → serve login page
 * POST /login          → validate credentials, create session
 * GET  /logout         → destroy session, redirect to /login
 * GET  /api/me         → return current session user info
 */
const express = require('express');
const router = express.Router();
const path = require('path');

// GET /login — serve the login HTML page
router.get('/', (req, res) => {
  // Already logged in → go straight to dashboard
  if (req.session && req.session.loggedIn) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, '../../public/login/index.html'));
});

// POST /login — validate credentials
router.post('/', express.urlencoded({ extended: true }), express.json(), (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASS || 'admin@123';

  if (username === validUser && password === validPass) {
    req.session.loggedIn = true;
    req.session.user = { username };
    console.log(`[Auth] ✅ Login successful: ${username}`);

    // Support JSON response (for fetch-based login form)
    const returnTo = req.query.returnTo || req.body.returnTo || '/dashboard';
    return res.json({ success: true, redirectTo: returnTo });
  }

  console.warn(`[Auth] ❌ Failed login attempt: "${username}"`);
  return res.status(401).json({ success: false, error: 'Invalid username or password.' });
});

// GET /logout — destroy session
router.get('/logout', (req, res) => {
  const user = req.session?.user?.username || 'unknown';
  req.session.destroy(() => {
    console.log(`[Auth] 👋 Logged out: ${user}`);
    res.redirect('/login');
  });
});

// GET /api/me — return current user info (used by dashboard)
router.get('/me', (req, res) => {
  if (req.session?.loggedIn) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.status(401).json({ loggedIn: false });
});

module.exports = router;
