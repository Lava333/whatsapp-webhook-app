/**
 * messages.js
 * All DB helpers: message storage + full analytics including client segregation.
 */
const { getDB, persist } = require('./database');

// ─── Low-level query helpers ─────────────────────────────────

function query(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return query(sql, params)[0] || null;
}

// ─── Write ───────────────────────────────────────────────────

/**
 * Save an inbound or outbound message to the DB.
 */
function saveMessage({ messageId, senderPhone, senderName, messageType, body, direction, timestamp, wabaId }) {
  const db = getDB();
  db.run(
    `INSERT OR IGNORE INTO messages
       (waba_id, message_id, sender_phone, sender_name, message_type, body, direction, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [wabaId || null, messageId || null, senderPhone, senderName || null,
     messageType || 'text', body || null, direction || 'inbound', timestamp || null]
  );
  persist();
}

// ─── Summary stats ───────────────────────────────────────────

function getSummary() {
  const total      = queryOne(`SELECT COUNT(*) AS count FROM messages`);
  const clients    = queryOne(`SELECT COUNT(DISTINCT sender_phone) AS count FROM messages WHERE direction = 'inbound'`);
  const todayMsgs  = queryOne(`SELECT COUNT(*) AS count FROM messages WHERE DATE(created_at) = DATE('now')`);
  const todayClients = queryOne(`SELECT COUNT(DISTINCT sender_phone) AS count FROM messages WHERE direction = 'inbound' AND DATE(created_at) = DATE('now')`);
  const inbound    = queryOne(`SELECT COUNT(*) AS count FROM messages WHERE direction = 'inbound'`);
  const outbound   = queryOne(`SELECT COUNT(*) AS count FROM messages WHERE direction = 'outbound'`);
  const byType     = query(`SELECT message_type, COUNT(*) AS count FROM messages GROUP BY message_type ORDER BY count DESC`);
  const newClientsToday = queryOne(`
    SELECT COUNT(DISTINCT sender_phone) AS count FROM messages
    WHERE direction = 'inbound'
      AND DATE(created_at) = DATE('now')
      AND sender_phone NOT IN (
        SELECT DISTINCT sender_phone FROM messages
        WHERE direction = 'inbound' AND DATE(created_at) < DATE('now')
      )
  `);

  return {
    total:           total      ? Number(total.count)           : 0,
    totalClients:    clients    ? Number(clients.count)         : 0,
    todayMessages:   todayMsgs  ? Number(todayMsgs.count)       : 0,
    todayClients:    todayClients ? Number(todayClients.count)  : 0,
    newClientsToday: newClientsToday ? Number(newClientsToday.count) : 0,
    inbound:         inbound    ? Number(inbound.count)         : 0,
    outbound:        outbound   ? Number(outbound.count)        : 0,
    byType: byType.map(r => ({ message_type: r.message_type, count: Number(r.count) })),
  };
}

// ─── Client segregation ──────────────────────────────────────

/**
 * Returns one row per unique client (inbound sender) with their stats.
 * This is the core "segregation" feature.
 */
function getClients({ search = '', sortBy = 'last_message', sortDir = 'DESC', limit = 50, offset = 0 } = {}) {
  const searchParam = search ? `%${search}%` : '%';
  const allowedSort = ['last_message', 'first_message', 'message_count'];
  const col = allowedSort.includes(sortBy) ? sortBy : 'last_message';
  const dir = sortDir === 'ASC' ? 'ASC' : 'DESC';

  return query(
    `SELECT
       sender_phone,
       MAX(sender_name)                                            AS sender_name,
       COUNT(*)                                                    AS message_count,
       MAX(created_at)                                            AS last_message,
       MIN(created_at)                                            AS first_message,
       SUM(CASE WHEN message_type = 'text'     THEN 1 ELSE 0 END) AS text_count,
       SUM(CASE WHEN message_type = 'image'    THEN 1 ELSE 0 END) AS image_count,
       SUM(CASE WHEN message_type = 'audio'    THEN 1 ELSE 0 END) AS audio_count,
       SUM(CASE WHEN message_type = 'video'    THEN 1 ELSE 0 END) AS video_count,
       SUM(CASE WHEN message_type = 'document' THEN 1 ELSE 0 END) AS document_count,
       (SELECT body FROM messages m2
        WHERE m2.sender_phone = messages.sender_phone
          AND m2.direction = 'inbound'
        ORDER BY m2.created_at DESC LIMIT 1)                      AS last_body,
       (SELECT message_type FROM messages m2
        WHERE m2.sender_phone = messages.sender_phone
          AND m2.direction = 'inbound'
        ORDER BY m2.created_at DESC LIMIT 1)                      AS last_type
     FROM messages
     WHERE direction = 'inbound'
       AND (sender_phone LIKE ? OR COALESCE(sender_name, '') LIKE ?)
     GROUP BY sender_phone
     ORDER BY ${col} ${dir}
     LIMIT ? OFFSET ?`,
    [searchParam, searchParam, limit, offset]
  ).map(r => ({
    ...r,
    message_count:   Number(r.message_count),
    text_count:      Number(r.text_count),
    image_count:     Number(r.image_count),
    audio_count:     Number(r.audio_count),
    video_count:     Number(r.video_count),
    document_count:  Number(r.document_count),
  }));
}

function getTotalClientCount(search = '') {
  const searchParam = search ? `%${search}%` : '%';
  const row = queryOne(
    `SELECT COUNT(DISTINCT sender_phone) AS count FROM messages
     WHERE direction = 'inbound'
       AND (sender_phone LIKE ? OR COALESCE(sender_name, '') LIKE ?)`,
    [searchParam, searchParam]
  );
  return row ? Number(row.count) : 0;
}

/**
 * Get all messages for a specific client phone number.
 */
function getClientMessages(phone, limit = 100, offset = 0) {
  return query(
    `SELECT id, sender_phone, sender_name, message_type, body, direction,
            DATETIME(created_at) AS created_at, timestamp
     FROM messages
     WHERE sender_phone = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [phone, limit, offset]
  ).map(r => ({ ...r, id: Number(r.id) }));
}

function getClientMessageCount(phone) {
  const row = queryOne(`SELECT COUNT(*) AS count FROM messages WHERE sender_phone = ?`, [phone]);
  return row ? Number(row.count) : 0;
}

// ─── Time-series analytics ───────────────────────────────────

function getMessagesPerDay(days = 30) {
  return query(
    `SELECT
       DATE(created_at) AS day,
       COUNT(*) AS count,
       COUNT(DISTINCT sender_phone) AS unique_clients,
       SUM(CASE WHEN direction = 'inbound'  THEN 1 ELSE 0 END) AS inbound,
       SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
     FROM messages
     WHERE created_at >= DATE('now', '-' || ? || ' days')
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [days]
  ).map(r => ({ ...r, count: Number(r.count), unique_clients: Number(r.unique_clients), inbound: Number(r.inbound), outbound: Number(r.outbound) }));
}

function getMessagesPerWeek(weeks = 12) {
  const months = Math.ceil((weeks * 7) / 30);
  return query(
    `SELECT
       STRFTIME('%Y-W%W', created_at) AS week,
       COUNT(*) AS count,
       COUNT(DISTINCT sender_phone) AS unique_clients,
       SUM(CASE WHEN direction = 'inbound'  THEN 1 ELSE 0 END) AS inbound,
       SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound
     FROM messages
     WHERE created_at >= DATE('now', '-' || ? || ' months')
     GROUP BY week
     ORDER BY week ASC`,
    [months]
  ).map(r => ({ ...r, count: Number(r.count), unique_clients: Number(r.unique_clients), inbound: Number(r.inbound), outbound: Number(r.outbound) }));
}

// ─── Message log ─────────────────────────────────────────────

function getRecentMessages(limit = 50, offset = 0) {
  return query(
    `SELECT id, sender_phone, sender_name, message_type, body, direction,
            DATETIME(created_at) AS created_at, timestamp
     FROM messages ORDER BY id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  ).map(r => ({ ...r, id: Number(r.id) }));
}

function getTotalCount() {
  const row = queryOne(`SELECT COUNT(*) AS count FROM messages`);
  return row ? Number(row.count) : 0;
}

module.exports = {
  saveMessage,
  getSummary,
  getClients, getTotalClientCount, getClientMessages, getClientMessageCount,
  getMessagesPerDay, getMessagesPerWeek,
  getRecentMessages, getTotalCount,
};
