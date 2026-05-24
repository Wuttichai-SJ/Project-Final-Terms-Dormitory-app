const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { buildings, rooms } = require('../database/schema');
const { eq, sql } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerBuildingHandlers() {

  ipcMain.handle('building:list', async () => {
    try {
      requireAuth();
      const db = getDb();
      const data = db.select().from(buildings).orderBy(buildings.code).all();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('building:create', async (_event, { code, name, floors }) => {
    try {
      requireAuth();
      requirePermission('settings.edit');
      if (!code) return { success: false, error: 'กรุณากรอกรหัสอาคาร' };

      const db = getDb();
      const result = db.insert(buildings).values({
        code:   code.trim(),
        name:   name?.trim() || null,
        floors: floors ? Number(floors) : null,
      }).returning().get();

      return { success: true, data: result };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: `รหัสอาคาร "${code}" ถูกใช้งานแล้ว` };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('building:update', async (_event, { id, code, name, floors }) => {
    try {
      requireAuth();
      requirePermission('settings.edit');
      if (!id) return { success: false, error: 'ระบุ id อาคาร' };
      if (!code) return { success: false, error: 'กรุณากรอกรหัสอาคาร' };

      const db = getDb();
      db.update(buildings).set({
        code:   code.trim(),
        name:   name?.trim() || null,
        floors: floors ? Number(floors) : null,
      }).where(eq(buildings.id, id)).run();

      return { success: true };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: `รหัสอาคาร "${code}" ถูกใช้งานแล้ว` };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('building:delete', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('settings.edit');
      if (!id) return { success: false, error: 'ระบุ id อาคาร' };

      const db = getDb();
      // Prevent deletion when rooms still exist in this building
      const roomCount = db
        .select({ n: sql`count(*)` })
        .from(rooms)
        .where(eq(rooms.buildingId, id))
        .get();

      if (roomCount?.n > 0) {
        return { success: false, error: 'ไม่สามารถลบอาคารที่มีห้องพักอยู่ได้ กรุณาลบห้องพักออกก่อน' };
      }

      db.delete(buildings).where(eq(buildings.id, id)).run();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerBuildingHandlers };
