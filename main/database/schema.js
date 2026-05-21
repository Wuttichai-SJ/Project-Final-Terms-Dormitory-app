// Drizzle ORM table definitions — used for type-safe query building only.
// Actual DDL (CREATE TABLE, CHECK, INDEX) lives in migrate.js and is what the DB enforces.
// Column names here must exactly match the SQL column names in migrate.js.

const { sqliteTable, text, integer, real } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

// ─── 1. AUTH & ACCESS CONTROL ────────────────────────────────────────────────

const users = sqliteTable('users', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  username:      text('username').notNull().unique(),
  passwordHash:  text('password_hash').notNull(),
  fullName:      text('full_name').notNull(),
  phone:         text('phone'),
  role:          text('role').notNull().default('staff'),       // 'admin' | 'staff'
  isActive:           integer('is_active').notNull().default(1),
  mustChangePassword: integer('must_change_password').notNull().default(0),
  lastLoginAt:        text('last_login_at'),
  createdAt:     text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:     text('updated_at'),
});

const rolePermissions = sqliteTable('role_permissions', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  role:          text('role').notNull(),                        // 'admin' | 'staff'
  permissionKey: text('permission_key').notNull(),
  allowed:       integer('allowed').notNull().default(0),       // 1 = yes, 0 = no
});

const auditLogs = sqliteTable('audit_logs', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  userId:      integer('user_id').notNull(),
  action:      text('action').notNull(),                        // e.g. 'bill.create'
  entityType:  text('entity_type'),                            // table name
  entityId:    text('entity_id'),
  payloadJson: text('payload_json'),                           // JSON snapshot
  createdAt:   text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 2. MASTER DATA ───────────────────────────────────────────────────────────

const buildings = sqliteTable('buildings', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  code:      text('code').notNull().unique(),                  // e.g. '1', '2'
  name:      text('name'),
  address:   text('address'),
  floors:    integer('floors'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const rooms = sqliteTable('rooms', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  roomNumber:       text('room_number').notNull(),
  buildingId:       integer('building_id').notNull(),
  floor:            integer('floor').notNull(),
  type:             text('type').notNull(),                    // 'Fan' | 'Air'
  basePrice:        real('base_price').notNull(),
  // vat_rate / vat_enabled kept for schema compat but deprecated — global VAT lives in app_settings
  vatRate:          real('vat_rate').notNull().default(0),
  vatEnabled:       integer('vat_enabled').notNull().default(0),
  status:           text('status').notNull().default('Vacant'), // Vacant|Occupied|Reserved|Maintenance
  currentTenantId:  integer('current_tenant_id'),
  lastElecReading:  real('last_elec_reading').default(0),
  lastWaterReading: real('last_water_reading').default(0),
  createdAt:        text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:        text('updated_at'),
});

const tenants = sqliteTable('tenants', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  fullName:    text('full_name').notNull(),
  phone:       text('phone').notNull(),
  idCard:      text('id_card').unique(),
  nationality: text('nationality'),
  address:     text('address'),
  status:      text('status').notNull().default('Active'),     // 'Active' | 'MovedOut'
  note:        text('note'),
  createdAt:   text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt:   text('updated_at'),
});

// Single-row config table (id must always be 1). Seeded once on first boot.
const appSettings = sqliteTable('app_settings', {
  id:                      integer('id').primaryKey(),         // CHECK(id=1) enforced in migrate.js
  dormitoryName:           text('dormitory_name'),
  dormitoryAddress:        text('dormitory_address'),
  dormitoryPhone:          text('dormitory_phone'),
  electricRate:            real('electric_rate').notNull().default(8),
  waterRate:               real('water_rate').notNull().default(33),
  minWaterBill:            real('min_water_bill').notNull().default(120),
  trashFee:                real('trash_fee').notNull().default(40),
  commonFee:               real('common_fee').notNull().default(100),
  internetFee:             real('internet_fee').notNull().default(300),
  defaultVatRate:          real('default_vat_rate').notNull().default(7),
  vatEnabled:              integer('vat_enabled').notNull().default(0),  // global on/off
  fanRoomPrice:            real('fan_room_price').notNull().default(3500),
  airRoomPrice:            real('air_room_price').notNull().default(4500),
  dueDays:                 integer('due_days').notNull().default(7),
  earlyTerminationPolicy:  text('early_termination_policy').notNull().default('A'), // 'A'|'B'|'C'
  updatedByUserId:         integer('updated_by_user_id'),
  updatedAt:               text('updated_at'),
});

// ─── 3. OPERATIONS ────────────────────────────────────────────────────────────

const leases = sqliteTable('leases', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  tenantId:             integer('tenant_id').notNull(),
  roomId:               integer('room_id').notNull(),
  startDate:            text('start_date').notNull(),
  endDate:              text('end_date'),                      // NULL = ongoing
  deposit:              real('deposit').notNull().default(0),
  monthlyRentSnapshot:  real('monthly_rent_snapshot').notNull(), // frozen at signing
  status:               text('status').notNull().default('Active'), // Active|Completed|Terminated
  createdByUserId:      integer('created_by_user_id'),
  createdAt:            text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const reservations = sqliteTable('reservations', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  roomId:           integer('room_id').notNull(),
  tenantName:       text('tenant_name').notNull(),
  phone:            text('phone').notNull(),
  idCard:           text('id_card'),
  nationality:      text('nationality'),
  address:          text('address'),
  moveInDate:       text('move_in_date').notNull(),
  deposit:          real('deposit').notNull().default(0),
  status:           text('status').notNull().default('Active'), // Active|CheckedIn|Cancelled
  createdByUserId:  integer('created_by_user_id'),
  createdAt:        text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const maintenanceRecords = sqliteTable('maintenance_records', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  roomId:           integer('room_id').notNull(),
  completionDate:   text('completion_date').notNull(),
  notes:            text('notes'),
  priority:         text('priority').default('Normal'),        // High|Normal|Low
  status:           text('status').default('Open'),            // Open|Done
  createdByUserId:  integer('created_by_user_id'),
  createdAt:        text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  resolvedAt:       text('resolved_at'),
});

const meterReadings = sqliteTable('meter_readings', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  roomId:              integer('room_id').notNull(),
  periodMonth:         integer('period_month').notNull(),      // 1–12
  periodYear:          integer('period_year').notNull(),
  electricityReading:  real('electricity_reading').notNull(),
  waterReading:        real('water_reading').notNull(),
  recordedAt:          text('recorded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  recordedByUserId:    integer('recorded_by_user_id'),
});

// ─── 4. BILLING & PAYMENT ─────────────────────────────────────────────────────

const bills = sqliteTable('bills', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  billNo:           text('bill_no').unique(),                  // INV-YYYY-MM-####
  leaseId:          integer('lease_id').notNull(),
  roomId:           integer('room_id').notNull(),
  tenantId:         integer('tenant_id').notNull(),
  periodMonth:      integer('period_month').notNull(),
  periodYear:       integer('period_year').notNull(),
  elecPrevious:     real('elec_previous').notNull(),
  elecCurrent:      real('elec_current').notNull(),
  elecRate:         real('elec_rate').notNull(),
  elecCost:         real('elec_cost').notNull(),
  waterPrevious:    real('water_previous').notNull(),
  waterCurrent:     real('water_current').notNull(),
  waterRate:        real('water_rate').notNull(),
  waterMin:         real('water_min').notNull(),
  waterCost:        real('water_cost').notNull(),
  roomPrice:        real('room_price').notNull(),
  trashFee:         real('trash_fee').notNull().default(0),
  commonFee:        real('common_fee').notNull().default(0),
  internetFee:      real('internet_fee').notNull().default(0),
  additionalFee:    real('additional_fee').notNull().default(0),
  subtotal:         real('subtotal').notNull(),
  vatRate:          real('vat_rate').notNull().default(0),     // snapshot at bill creation
  vatApplied:       integer('vat_applied').notNull().default(0),
  vatAmount:        real('vat_amount').notNull().default(0),
  total:            real('total').notNull(),
  status:           text('status').notNull().default('Unpaid'), // Unpaid|Paid|Overdue|Cancelled
  dueDate:          text('due_date').notNull(),
  createdAt:        text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdByUserId:  integer('created_by_user_id'),
  paidAt:           text('paid_at'),
  paidByUserId:     integer('paid_by_user_id'),
  pdfPath:          text('pdf_path'),
});

const payments = sqliteTable('payments', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  billId:             integer('bill_id').notNull(),
  amount:             real('amount').notNull(),
  paidAt:             text('paid_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  method:             text('method'),                          // Cash|Transfer|Other
  note:               text('note'),
  receivedByUserId:   integer('received_by_user_id'),
});

const moveOutRecords = sqliteTable('move_out_records', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  leaseId:              integer('lease_id').notNull(),
  tenantId:             integer('tenant_id').notNull(),
  roomId:               integer('room_id').notNull(),
  noticeDate:           text('notice_date').notNull(),
  moveOutDate:          text('move_out_date').notNull(),
  depositAmount:        real('deposit_amount').notNull(),
  totalDeductions:      real('total_deductions').notNull().default(0),
  refundAmount:         real('refund_amount').notNull(),
  // Early termination tracking — added per plan revision section 4.3
  isEarlyTermination:   integer('is_early_termination').notNull().default(0),
  earlyPenaltyAmount:   real('early_penalty_amount').notNull().default(0),
  policyUsed:           text('policy_used'),                  // 'A' | 'B' | 'C'
  originalEndDate:      text('original_end_date'),            // lease end_date before early exit
  note:                 text('note'),
  processedByUserId:    integer('processed_by_user_id'),
  createdAt:            text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const moveOutDeductions = sqliteTable('move_out_deductions', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  moveOutRecordId:   integer('move_out_record_id').notNull(),  // ON DELETE CASCADE in DDL
  note:              text('note').notNull(),
  amount:            real('amount').notNull(),                 // CHECK(amount >= 0) in DDL
});

module.exports = {
  users,
  rolePermissions,
  auditLogs,
  buildings,
  rooms,
  tenants,
  appSettings,
  leases,
  reservations,
  maintenanceRecords,
  meterReadings,
  bills,
  payments,
  moveOutRecords,
  moveOutDeductions,
};
