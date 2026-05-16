// Seed initial data on first launch.
// Each section is guarded by an existence check — safe to call on every boot.

const bcrypt = require('bcrypt');
const { getDb } = require('./client');
const {
  users,
  rolePermissions,
  appSettings,
  buildings,
} = require('./schema');
const { eq } = require('drizzle-orm');

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
 *   4. Default building (code: '1', name: 'อาคารหลัก')
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
      username:     'admin',
      passwordHash: passwordHash,
      fullName:     'ผู้ดูแลระบบ',
      role:         'admin',
      isActive:     1,
    }).run();
    console.log('[Seed] Admin user created (username: admin, password: admin1234).');
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

  // 4. Default building ────────────────────────────────────────────────────────
  const existingBuilding = db
    .select({ id: buildings.id })
    .from(buildings)
    .get();

  if (!existingBuilding) {
    db.insert(buildings).values({
      code:  '1',
      name:  'อาคารหลัก',
    }).run();
    console.log('[Seed] Default building (code: 1, name: อาคารหลัก) created.');
  }
}

module.exports = { runSeed };
