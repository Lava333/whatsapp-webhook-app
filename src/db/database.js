/**
 * database.js
 * Initializes a sql.js (pure WASM SQLite) database with file-based persistence.
 * sql.js has NO native compilation requirements — works on all platforms.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'whatsapp.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// We export a promise that resolves to { db, persist }
// Callers should await initDB() before using.
let _db = null;
let _SQL = null;

async function initDB() {
  if (_db) return _db;

  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();

  // Load existing DB file or create a new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
    console.log(`[DB] Loaded existing database from: ${DB_PATH}`);
  } else {
    _db = new _SQL.Database();
    console.log(`[DB] Created new database at: ${DB_PATH}`);
  }

  // Create schema
  _db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      waba_id         TEXT,
      message_id      TEXT UNIQUE,
      sender_phone    TEXT NOT NULL,
      sender_name     TEXT,
      message_type    TEXT NOT NULL DEFAULT 'text',
      body            TEXT,
      direction       TEXT NOT NULL DEFAULT 'inbound',
      timestamp       INTEGER,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_phone);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  // Persist immediately after schema creation
  persist();

  return _db;
}

/**
 * Write the in-memory DB back to disk.
 * Call this after every write operation.
 */
function persist() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/**
 * Get the initialized DB instance (sync, after initDB() has been awaited).
 */
function getDB() {
  if (!_db) throw new Error('Database not initialized. Await initDB() first.');
  return _db;
}

module.exports = { initDB, getDB, persist };
