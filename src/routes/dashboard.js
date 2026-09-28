/**
 * dashboard.js
 * REST API powering the analytics dashboard.
 * New endpoints: /api/clients, /api/clients/:phone/messages
 */
const express = require('express');
const router = express.Router();
const {
  getSummary,
  getClients, getTotalClientCount, getClientMessages, getClientMessageCount,
  getMessagesPerDay, getMessagesPerWeek,
  getRecentMessages, getTotalCount,
} = require('../db/messages');

// ─── Summary ─────────────────────────────────────────────────
// GET /api/stats/summary
router.get('/stats/summary', (req, res) => {
  try {
    res.json({ success: true, data: getSummary() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Time-series ─────────────────────────────────────────────
// GET /api/stats/daily?days=30
router.get('/stats/daily', (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    res.json({ success: true, data: getMessagesPerDay(days) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/weekly?weeks=12
router.get('/stats/weekly', (req, res) => {
  try {
    const weeks = parseInt(req.query.weeks, 10) || 12;
    res.json({ success: true, data: getMessagesPerWeek(weeks) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Client segregation ──────────────────────────────────────
// GET /api/clients?search=&sortBy=last_message&sortDir=DESC&limit=50&offset=0
// Returns each unique client with their message count, last/first seen, last message preview
router.get('/clients', (req, res) => {
  try {
    const search   = req.query.search  || '';
    const sortBy   = req.query.sortBy  || 'last_message';
    const sortDir  = req.query.sortDir || 'DESC';
    const limit    = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
    const offset   = parseInt(req.query.offset, 10) || 0;

    const clients = getClients({ search, sortBy, sortDir, limit, offset });
    const total   = getTotalClientCount(search);
    res.json({ success: true, data: clients, total, limit, offset });
  } catch (err) {
    console.error('[Dashboard] /clients error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clients/:phone/messages?limit=50&offset=0
// Returns all messages for a specific client phone number
router.get('/clients/:phone/messages', (req, res) => {
  try {
    const phone  = req.params.phone;
    const limit  = Math.min(parseInt(req.query.limit, 10)  || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const messages = getClientMessages(phone, limit, offset);
    const total    = getClientMessageCount(phone);
    res.json({ success: true, data: messages, total, phone, limit, offset });
  } catch (err) {
    console.error('[Dashboard] /clients/:phone/messages error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Message log ─────────────────────────────────────────────
// GET /api/messages?limit=50&offset=0
router.get('/messages', (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const messages = getRecentMessages(limit, offset);
    const total    = getTotalCount();
    res.json({ success: true, data: messages, total, limit, offset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
