const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { users } = require('../database/schema');
const { eq } = require('drizzle-orm');
const { hashPassword } = require('../utils/auth');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerUserHandlers() {

  // List all users (password hashes excluded) — admin only
  ipcMain.handle('user:list', async () => {
    try {
      requireAuth();
      requirePermission('users.manage');

      const db = getDb();
      const list = db
        .select({
          id:          users.id,
          username:    users.username,
          fullName:    users.fullName,
          phone:       users.phone,
          role:        users.role,
          isActive:    users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt:   users.createdAt,
        })
        .from(users)
        .all();

      return { success: true, data: list };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Create a new user — admin only. New users must change password on first login.
  ipcMain.handle('user:create', async (_event, payload) => {
    try {
      requireAuth();
      requirePermission('users.manage');

      const { username, password, fullName, phone, role } = payload;

      if (!username || !password || !fullName || !role) {
        return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ (username, password, fullName, role)' };
      }
      if (!['admin', 'staff'].includes(role)) {
        return { success: false, error: 'role ต้องเป็น admin หรือ staff' };
      }
      if (password.length < 6) {
        return { success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
      }

      const db = getDb();
      const existing = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username.trim()))
        .get();
      if (existing) {
        return { success: false, error: `username "${username}" ถูกใช้งานแล้ว` };
      }

      const hash = await hashPassword(password);
      const result = db
        .insert(users)
        .values({
          username:           username.trim(),
          passwordHash:       hash,
          fullName:           fullName.trim(),
          phone:              phone?.trim() || null,
          role,
          isActive:           1,
          mustChangePassword: 1,
        })
        .returning()
        .get();

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Update user profile and role — admin only
  ipcMain.handle('user:update', async (_event, { id, fullName, phone, role, isActive }) => {
    try {
      const session = requireAuth();
      requirePermission('users.manage');

      if (!id) return { success: false, error: 'ระบุ id ผู้ใช้' };

      // Prevent admins from deactivating their own account — would cause permanent lockout
      if (id === session.id && !isActive) {
        return { success: false, error: 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้' };
      }

      const db = getDb();
      db.update(users)
        .set({
          fullName: fullName?.trim(),
          phone:    phone?.trim() || null,
          role,
          isActive: isActive ? 1 : 0,
        })
        .where(eq(users.id, id))
        .run();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Reset another user's password — admin only. Sets mustChangePassword so they change it on next login.
  ipcMain.handle('user:resetPassword', async (_event, { id, newPassword }) => {
    try {
      requireAuth();
      requirePermission('users.manage');

      if (!id || !newPassword) return { success: false, error: 'ระบุ id และ newPassword' };
      if (newPassword.length < 6) return { success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };

      const hash = await hashPassword(newPassword);
      const db = getDb();
      db.update(users)
        .set({ passwordHash: hash, mustChangePassword: 1 })
        .where(eq(users.id, id))
        .run();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerUserHandlers };
