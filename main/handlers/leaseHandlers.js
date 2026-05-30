const { ipcMain } = require('electron');
const { getDb, getSqlite } = require('../database/client');
const { leases, rooms, tenants, buildings } = require('../database/schema');
const { eq, and, desc } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');
const { writeAudit } = require('../utils/audit');

function registerLeaseHandlers() {

  // ─── lease:list ─────────────────────────────────────────────────────────────
  // Returns leases joined with tenant + room + building for display in the table.
  // Accepts optional status filter ('Active' | 'Completed' | 'Terminated').
  ipcMain.handle('lease:list', async (_event, filters = {}) => {
    try {
      requireAuth();
      requirePermission('rooms.view');
      const db = getDb();

      const conditions = [];
      if (filters.status)   conditions.push(eq(leases.status, filters.status));
      if (filters.tenantId) conditions.push(eq(leases.tenantId, Number(filters.tenantId)));
      if (filters.roomId)   conditions.push(eq(leases.roomId,   Number(filters.roomId)));

      const query = db.select({
        id:                  leases.id,
        tenantId:            leases.tenantId,
        tenantName:          tenants.fullName,
        tenantPhone:         tenants.phone,
        roomId:              leases.roomId,
        roomNumber:          rooms.roomNumber,
        buildingId:          rooms.buildingId,
        buildingName:        buildings.name,
        buildingCode:        buildings.code,
        floor:               rooms.floor,
        startDate:           leases.startDate,
        endDate:             leases.endDate,
        deposit:             leases.deposit,
        monthlyRentSnapshot: leases.monthlyRentSnapshot,
        status:              leases.status,
        createdAt:           leases.createdAt,
      })
        .from(leases)
        .leftJoin(tenants,   eq(leases.tenantId, tenants.id))
        .leftJoin(rooms,     eq(leases.roomId,   rooms.id))
        .leftJoin(buildings, eq(rooms.buildingId, buildings.id))
        .orderBy(desc(leases.createdAt));

      const data = conditions.length > 0
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions)).all()
        : query.all();

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── lease:get ──────────────────────────────────────────────────────────────
  ipcMain.handle('lease:get', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('rooms.view');
      if (!id) return { success: false, error: 'ระบุ id สัญญา' };
      const db = getDb();

      const data = db.select({
        id:                  leases.id,
        tenantId:            leases.tenantId,
        tenantName:          tenants.fullName,
        tenantPhone:         tenants.phone,
        roomId:              leases.roomId,
        roomNumber:          rooms.roomNumber,
        buildingName:        buildings.name,
        buildingCode:        buildings.code,
        floor:               rooms.floor,
        startDate:           leases.startDate,
        endDate:             leases.endDate,
        deposit:             leases.deposit,
        monthlyRentSnapshot: leases.monthlyRentSnapshot,
        status:              leases.status,
        createdAt:           leases.createdAt,
      })
        .from(leases)
        .leftJoin(tenants,   eq(leases.tenantId, tenants.id))
        .leftJoin(rooms,     eq(leases.roomId,   rooms.id))
        .leftJoin(buildings, eq(rooms.buildingId, buildings.id))
        .where(eq(leases.id, id))
        .get();

      if (!data) return { success: false, error: 'ไม่พบสัญญานี้' };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── lease:create  (== Check-in) ────────────────────────────────────────────
  // Atomic flow:
  //   1. Validate tenant is Active and not currently on another active lease
  //   2. Validate room is Vacant
  //   3. Snapshot monthly_rent from room.base_price
  //   4. INSERT lease (status=Active)
  //   5. UPDATE rooms.status='Occupied', current_tenant_id=tenantId
  //   6. Write audit log
  // Everything wrapped in sqlite.transaction() so a failure rolls all of it back.
  // Accepts EITHER tenantId (existing tenant) OR tenantData (inline create).
  // Inline path inserts the tenant inside the same transaction so a failed
  // room/lease step rolls back the new tenant row too.
  ipcMain.handle('lease:create', async (_event, payload = {}) => {
    try {
      const session = requireAuth();
      requirePermission('lease.checkin');

      const { tenantId, tenantData, roomId, startDate, deposit } = payload;
      const endDate = payload.endDate && String(payload.endDate).trim() !== ''
        ? String(payload.endDate)
        : null;

      if (!roomId || !startDate) {
        return { success: false, error: 'กรุณาเลือกห้องและวันเริ่มสัญญา' };
      }
      if (!tenantId && !tenantData) {
        return { success: false, error: 'กรุณาเลือกผู้เช่าหรือกรอกข้อมูลผู้เช่าใหม่' };
      }
      if (tenantData && (!tenantData.fullName || !tenantData.phone)) {
        return { success: false, error: 'กรุณากรอกชื่อ-นามสกุล และเบอร์โทรของผู้เช่าใหม่' };
      }

      const db = getDb();
      const sqlite = getSqlite();

      // ── Pre-flight checks (outside transaction so failures return cleanly) ──
      if (tenantId) {
        const tenant = db.select().from(tenants).where(eq(tenants.id, Number(tenantId))).get();
        if (!tenant)                    return { success: false, error: 'ไม่พบผู้เช่านี้' };
        if (tenant.status !== 'Active') return { success: false, error: 'ผู้เช่ารายนี้ไม่อยู่ในสถานะ Active' };

        const activeLease = db.select({ id: leases.id })
          .from(leases)
          .where(and(eq(leases.tenantId, Number(tenantId)), eq(leases.status, 'Active')))
          .get();
        if (activeLease) return { success: false, error: 'ผู้เช่ารายนี้มีสัญญา Active อยู่แล้ว' };
      }

      const room = db.select().from(rooms).where(eq(rooms.id, Number(roomId))).get();
      if (!room)                     return { success: false, error: 'ไม่พบห้องนี้' };
      if (room.status !== 'Vacant')  return { success: false, error: `ห้อง ${room.roomNumber} ไม่ว่าง (สถานะปัจจุบัน: ${room.status})` };

      // ── Transaction: (optional create tenant) + insert lease + update room ──
      const created = sqlite.transaction(() => {
        let finalTenantId = tenantId ? Number(tenantId) : null;

        if (!finalTenantId) {
          // Inline new-tenant create — UNIQUE on id_card may throw, which rolls everything back
          const newTenant = db.insert(tenants).values({
            fullName:    String(tenantData.fullName).trim(),
            phone:       String(tenantData.phone).trim(),
            idCard:      tenantData.idCard?.trim()      || null,
            nationality: tenantData.nationality?.trim() || null,
            address:     tenantData.address?.trim()     || null,
            note:        tenantData.note?.trim()        || null,
            status:      'Active',
          }).returning().get();
          finalTenantId = newTenant.id;
        }

        const lease = db.insert(leases).values({
          tenantId:            finalTenantId,
          roomId:              Number(roomId),
          startDate:           String(startDate),
          endDate:             endDate,
          deposit:             deposit != null && deposit !== '' ? Number(deposit) : 0,
          monthlyRentSnapshot: Number(room.basePrice),
          status:              'Active',
          createdByUserId:     session.id,
        }).returning().get();

        db.update(rooms).set({
          status:          'Occupied',
          currentTenantId: finalTenantId,
          updatedAt:       new Date().toISOString(),
        }).where(eq(rooms.id, Number(roomId))).run();

        writeAudit({
          action:     'lease.checkin',
          entityType: 'lease',
          entityId:   lease.id,
          payload:    {
            tenantId:            lease.tenantId,
            tenantCreatedInline: !tenantId,
            roomId:              lease.roomId,
            startDate:           lease.startDate,
            endDate:             lease.endDate,
            deposit:             lease.deposit,
            monthlyRentSnapshot: lease.monthlyRentSnapshot,
          },
        });

        return lease;
      })();

      return { success: true, data: created };
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return { success: false, error: 'เลขบัตรประชาชนนี้ถูกใช้งานแล้ว' };
      }
      return { success: false, error: err.message };
    }
  });

  // ─── lease:terminate ────────────────────────────────────────────────────────
  // Quick-terminate path for tenants who leave without going through the planned
  // move-out flow (no deposit math, no deductions — that is Phase 8).
  // Flips lease to Terminated, frees the room, leaves tenant.status = 'Active'
  // so they can sign another lease later if they come back. The badge on the
  // tenant list will switch from "พักอยู่" to "ลงทะเบียน" automatically because
  // tenant:list joins on Active leases.
  ipcMain.handle('lease:terminate', async (_event, payload = {}) => {
    try {
      requireAuth();
      requirePermission('lease.checkout');

      const { id, reason } = payload;
      if (!id) return { success: false, error: 'ระบุ id สัญญา' };

      const db = getDb();
      const sqlite = getSqlite();

      const lease = db.select().from(leases).where(eq(leases.id, Number(id))).get();
      if (!lease)                    return { success: false, error: 'ไม่พบสัญญานี้' };
      if (lease.status !== 'Active') return { success: false, error: 'ยกเลิกได้เฉพาะสัญญา Active เท่านั้น' };

      const today = new Date().toISOString().slice(0, 10);

      sqlite.transaction(() => {
        db.update(leases).set({
          status:  'Terminated',
          endDate: today,
        }).where(eq(leases.id, lease.id)).run();

        // Defensive: only flip room back to Vacant if it is currently Occupied by
        // this very tenant. If something else changed it (e.g. Maintenance flag
        // applied manually) we don't want to clobber that.
        const room = db.select().from(rooms).where(eq(rooms.id, lease.roomId)).get();
        if (room && room.status === 'Occupied' && room.currentTenantId === lease.tenantId) {
          db.update(rooms).set({
            status:          'Vacant',
            currentTenantId: null,
            updatedAt:       new Date().toISOString(),
          }).where(eq(rooms.id, lease.roomId)).run();
        }

        writeAudit({
          action:     'lease.terminate',
          entityType: 'lease',
          entityId:   lease.id,
          payload:    {
            tenantId:    lease.tenantId,
            roomId:      lease.roomId,
            endedOn:     today,
            originalEnd: lease.endDate,
            reason:      reason || null,
          },
        });
      })();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerLeaseHandlers };
