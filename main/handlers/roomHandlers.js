const { ipcMain } = require('electron');
const { getDb } = require('../database/client');
const { rooms, buildings, tenants } = require('../database/schema');
const { eq, and } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerRoomHandlers() {

  // List rooms with left-joined building + tenant names. Supports optional filters.
  ipcMain.handle('room:list', async (_event, filters = {}) => {
    try {
      requireAuth();
      requirePermission('rooms.view');
      const db = getDb();

      const conditions = [];
      if (filters.buildingId) conditions.push(eq(rooms.buildingId, Number(filters.buildingId)));
      if (filters.floor)      conditions.push(eq(rooms.floor, Number(filters.floor)));
      if (filters.status)     conditions.push(eq(rooms.status, filters.status));

      const query = db.select({
        id:               rooms.id,
        roomNumber:       rooms.roomNumber,
        buildingId:       rooms.buildingId,
        buildingName:     buildings.name,
        buildingCode:     buildings.code,
        floor:            rooms.floor,
        type:             rooms.type,
        basePrice:        rooms.basePrice,
        status:           rooms.status,
        currentTenantId:  rooms.currentTenantId,
        tenantName:       tenants.fullName,
        lastElecReading:  rooms.lastElecReading,
        lastWaterReading: rooms.lastWaterReading,
        createdAt:        rooms.createdAt,
      })
        .from(rooms)
        .leftJoin(buildings, eq(rooms.buildingId, buildings.id))
        .leftJoin(tenants,   eq(rooms.currentTenantId, tenants.id));

      const data = conditions.length > 0
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions)).all()
        : query.all();

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('room:create', async (_event, { roomNumber, buildingId, floor, type, basePrice }) => {
    try {
      requireAuth();
      requirePermission('rooms.create');

      if (!roomNumber || !buildingId || !floor || !type || basePrice === undefined || basePrice === null) {
        return { success: false, error: 'กรุณากรอกข้อมูลให้ครบ (หมายเลขห้อง, อาคาร, ชั้น, ประเภท, ราคา)' };
      }
      if (!['Fan', 'Air'].includes(type)) {
        return { success: false, error: 'ประเภทห้องต้องเป็น Fan หรือ Air' };
      }
      if (Number(basePrice) < 0) {
        return { success: false, error: 'ราคาต้องไม่ติดลบ' };
      }

      const db = getDb();
      const result = db.insert(rooms).values({
        roomNumber: roomNumber.trim(),
        buildingId: Number(buildingId),
        floor:      Number(floor),
        type,
        basePrice:  Number(basePrice),
        status:     'Vacant',
      }).returning().get();

      return { success: true, data: result };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: `ห้องหมายเลข "${roomNumber}" ในอาคารนี้มีอยู่แล้ว` };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('room:update', async (_event, { id, roomNumber, buildingId, floor, type, basePrice, status }) => {
    try {
      requireAuth();
      requirePermission('rooms.edit');
      if (!id) return { success: false, error: 'ระบุ id ห้อง' };

      const db = getDb();
      const existing = db.select().from(rooms).where(eq(rooms.id, id)).get();
      if (!existing) return { success: false, error: 'ไม่พบห้องนี้' };

      // Occupied/Reserved status must come from lease/reservation handlers, not manual edits.
      // The guard is symmetric: you cannot manually set it AND you cannot manually leave it.
      if (status && status !== existing.status) {
        if (['Occupied', 'Reserved'].includes(status)) {
          return { success: false, error: 'ไม่สามารถตั้งสถานะ Occupied หรือ Reserved ด้วยตนเองได้ (ใช้เมนูสัญญาเช่า/การจอง)' };
        }
        if (['Occupied', 'Reserved'].includes(existing.status)) {
          return { success: false, error: `ห้องนี้กำลัง ${existing.status === 'Occupied' ? 'มีผู้เช่าอยู่' : 'ถูกจอง'} — ต้องยกเลิกสัญญา/การจองก่อนจึงจะเปลี่ยนสถานะได้` };
        }
      }

      db.update(rooms).set({
        roomNumber: roomNumber?.trim()    ?? existing.roomNumber,
        buildingId: buildingId != null    ? Number(buildingId) : existing.buildingId,
        floor:      floor != null         ? Number(floor)      : existing.floor,
        type:       type                  ?? existing.type,
        basePrice:  basePrice != null     ? Number(basePrice)  : existing.basePrice,
        status:     status                ?? existing.status,
      }).where(eq(rooms.id, id)).run();

      return { success: true };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: 'หมายเลขห้องนี้มีอยู่แล้วในอาคารนี้' };
      }
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('room:delete', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('rooms.delete');
      if (!id) return { success: false, error: 'ระบุ id ห้อง' };

      const db = getDb();
      const existing = db.select({ status: rooms.status }).from(rooms).where(eq(rooms.id, id)).get();
      if (!existing) return { success: false, error: 'ไม่พบห้องนี้' };

      // Only Vacant rooms can be deleted — others have or had active tenants
      if (existing.status !== 'Vacant') {
        return { success: false, error: 'ลบได้เฉพาะห้องที่ว่างอยู่ (Vacant) เท่านั้น' };
      }

      db.delete(rooms).where(eq(rooms.id, id)).run();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerRoomHandlers };
