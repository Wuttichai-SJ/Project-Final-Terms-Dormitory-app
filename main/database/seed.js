// Seed initial data on first launch.
// Each section is guarded by an existence check — safe to call on every boot.

const bcrypt = require('bcrypt');
const { getDb } = require('./client');
const {
  users,
  rolePermissions,
  appSettings,
  buildings,
  rooms,
} = require('./schema');
const { eq, and } = require('drizzle-orm');

// ─── Permissions matrix ───────────────────────────────────────────────────────
// One entry per permission_key. adminAllowed/staffAllowed map to the 'allowed' column.
const PERMISSIONS = [
  { key: 'dashboard.view',  admin: 1, staff: 1 },
  { key: 'rooms.view',      admin: 1, staff: 1 },
  { key: 'rooms.create',    admin: 1, staff: 1 },
  { key: 'rooms.edit',      admin: 1, staff: 1 },
  { key: 'rooms.delete',    admin: 1, staff: 0 },
  { key: 'tenants.view',    admin: 1, staff: 1 },
  { key: 'tenants.create',  admin: 1, staff: 1 },
  { key: 'tenants.edit',    admin: 1, staff: 1 },
  { key: 'tenants.delete',  admin: 1, staff: 0 },
  { key: 'lease.checkin',   admin: 1, staff: 1 },
  { key: 'lease.checkout',  admin: 1, staff: 0 }, // financial decision → admin only
  { key: 'bills.create',    admin: 1, staff: 1 },
  { key: 'bills.markpaid',  admin: 1, staff: 1 },
  { key: 'bills.delete',    admin: 1, staff: 0 }, // prevents retroactive edits by staff
  { key: 'bills.print',     admin: 1, staff: 1 },
  { key: 'summary.view',    admin: 1, staff: 1 },
  { key: 'analytics.view',  admin: 1, staff: 0 },
  { key: 'settings.view',   admin: 1, staff: 1 },
  { key: 'settings.edit',   admin: 1, staff: 0 },
  { key: 'users.manage',    admin: 1, staff: 0 },
  { key: 'audit.view',      admin: 1, staff: 0 },
];

/**
 * Seeds the database with:
 *   1. Default admin account (username: admin, password: admin1234 — must change on first login)
 *   2. Full role_permissions matrix (21 keys × 2 roles = 42 rows)
 *   3. app_settings row (id = 1) with default rates
 *   4. Buildings — ตึก 1 (code '1', 5 floors) and ตึก 2 (code '2', 4 floors)
 *   5. Rooms — 44 total (23 in ตึก 1, 21 in ตึก 2), all Fan type at app_settings.fanRoomPrice
 *
 * Each block is idempotent — skipped if data already exists.
 */
function runSeed() {
  const db = getDb();

  // 1. Admin user ─────────────────────────────────────────────────────────────
  const existingAdmin = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .get();

  if (!existingAdmin) {
    // bcryptSync is used here because seeding runs synchronously at startup
    const passwordHash = bcrypt.hashSync('admin1234', 10);
    db.insert(users).values({
      username:           'admin',
      passwordHash:       passwordHash,
      fullName:           'ผู้ดูแลระบบ',
      role:               'admin',
      isActive:           1,
      mustChangePassword: 0, // dev seed — skip the forced first-login change
    }).run();
    console.log('[Seed] Admin user created (username: admin, password: admin1234).');
  } else {
    // Recovery: re-enable admin if it was accidentally deactivated, and clear
    // any leftover mustChangePassword flag (the change-password UI is currently disabled).
    const adminRow = db
      .select({ isActive: users.isActive, mustChangePassword: users.mustChangePassword })
      .from(users)
      .where(eq(users.username, 'admin'))
      .get();
    if (adminRow && !adminRow.isActive) {
      db.update(users).set({ isActive: 1 }).where(eq(users.username, 'admin')).run();
      console.log('[Seed] Admin account was deactivated — re-enabled automatically.');
    }
    if (adminRow && adminRow.mustChangePassword) {
      db.update(users).set({ mustChangePassword: 0 }).where(eq(users.username, 'admin')).run();
      console.log('[Seed] Admin mustChangePassword flag cleared.');
    }
  }

  // 2. Role permissions ────────────────────────────────────────────────────────
  const existingPermCount = db
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .all().length;

  if (existingPermCount === 0) {
    const rows = [];
    for (const perm of PERMISSIONS) {
      rows.push({ role: 'admin', permissionKey: perm.key, allowed: perm.admin });
      rows.push({ role: 'staff', permissionKey: perm.key, allowed: perm.staff });
    }
    db.insert(rolePermissions).values(rows).run();
    console.log(`[Seed] ${rows.length} role_permissions rows inserted.`);
  }

  // 3. App settings ────────────────────────────────────────────────────────────
  const existingSettings = db
    .select({ id: appSettings.id })
    .from(appSettings)
    .get();

  if (!existingSettings) {
    db.insert(appSettings).values({
      id:                     1,
      dormitoryName:          '',
      electricRate:           8,
      waterRate:              33,
      minWaterBill:           120,
      trashFee:               40,
      commonFee:              100,
      internetFee:            300,
      defaultVatRate:         7,
      vatEnabled:             0,
      fanRoomPrice:           3500,
      airRoomPrice:           4500,
      dueDays:                7,
      earlyTerminationPolicy: 'A',
    }).run();
    console.log('[Seed] app_settings row created with default rates.');
  }

  // 4. Buildings ──────────────────────────────────────────────────────────────
  const BUILDINGS = [
    { code: '1', name: 'ตึก 1', floors: 5 },
    { code: '2', name: 'ตึก 2', floors: 4 },
  ];

  for (const b of BUILDINGS) {
    const existing = db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.code, b.code))
      .get();
    if (!existing) {
      db.insert(buildings).values(b).run();
      console.log(`[Seed] Building created (code: ${b.code}, name: ${b.name}).`);
    }
  }

  // 5. Rooms ──────────────────────────────────────────────────────────────────
  // floor → number of rooms on that floor (room numbers run 01..N, prefixed with building code + floor)
  const ROOM_LAYOUT = {
    '1': { 1: 3, 2: 6, 3: 6, 4: 6, 5: 2 },
    '2': {       2: 7, 3: 7, 4: 7        },
  };

  // Pull current fan price from app_settings so rooms reflect any rate change
  const settings = db.select({ fanRoomPrice: appSettings.fanRoomPrice }).from(appSettings).get();
  const basePrice = settings?.fanRoomPrice ?? 3500;

  let roomsInserted = 0;
  for (const [code, floors] of Object.entries(ROOM_LAYOUT)) {
    const building = db
      .select({ id: buildings.id })
      .from(buildings)
      .where(eq(buildings.code, code))
      .get();
    if (!building) continue;

    for (const [floorStr, count] of Object.entries(floors)) {
      const floor = Number(floorStr);
      for (let i = 1; i <= count; i++) {
        const roomNumber = `${code}${floor}${String(i).padStart(2, '0')}`;
        const exists = db
          .select({ id: rooms.id })
          .from(rooms)
          .where(and(eq(rooms.buildingId, building.id), eq(rooms.roomNumber, roomNumber)))
          .get();
        if (!exists) {
          db.insert(rooms).values({
            roomNumber,
            buildingId: building.id,
            floor,
            type:       'Fan',
            basePrice,
            status:     'Vacant',
          }).run();
          roomsInserted++;
        }
      }
    }
  }
  if (roomsInserted > 0) {
    console.log(`[Seed] ${roomsInserted} rooms inserted.`);
  }
}

module.exports = { runSeed };
