const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { users } = require('../database/schema');
const { eq } = require('drizzle-orm');
const {
  setSession, getSession, clearSession,
  hashPassword, verifyPassword, buildPermissionMap,
} = require('../utils/auth');

function registerAuthHandlers() {

  // Verify credentials, build permission map, store in-memory session
  ipcMain.handle('auth:login', async (_event, { username, password }) => {
    try {
      if (!username || !password) {
        return { success: false, error: 'กรุณากรอก username และ password' };
      }

      const db = getDb();
      const user = db
        .select()
        .from(users)
        .where(eq(users.username, username.trim()))
        .get();

      // Use identical error for wrong username or wrong password — prevents username enumeration
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }

      if (!user.isActive) {
        return { success: false, error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
      }

      db.update(users)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(users.id, user.id))
        .run();

      const session = {
        id:                 user.id,
        username:           user.username,
        fullName:           user.fullName,
        phone:              user.phone,
        role:               user.role,
        mustChangePassword: user.mustChangePassword === 0,
        permissions:        buildPermissionMap(user.role),
      };
      setSession(session);

      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    clearSession();
    return { success: true };
  });

  // Returns the current session — used on app load to check if already logged in
  ipcMain.handle('auth:me', async () => {
    const session = getSession();
    if (!session) return { success: false, error: 'ไม่มี session' };
    return { success: true, data: session };
  });

  // Change own password; clears mustChangePassword flag on success
  ipcMain.handle('auth:changePassword', async (_event, { currentPassword, newPassword }) => {
    try {
      const session = getSession();
      if (!session) return { success: false, error: 'กรุณาเข้าสู่ระบบ' };

      if (!currentPassword || !newPassword) {
        return { success: false, error: 'กรุณากรอกรหัสผ่านให้ครบ' };
      }
      if (newPassword.length < 6) {
        return { success: false, error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
      }

      const db = getDb();
      const user = db.select().from(users).where(eq(users.id, session.id)).get();

      const match = await verifyPassword(currentPassword, user.passwordHash);
      if (!match) return { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };

      const newHash = await hashPassword(newPassword);
      db.update(users)
        .set({ passwordHash: newHash, mustChangePassword: 0 })
        .where(eq(users.id, session.id))
        .run();

      session.mustChangePassword = false;
      setSession(session);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerAuthHandlers };
