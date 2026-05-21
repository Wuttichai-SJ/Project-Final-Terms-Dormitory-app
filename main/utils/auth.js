const bcrypt = require('bcrypt');
const { getDb } = require('../database/client');
const { rolePermissions } = require('../database/schema');
const { eq } = require('drizzle-orm');

// In-memory session — cleared on app restart (intentional: desktop offline security)
let _session = null;

function setSession(user) {
  _session = user;
}

function getSession() {
  return _session;
}

function clearSession() {
  _session = null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Builds a { permissionKey: bool } map for a role by reading role_permissions.
// Stored on the session so handlers don't hit the DB on every permission check.
function buildPermissionMap(role) {
  const db = getDb();
  const rows = db
    .select({ key: rolePermissions.permissionKey, allowed: rolePermissions.allowed })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .all();

  const map = {};
  for (const row of rows) {
    map[row.key] = row.allowed === 1;
  }
  return map;
}

module.exports = { setSession, getSession, clearSession, hashPassword, verifyPassword, buildPermissionMap };
