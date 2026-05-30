const { ipcMain } = require('electron');
const { getDb, getSqlite } = require('../database/client');
const { tenants, leases, rooms, buildings } = require('../database/schema');
const { eq, like, or, and, ne } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');

function registerTenantHandlers() {

  // List all tenants, with optional text search across name and phone.
  // Hides soft-deleted tenants by default. Pass { includeDeleted: true } to see them.
  // Joins with the tenant's *Active* lease (if any) so the UI can render an
  // accurate residency badge: "พักอยู่" only when currentLeaseId is set.
  ipcMain.handle('tenant:list', async (_event, { search, includeDeleted = false } = {}) => {
    try {
      requireAuth();
      requirePermission('tenants.view');
      const db = getDb();

      const baseQuery = db.select({
        id:                  tenants.id,
        fullName:            tenants.fullName,
        phone:               tenants.phone,
        idCard:              tenants.idCard,
        nationality:         tenants.nationality,
        address:             tenants.address,
        status:              tenants.status,
        note:                tenants.note,
        createdAt:           tenants.createdAt,
        updatedAt:           tenants.updatedAt,
        currentLeaseId:      leases.id,
        currentRoomId:       leases.roomId,
        currentRoomNumber:   rooms.roomNumber,
        currentBuildingCode: buildings.code,
        currentBuildingName: buildings.name,
      })
        .from(tenants)
        // Only join leases that are still Active — multiple historical leases per tenant
        // would otherwise multiply the row count.
        .leftJoin(leases,    and(eq(leases.tenantId, tenants.id), eq(leases.status, 'Active')))
        .leftJoin(rooms,     eq(leases.roomId,    rooms.id))
        .leftJoin(buildings, eq(rooms.buildingId, buildings.id));

      const conditions = [];
      if (!includeDeleted) conditions.push(ne(tenants.status, 'Deleted'));
      if (search) conditions.push(or(
        like(tenants.fullName, `%${search}%`),
        like(tenants.phone, `%${search}%`),
      ));

      const data = conditions.length === 0
        ? baseQuery.orderBy(tenants.fullName).all()
        : baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
                    .orderBy(tenants.fullName).all();

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

  // Soft-delete: mark tenant as 'Deleted' so they disappear from the list but
  // historical lease/bill/move-out records that FK back to them stay intact.
  // Block when an Active lease exists — soft-delete during a residency would
  // orphan the running contract.
  ipcMain.handle('tenant:delete', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('tenants.delete');
      if (!id) return { success: false, error: 'ระบุ id ผู้เช่า' };

      const db = getDb();
      const sqlite = getSqlite();

      const existing = db.select({ status: tenants.status }).from(tenants).where(eq(tenants.id, id)).get();
      if (!existing) return { success: false, error: 'ไม่พบผู้เช่านี้' };
      if (existing.status === 'Deleted') return { success: false, error: 'ผู้เช่ารายนี้ถูกลบไปแล้ว' };

      const activeLease = db.select({ id: leases.id }).from(leases)
        .where(and(eq(leases.tenantId, id), eq(leases.status, 'Active'))).get();
      if (activeLease) {
        return { success: false, error: 'ไม่สามารถลบผู้เช่าที่ยังพักอยู่ได้ กรุณาทำ Move-Out ก่อน' };
      }

      sqlite.transaction(() => {
        db.update(tenants).set({ status: 'Deleted' }).where(eq(tenants.id, id)).run();
        // Defensive: clear any room still pointing at this tenant so listings don't
        // surface a "deleted" name in the room table.
        db.update(rooms).set({ currentTenantId: null })
          .where(eq(rooms.currentTenantId, id)).run();
      })();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerTenantHandlers };
