const { ipcMain } = require('electron');
const { getDb, getSqlite } = require('../database/client');
const { reservations, rooms, leases, tenants, buildings } = require('../database/schema');
const { eq, and, desc } = require('drizzle-orm');
const { requireAuth, requirePermission } = require('../utils/permission');
const { writeAudit } = require('../utils/audit');

function registerReservationHandlers() {

  // ─── reservation:list ───────────────────────────────────────────────────────
  ipcMain.handle('reservation:list', async (_event, filters = {}) => {
    try {
      requireAuth();
      requirePermission('rooms.view');
      const db = getDb();

      const conditions = [];
      if (filters.status) conditions.push(eq(reservations.status, filters.status));

      const query = db.select({
        id:           reservations.id,
        roomId:       reservations.roomId,
        roomNumber:   rooms.roomNumber,
        buildingName: buildings.name,
        buildingCode: buildings.code,
        floor:        rooms.floor,
        tenantName:   reservations.tenantName,
        phone:        reservations.phone,
        idCard:       reservations.idCard,
        nationality:  reservations.nationality,
        address:      reservations.address,
        moveInDate:   reservations.moveInDate,
        deposit:      reservations.deposit,
        status:       reservations.status,
        createdAt:    reservations.createdAt,
      })
        .from(reservations)
        .leftJoin(rooms,     eq(reservations.roomId, rooms.id))
        .leftJoin(buildings, eq(rooms.buildingId, buildings.id))
        .orderBy(desc(reservations.createdAt));

      const data = conditions.length > 0
        ? query.where(conditions.length === 1 ? conditions[0] : and(...conditions)).all()
        : query.all();

      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── reservation:create ─────────────────────────────────────────────────────
  // Reserves a Vacant room for a walk-in customer who hasn't been registered as
  // a Tenant yet (their details are stored on the reservation row itself).
  // Atomic: INSERT reservation + UPDATE room→Reserved.
  ipcMain.handle('reservation:create', async (_event, payload) => {
    try {
      const session = requireAuth();
      requirePermission('lease.checkin');

      const { roomId, tenantName, phone, idCard, nationality, address, moveInDate, deposit } = payload || {};
      if (!roomId || !tenantName || !phone || !moveInDate) {
        return { success: false, error: 'กรุณากรอกห้อง, ชื่อผู้จอง, เบอร์โทร และวันเข้าพัก' };
      }

      const db = getDb();
      const sqlite = getSqlite();

      const room = db.select().from(rooms).where(eq(rooms.id, Number(roomId))).get();
      if (!room)                    return { success: false, error: 'ไม่พบห้องนี้' };
      if (room.status !== 'Vacant') return { success: false, error: `ห้อง ${room.roomNumber} ไม่สามารถจองได้ (สถานะปัจจุบัน: ${room.status})` };

      const created = sqlite.transaction(() => {
        const reservation = db.insert(reservations).values({
          roomId:          Number(roomId),
          tenantName:      tenantName.trim(),
          phone:           phone.trim(),
          idCard:          idCard?.trim()      || null,
          nationality:     nationality?.trim() || null,
          address:         address?.trim()     || null,
          moveInDate:      String(moveInDate),
          deposit:         deposit != null ? Number(deposit) : 0,
          status:          'Active',
          createdByUserId: session.id,
        }).returning().get();

        db.update(rooms).set({
          status:    'Reserved',
          updatedAt: new Date().toISOString(),
        }).where(eq(rooms.id, Number(roomId))).run();

        writeAudit({
          action:     'reservation.create',
          entityType: 'reservation',
          entityId:   reservation.id,
          payload:    reservation,
        });

        return reservation;
      })();

      return { success: true, data: created };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── reservation:cancel ─────────────────────────────────────────────────────
  // Frees the room back to Vacant. Only Active reservations can be cancelled.
  ipcMain.handle('reservation:cancel', async (_event, { id }) => {
    try {
      requireAuth();
      requirePermission('lease.checkin');
      if (!id) return { success: false, error: 'ระบุ id การจอง' };

      const db = getDb();
      const sqlite = getSqlite();

      const existing = db.select().from(reservations).where(eq(reservations.id, id)).get();
      if (!existing)                    return { success: false, error: 'ไม่พบการจองนี้' };
      if (existing.status !== 'Active') return { success: false, error: 'ยกเลิกได้เฉพาะการจองสถานะ Active เท่านั้น' };

      sqlite.transaction(() => {
        db.update(reservations).set({ status: 'Cancelled' })
          .where(eq(reservations.id, id)).run();

        // Restore room only if it is still in Reserved state (defensive — manual edits may have changed it)
        const room = db.select({ status: rooms.status }).from(rooms).where(eq(rooms.id, existing.roomId)).get();
        if (room && room.status === 'Reserved') {
          db.update(rooms).set({
            status:    'Vacant',
            updatedAt: new Date().toISOString(),
          }).where(eq(rooms.id, existing.roomId)).run();
        }

        writeAudit({
          action:     'reservation.cancel',
          entityType: 'reservation',
          entityId:   id,
          payload:    { roomId: existing.roomId, tenantName: existing.tenantName },
        });
      })();

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ─── reservation:checkin ────────────────────────────────────────────────────
  // Converts a Reserved room into an Active lease.
  //   1. Reuse existing Tenant row if tenantId provided, else create a new tenant
  //      from the reservation snapshot.
  //   2. INSERT lease (status=Active, monthly_rent_snapshot from room.base_price)
  //   3. UPDATE rooms.status='Occupied', current_tenant_id=...
  //   4. UPDATE reservations.status='CheckedIn'
  //   5. Audit log
  ipcMain.handle('reservation:checkin', async (_event, payload = {}) => {
    try {
      const session = requireAuth();
      requirePermission('lease.checkin');

      const { id, tenantId, startDate } = payload;
      const endDate = payload.endDate && String(payload.endDate).trim() !== ''
        ? String(payload.endDate)
        : null;

      if (!id)        return { success: false, error: 'ระบุ id การจอง' };
      if (!startDate) return { success: false, error: 'กรุณาระบุวันเริ่มสัญญา' };

      const db = getDb();
      const sqlite = getSqlite();

      const reservation = db.select().from(reservations).where(eq(reservations.id, id)).get();
      if (!reservation)                    return { success: false, error: 'ไม่พบการจองนี้' };
      if (reservation.status !== 'Active') return { success: false, error: 'การจองนี้ไม่อยู่ในสถานะ Active' };

      const room = db.select().from(rooms).where(eq(rooms.id, reservation.roomId)).get();
      if (!room) return { success: false, error: 'ไม่พบห้องของการจองนี้' };
      // Room may be either 'Reserved' (normal) or 'Vacant' (if manually freed) — allow both,
      // but reject anything else.
      if (!['Reserved', 'Vacant'].includes(room.status)) {
        return { success: false, error: `ห้อง ${room.roomNumber} ไม่สามารถเช็คอินได้ (สถานะปัจจุบัน: ${room.status})` };
      }

      const result = sqlite.transaction(() => {
        // 1. Resolve tenant: link to existing or create fresh from reservation snapshot
        let finalTenantId = tenantId ? Number(tenantId) : null;

        if (finalTenantId) {
          const t = db.select({ status: tenants.status }).from(tenants).where(eq(tenants.id, finalTenantId)).get();
          if (!t)                    throw new Error('ไม่พบผู้เช่าที่เลือก');
          if (t.status !== 'Active') throw new Error('ผู้เช่าที่เลือกไม่อยู่ในสถานะ Active');

          const otherActive = db.select({ id: leases.id })
            .from(leases)
            .where(and(eq(leases.tenantId, finalTenantId), eq(leases.status, 'Active')))
            .get();
          if (otherActive) throw new Error('ผู้เช่ารายนี้มีสัญญา Active อยู่แล้ว');
        } else {
          const newTenant = db.insert(tenants).values({
            fullName:    reservation.tenantName,
            phone:       reservation.phone,
            idCard:      reservation.idCard      || null,
            nationality: reservation.nationality || null,
            address:     reservation.address     || null,
            status:      'Active',
          }).returning().get();
          finalTenantId = newTenant.id;
        }

        // 2. Create lease — deposit carries over from the reservation
        const lease = db.insert(leases).values({
          tenantId:            finalTenantId,
          roomId:              reservation.roomId,
          startDate:           String(startDate),
          endDate:             endDate,
          deposit:             Number(reservation.deposit || 0),
          monthlyRentSnapshot: Number(room.basePrice),
          status:              'Active',
          createdByUserId:     session.id,
        }).returning().get();

        // 3. Room → Occupied
        db.update(rooms).set({
          status:          'Occupied',
          currentTenantId: finalTenantId,
          updatedAt:       new Date().toISOString(),
        }).where(eq(rooms.id, reservation.roomId)).run();

        // 4. Reservation → CheckedIn
        db.update(reservations).set({ status: 'CheckedIn' })
          .where(eq(reservations.id, id)).run();

        writeAudit({
          action:     'reservation.checkin',
          entityType: 'lease',
          entityId:   lease.id,
          payload:    {
            reservationId:       id,
            tenantId:            finalTenantId,
            roomId:              reservation.roomId,
            startDate:           lease.startDate,
            endDate:             lease.endDate,
            deposit:             lease.deposit,
            monthlyRentSnapshot: lease.monthlyRentSnapshot,
          },
        });

        return lease;
      })();

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerReservationHandlers };
