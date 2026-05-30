// Centralized audit-log writer. Every state-changing handler should call this
// inside its transaction so the log row commits or rolls back with the change.

const { getDb } = require('../database/client');
const { auditLogs } = require('../database/schema');
const { getSession } = require('./auth');

/**
 * Inserts a row into audit_logs using the current session user.
 *
 * Safe to call outside a transaction (will commit immediately) and inside one
 * (will participate in the surrounding sqlite.transaction()).
 *
 * @param {object} entry
 * @param {string} entry.action      e.g. 'lease.checkin'
 * @param {string} [entry.entityType] e.g. 'lease', 'reservation'
 * @param {string|number} [entry.entityId]
 * @param {object} [entry.payload]   any JSON-serializable snapshot
 */
function writeAudit({ action, entityType, entityId, payload }) {
  const session = getSession();
  // If there is no session (e.g. boot-time seed) we silently skip — auditLogs.user_id is NOT NULL.
  if (!session?.id) return;

  const db = getDb();
  db.insert(auditLogs).values({
    userId:      session.id,
    action,
    entityType:  entityType ?? null,
    entityId:    entityId != null ? String(entityId) : null,
    payloadJson: payload ? JSON.stringify(payload) : null,
  }).run();
}

module.exports = { writeAudit };
