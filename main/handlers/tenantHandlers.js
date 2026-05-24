const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { tenants } = require('../database/schema');
const { eq, like, or } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerTenantHandlers() {

  // List all tenants, with optional text search across name and phone
  ipcMain.handle('tenant:list', async (_event, { search } = {}) => {
    try {
      requireAuth();
      requirePermission('tenants.view');
      const db = getDb();

      const data = search
        ? db.select().from(tenants)
            .where(or(
              like(tenants.fullName, `%${search}%`),
              like(tenants.phone, `%${search}%`),
            ))
            .orderBy(tenants.fullName).all()
        : db.select().from(tenants).orderBy(tenants.fullName).all();

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tenant:get', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('tenants.view');
      if (!id) return { success: false, error: 'ระบุ id ผู้เช่า' };

      const db = getDb();
      const data = db.select().from(tenants).where(eq(tenants.id, id)).get();
      if (!data) return { success: false, error: 'ไม่พบผู้เช่านี้' };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tenant:create', async (_event, { fullName, phone, idCard, nationality, address, note }) => {
    try {
      requireAuth();
      requirePermission('tenants.create');

      if (!fullName || !phone) {
        return { success: false, error: 'กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์' };
      }

      const db = getDb();
      const result = db.insert(tenants).values({
        fullName:    fullName.trim(),
        phone:       phone.trim(),
        idCard:      idCard?.trim()      || null,
        nationality: nationality?.trim() || null,
        address:     address?.trim()     || null,
        note:        note?.trim()        || null,
        status:      'Active',
      }).returning().get();

      return { success: true, data: result };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว' };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tenant:update', async (_event, { id, fullName, phone, idCard, nationality, address, note }) => {
    try {
      requireAuth();
      requirePermission('tenants.edit');

      if (!id)             return { success: false, error: 'ระบุ id ผู้เช่า' };
      if (!fullName || !phone) return { success: false, error: 'กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์' };

      const db = getDb();
      db.update(tenants).set({
        fullName:    fullName.trim(),
        phone:       phone.trim(),
        idCard:      idCard?.trim()      || null,
        nationality: nationality?.trim() || null,
        address:     address?.trim()     || null,
        note:        note?.trim()        || null,
      }).where(eq(tenants.id, id)).run();

      return { success: true };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว' };
      }
      return { success: false, error: err.message };
    }
  });

  // Only MovedOut tenants can be deleted — Active tenants must go through move-out first
  ipcMain.handle('tenant:delete', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('tenants.delete');
      if (!id) return { success: false, error: 'ระบุ id ผู้เช่า' };

      const db = getDb();
      const existing = db.select({ status: tenants.status }).from(tenants).where(eq(tenants.id, id)).get();
      if (!existing) return { success: false, error: 'ไม่พบผู้เช่านี้' };

      if (existing.status === 'Active') {
        return { success: false, error: 'ไม่สามารถลบผู้เช่าที่ยังพักอยู่ได้ กรุณาทำ Move-Out ก่อน' };
      }

      db.delete(tenants).where(eq(tenants.id, id)).run();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerTenantHandlers };
