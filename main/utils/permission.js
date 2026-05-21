const { getSession } = require('./auth');

function hasPermission(key) {
  const session = getSession();
  if (!session) return false;
  return session.permissions[key] === true;
}

// Throws a Thai-language error if the current session lacks the given permission key.
// Used inside handlers to guard admin-only and role-gated operations.
function requirePermission(key) {
  if (!hasPermission(key)) {
    const err = new Error(`ไม่มีสิทธิ์: ${key}`);
    err.code = 'FORBIDDEN';
    throw err;
  }
}

// Returns the current session or throws UNAUTHENTICATED if nobody is logged in.
function requireAuth() {
  const session = getSession();
  if (!session) {
    const err = new Error('กรุณาเข้าสู่ระบบ');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
  return session;
}

module.exports = { hasPermission, requirePermission, requireAuth };
