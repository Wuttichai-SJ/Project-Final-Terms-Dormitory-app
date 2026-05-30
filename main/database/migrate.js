// Raw SQL migrations executed at app boot via better-sqlite3.
// Uses PRAGMA user_version to track which version has been applied — idempotent on every launch.
// Add new migrations as additional version blocks (v2, v3, ...) without changing v1.

const CURRENT_VERSION = 3;

// All DDL for the initial schema (v1).
// Tables are created in FK dependency order so REFERENCES are always valid.
const V1_DDL = `
-- ─── AUTH & ACCESS CONTROL ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL,
  full_name      TEXT    NOT NULL,
  phone          TEXT,
  role           TEXT    NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff')),
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT,
  created_at     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  role            TEXT    NOT NULL CHECK(role IN ('admin','staff')),
  permission_key  TEXT    NOT NULL,
  allowed         INTEGER NOT NULL DEFAULT 0,
  UNIQUE(role, permission_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  action        TEXT    NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  payload_json  TEXT,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── MASTER DATA ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS buildings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  name        TEXT,
  address     TEXT,
  floors      INTEGER,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name    TEXT    NOT NULL,
  phone        TEXT    NOT NULL,
  id_card      TEXT    UNIQUE,
  nationality  TEXT,
  address      TEXT,
  status       TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','MovedOut')),
  note         TEXT,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number         TEXT    NOT NULL,
  building_id         INTEGER NOT NULL REFERENCES buildings(id),
  floor               INTEGER NOT NULL,
  type                TEXT    NOT NULL CHECK(type IN ('Fan','Air')),
  base_price          REAL    NOT NULL,
  -- vat_rate / vat_enabled deprecated: VAT is now a global setting in app_settings
  vat_rate            REAL    NOT NULL DEFAULT 0,
  vat_enabled         INTEGER NOT NULL DEFAULT 0,
  status              TEXT    NOT NULL DEFAULT 'Vacant'
                              CHECK(status IN ('Vacant','Occupied','Reserved','Maintenance')),
  current_tenant_id   INTEGER REFERENCES tenants(id),
  last_elec_reading   REAL    DEFAULT 0,
  last_water_reading  REAL    DEFAULT 0,
  created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT,
  UNIQUE(building_id, room_number)
);

-- Single-row config. CHECK(id = 1) prevents accidental extra rows.
CREATE TABLE IF NOT EXISTS app_settings (
  id                        INTEGER PRIMARY KEY CHECK(id = 1),
  dormitory_name            TEXT,
  dormitory_address         TEXT,
  dormitory_phone           TEXT,
  electric_rate             REAL    NOT NULL DEFAULT 8,
  water_rate                REAL    NOT NULL DEFAULT 33,
  min_water_bill            REAL    NOT NULL DEFAULT 120,
  trash_fee                 REAL    NOT NULL DEFAULT 40,
  common_fee                REAL    NOT NULL DEFAULT 100,
  internet_fee              REAL    NOT NULL DEFAULT 300,
  default_vat_rate          REAL    NOT NULL DEFAULT 7,
  vat_enabled               INTEGER NOT NULL DEFAULT 0,
  fan_room_price            REAL    NOT NULL DEFAULT 3500,
  air_room_price            REAL    NOT NULL DEFAULT 4500,
  due_days                  INTEGER NOT NULL DEFAULT 7,
  early_termination_policy  TEXT    NOT NULL DEFAULT 'A',
  updated_by_user_id        INTEGER REFERENCES users(id),
  updated_at                TEXT
);

-- ─── OPERATIONS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leases (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id              INTEGER NOT NULL REFERENCES tenants(id),
  room_id                INTEGER NOT NULL REFERENCES rooms(id),
  start_date             TEXT    NOT NULL,
  end_date               TEXT,
  deposit                REAL    NOT NULL DEFAULT 0,
  monthly_rent_snapshot  REAL    NOT NULL,
  status                 TEXT    NOT NULL DEFAULT 'Active'
                                 CHECK(status IN ('Active','Completed','Terminated')),
  created_by_user_id     INTEGER REFERENCES users(id),
  created_at             TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id              INTEGER NOT NULL REFERENCES rooms(id),
  tenant_name          TEXT    NOT NULL,
  phone                TEXT    NOT NULL,
  id_card              TEXT,
  nationality          TEXT,
  address              TEXT,
  move_in_date         TEXT    NOT NULL,
  deposit              REAL    NOT NULL DEFAULT 0,
  status               TEXT    NOT NULL DEFAULT 'Active'
                               CHECK(status IN ('Active','CheckedIn','Cancelled')),
  created_by_user_id   INTEGER REFERENCES users(id),
  created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id              INTEGER NOT NULL REFERENCES rooms(id),
  completion_date      TEXT    NOT NULL,
  notes                TEXT,
  priority             TEXT    DEFAULT 'Normal' CHECK(priority IN ('High','Normal','Low')),
  status               TEXT    DEFAULT 'Open' CHECK(status IN ('Open','Done')),
  created_by_user_id   INTEGER REFERENCES users(id),
  created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at          TEXT
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id               INTEGER NOT NULL REFERENCES rooms(id),
  period_month          INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
  period_year           INTEGER NOT NULL,
  electricity_reading   REAL    NOT NULL,
  water_reading         REAL    NOT NULL,
  recorded_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by_user_id   INTEGER REFERENCES users(id),
  UNIQUE(room_id, period_month, period_year)
);

-- ─── BILLING & PAYMENT ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bills (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_no              TEXT    UNIQUE,
  lease_id             INTEGER NOT NULL REFERENCES leases(id),
  room_id              INTEGER NOT NULL REFERENCES rooms(id),
  tenant_id            INTEGER NOT NULL REFERENCES tenants(id),
  period_month         INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
  period_year          INTEGER NOT NULL,
  elec_previous        REAL    NOT NULL,
  elec_current         REAL    NOT NULL CHECK(elec_current >= elec_previous),
  elec_rate            REAL    NOT NULL,
  elec_cost            REAL    NOT NULL,
  water_previous       REAL    NOT NULL,
  water_current        REAL    NOT NULL CHECK(water_current >= water_previous),
  water_rate           REAL    NOT NULL,
  water_min            REAL    NOT NULL,
  water_cost           REAL    NOT NULL,
  room_price           REAL    NOT NULL,
  trash_fee            REAL    NOT NULL DEFAULT 0,
  common_fee           REAL    NOT NULL DEFAULT 0,
  internet_fee         REAL    NOT NULL DEFAULT 0,
  additional_fee       REAL    NOT NULL DEFAULT 0,
  subtotal             REAL    NOT NULL,
  vat_rate             REAL    NOT NULL DEFAULT 0,
  vat_applied          INTEGER NOT NULL DEFAULT 0,
  vat_amount           REAL    NOT NULL DEFAULT 0,
  total                REAL    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'Unpaid'
                               CHECK(status IN ('Unpaid','Paid','Overdue','Cancelled')),
  due_date             TEXT    NOT NULL,
  created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id   INTEGER REFERENCES users(id),
  paid_at              TEXT,
  paid_by_user_id      INTEGER REFERENCES users(id),
  pdf_path             TEXT,
  UNIQUE(room_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS payments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id               INTEGER NOT NULL REFERENCES bills(id),
  amount                REAL    NOT NULL,
  paid_at               TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method                TEXT    CHECK(method IN ('Cash','Transfer','Other')),
  note                  TEXT,
  received_by_user_id   INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS move_out_records (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  lease_id              INTEGER NOT NULL REFERENCES leases(id),
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id),
  room_id               INTEGER NOT NULL REFERENCES rooms(id),
  notice_date           TEXT    NOT NULL,
  move_out_date         TEXT    NOT NULL,
  deposit_amount        REAL    NOT NULL,
  total_deductions      REAL    NOT NULL DEFAULT 0,
  refund_amount         REAL    NOT NULL,
  is_early_termination  INTEGER NOT NULL DEFAULT 0,
  early_penalty_amount  REAL    NOT NULL DEFAULT 0,
  policy_used           TEXT,
  original_end_date     TEXT,
  note                  TEXT,
  processed_by_user_id  INTEGER REFERENCES users(id),
  created_at            TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS move_out_deductions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  move_out_record_id  INTEGER NOT NULL REFERENCES move_out_records(id) ON DELETE CASCADE,
  note                TEXT    NOT NULL,
  amount              REAL    NOT NULL CHECK(amount >= 0)
);

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_rooms_updated_at
AFTER UPDATE ON rooms FOR EACH ROW
BEGIN
  UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tenants_updated_at
AFTER UPDATE ON tenants FOR EACH ROW
BEGIN
  UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_building      ON rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_tenants_idcard      ON tenants(id_card);
CREATE INDEX IF NOT EXISTS idx_tenants_name        ON tenants(full_name);
CREATE INDEX IF NOT EXISTS idx_leases_active       ON leases(status, room_id);
CREATE INDEX IF NOT EXISTS idx_bills_period        ON bills(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bills_status        ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due           ON bills(due_date) WHERE status = 'Unpaid';
CREATE INDEX IF NOT EXISTS idx_meter_period        ON meter_readings(room_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_audit_user_time     ON audit_logs(user_id, created_at);
`;

// Phase 2 — add must_change_password to users.
// UPDATE sets flag for any existing admin so they are prompted to change on next login.
const V2_DDL = `
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
UPDATE users SET must_change_password = 1 WHERE username = 'admin';
`;

// Phase 4+ — add 'Deleted' to tenants.status CHECK so we can soft-delete instead
// of physically removing rows (which would break FKs from historical leases/bills/move-outs).
// SQLite can't ALTER a CHECK constraint in place; the standard recipe is to rebuild
// the table. Foreign keys must be disabled around the rebuild so referencing rows
// (leases.tenant_id, bills.tenant_id, move_out_records.tenant_id, rooms.current_tenant_id)
// don't fail during the DROP/RENAME step. The wrapper in runMigrations() handles that.
const V3_DDL = `
CREATE TABLE tenants_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name    TEXT    NOT NULL,
  phone        TEXT    NOT NULL,
  id_card      TEXT    UNIQUE,
  nationality  TEXT,
  address      TEXT,
  status       TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','MovedOut','Deleted')),
  note         TEXT,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT
);

INSERT INTO tenants_new (id, full_name, phone, id_card, nationality, address, status, note, created_at, updated_at)
SELECT id, full_name, phone, id_card, nationality, address, status, note, created_at, updated_at FROM tenants;

DROP TABLE tenants;
ALTER TABLE tenants_new RENAME TO tenants;

CREATE INDEX IF NOT EXISTS idx_tenants_idcard ON tenants(id_card);
CREATE INDEX IF NOT EXISTS idx_tenants_name   ON tenants(full_name);

CREATE TRIGGER IF NOT EXISTS trg_tenants_updated_at
AFTER UPDATE ON tenants FOR EACH ROW
BEGIN
  UPDATE tenants SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
`;

/**
 * Run all pending migrations against the open better-sqlite3 instance.
 * Safe to call on every app start — already-applied versions are skipped.
 * Each version block sets its own version number so chains apply in order.
 */
function runMigrations(sqlite) {
  let version = sqlite.pragma('user_version', { simple: true });

  if (version < 1) {
    sqlite.exec('BEGIN;');
    try {
      sqlite.exec(V1_DDL);
      sqlite.pragma('user_version = 1');
      sqlite.exec('COMMIT;');
      console.log('[DB] Migration v1 applied — schema created.');
      version = 1;
    } catch (err) {
      sqlite.exec('ROLLBACK;');
      throw new Error(`[DB] Migration v1 failed: ${err.message}`);
    }
  }

  if (version < 2) {
    sqlite.exec('BEGIN;');
    try {
      sqlite.exec(V2_DDL);
      sqlite.pragma('user_version = 2');
      sqlite.exec('COMMIT;');
      console.log('[DB] Migration v2 applied — must_change_password added.');
      version = 2;
    } catch (err) {
      sqlite.exec('ROLLBACK;');
      throw new Error(`[DB] Migration v2 failed: ${err.message}`);
    }
  }

  if (version < 3) {
    // Rebuilding tenants needs FKs off so referencing rows don't block DROP.
    // PRAGMA foreign_keys must be toggled outside any transaction.
    sqlite.pragma('foreign_keys = OFF');
    sqlite.exec('BEGIN;');
    try {
      sqlite.exec(V3_DDL);
      sqlite.pragma('user_version = 3');
      sqlite.exec('COMMIT;');
      sqlite.pragma('foreign_keys = ON');
      console.log("[DB] Migration v3 applied — tenants.status now allows 'Deleted'.");
      version = 3;
    } catch (err) {
      sqlite.exec('ROLLBACK;');
      sqlite.pragma('foreign_keys = ON');
      throw new Error(`[DB] Migration v3 failed: ${err.message}`);
    }
  }

  if (version === CURRENT_VERSION) {
    console.log(`[DB] Schema up-to-date (user_version = ${version}).`);
  }
}

module.exports = { runMigrations };
