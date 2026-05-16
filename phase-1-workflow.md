# Phase 1 — Database Foundation (สำเร็จแล้ว ✅)

> **อ้างอิง:** `Plan-To-Make-Project.md` § Phase 1 | สร้างเมื่อ 2026-05-16

---

## สิ่งที่ทำในเฟสนี้

สร้างโครงสร้างฐานข้อมูลทั้งหมดสำหรับ Dormy Manager โดยใช้ better-sqlite3 + drizzle-orm และเชื่อมต่อกับ Electron main process แล้ว

---

## ไฟล์ที่สร้าง / แก้ไข

```
dormy-manager/
├── drizzle.config.js                    ✅ ใหม่ — drizzle-kit CLI config (dev tooling)
├── main/
│   ├── index.js                         ✅ แก้ไข — เพิ่ม initDatabase() + runSeed() ก่อนเปิดหน้าต่าง
│   └── database/
│       ├── schema.js                    ✅ ใหม่ — drizzle table definitions ครบ 15 ตาราง
│       ├── migrate.js                   ✅ ใหม่ — raw SQL DDL + triggers + indexes + PRAGMA user_version
│       ├── client.js                    ✅ ใหม่ — เปิด DB, รัน migration, export getDb() / getSqlite()
│       └── seed.js                      ✅ ใหม่ — seed admin, role_permissions, app_settings, building
```

---

## ตารางทั้งหมด (15 ตาราง)

| กลุ่ม | ตาราง |
|---|---|
| Auth & Access | `users`, `role_permissions`, `audit_logs` |
| Master Data | `buildings`, `rooms`, `tenants`, `app_settings` |
| Operations | `leases`, `reservations`, `maintenance_records`, `meter_readings` |
| Billing & Payment | `bills`, `payments`, `move_out_records`, `move_out_deductions` |

---

## Migration Strategy

- ใช้ `PRAGMA user_version` ติดตาม schema version (ปัจจุบัน = 1)
- `migrate.js` รัน `V1_DDL` ใน transaction เดียว → ถ้า fail จะ ROLLBACK อัตโนมัติ
- Idempotent: ทุก statement ใช้ `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- เพิ่ม migration ใหม่ในอนาคต: เพิ่ม block `if (currentVersion < 2)` ใน `runMigrations()` — **ห้ามแก้ V1_DDL**

---

## Triggers (auto-update `updated_at`)

| Trigger | ตาราง |
|---|---|
| `trg_users_updated_at` | `users` |
| `trg_rooms_updated_at` | `rooms` |
| `trg_tenants_updated_at` | `tenants` |

---

## Indexes

| Index | ใช้สำหรับ |
|---|---|
| `idx_rooms_status` | filter ห้องตามสถานะ |
| `idx_rooms_building` | filter ห้องตามตึก |
| `idx_tenants_idcard` | ค้นหาผู้เช่าจากบัตรประชาชน |
| `idx_tenants_name` | ค้นหาผู้เช่าจากชื่อ |
| `idx_leases_active` | หา active lease ของห้อง |
| `idx_bills_period` | query บิลตามเดือน/ปี |
| `idx_bills_status` | filter บิลตามสถานะ |
| `idx_bills_due` | partial index: หาบิลค้างชำระที่ถึงกำหนด |
| `idx_meter_period` | query มิเตอร์ตามห้อง/เดือน/ปี |
| `idx_audit_user_time` | ดู audit log ตาม user + เวลา |

---

## Seed Data (ใส่ครั้งแรกที่บูต)

| ข้อมูล | รายละเอียด |
|---|---|
| Admin user | `username: admin` / `password: admin1234` (ต้องเปลี่ยนรหัสผ่านตอน login ครั้งแรก) |
| role_permissions | 42 rows (21 permission_keys × 2 roles) — ดูตารางด้านล่าง |
| app_settings | id=1, ค่า default: ไฟ 8บ/หน่วย, น้ำ 33บ/หน่วย, ค่าน้ำขั้นต่ำ 120บ, ขยะ 40บ, ส่วนกลาง 100บ, เน็ต 300บ, VAT=7% (ปิดอยู่), policy=A |
| Building | `code: '1'`, `name: 'อาคารหลัก'` |

### Permission Matrix

| permission_key | admin | staff |
|---|:---:|:---:|
| `dashboard.view` | ✅ | ✅ |
| `rooms.view` | ✅ | ✅ |
| `rooms.create` | ✅ | ✅ |
| `rooms.edit` | ✅ | ✅ |
| `rooms.delete` | ✅ | ❌ |
| `tenants.view` | ✅ | ✅ |
| `tenants.create` | ✅ | ✅ |
| `tenants.edit` | ✅ | ✅ |
| `tenants.delete` | ✅ | ❌ |
| `lease.checkin` | ✅ | ✅ |
| `lease.checkout` | ✅ | ❌ |
| `bills.create` | ✅ | ✅ |
| `bills.markpaid` | ✅ | ✅ |
| `bills.delete` | ✅ | ❌ |
| `bills.print` | ✅ | ✅ |
| `summary.view` | ✅ | ✅ |
| `analytics.view` | ✅ | ❌ |
| `settings.view` | ✅ | ✅ |
| `settings.edit` | ✅ | ❌ |
| `users.manage` | ✅ | ❌ |
| `audit.view` | ✅ | ❌ |

---

## การใช้งาน DB ในเฟสถัดไป

```js
// ใน main process handler ทุกไฟล์ — ดึง db instance จาก singleton
const { getDb, getSqlite } = require('../database/client');

// drizzle ORM queries
const db = getDb();
const result = db.select().from(users).where(eq(users.username, 'admin')).get();

// raw SQL transaction (ใช้เมื่อต้องการ atomic multi-table write)
const sqlite = getSqlite();
const txFn = sqlite.transaction(() => {
  // ... หลาย statements
});
txFn();
```

---

## Key Decisions (บันทึกไว้เพื่อ phase ถัดไป)

1. **VAT เป็น global** — `rooms.vat_rate` / `rooms.vat_enabled` ยังอยู่ใน schema แต่ deprecated แล้ว ห้ามใช้ในการคำนวณ ใช้ `app_settings.default_vat_rate` + `app_settings.vat_enabled` แทน
2. **Early termination** — `move_out_records` มีคอลัมน์ใหม่: `is_early_termination`, `early_penalty_amount`, `policy_used`, `original_end_date` และ `app_settings.early_termination_policy` (default: 'A' = forfeit เต็ม deposit)
3. **Native modules** — หลัง `npm install` ต้องรัน `npm run postinstall` เพื่อ rebuild `better-sqlite3` และ `bcrypt` สำหรับ Electron ABI ก่อนรัน `npm run dev`

---

## Success Criteria ✅ (ยืนยันด้วย integration test)

- [x] เปิดแอปครั้งแรกแล้ว `dormy.sqlite` ถูกสร้างใน userData
- [x] มี 15 tables + `sqlite_sequence`
- [x] 3 triggers สำหรับ `updated_at`
- [x] 10 indexes
- [x] `user_version = 1`
- [x] Admin user 1 คน (bcrypt hash ถูกต้อง)
- [x] role_permissions 42 rows ครบ
- [x] app_settings (id=1) ค่า default ถูกต้อง
- [x] Default building สร้างแล้ว
- [x] รัน seed ซ้ำแล้วไม่มี duplicate (idempotent)

---

## ขั้นตอนถัดไป → Phase 2 (Authentication & RBAC)

ตาม `Plan-To-Make-Project.md` § Phase 2:
- `main/utils/auth.js` — `hashPassword`, `verifyPassword`, in-memory session
- `main/utils/permission.js` — `requirePermission(userId, key)`
- `main/handlers/authHandlers.js` — `auth:login`, `auth:logout`, `auth:me`, `auth:changePassword`
- `main/handlers/userHandlers.js` — CRUD users (admin only)
- `renderer/context/AuthContext.jsx` — current user + permissions
- `renderer/hooks/usePermission.js` — `has('bills.delete')`
- Login page + force change password on first login
- User Management page (admin only)
