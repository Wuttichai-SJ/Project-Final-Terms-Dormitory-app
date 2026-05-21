# Phase 2 — Authentication & RBAC (สำเร็จแล้ว ✅)

> **อ้างอิง:** `Plan-To-Make-Project.md` § Phase 2 | สร้างเมื่อ 2026-05-18

---

## สิ่งที่ทำในเฟสนี้

สร้างระบบ Authentication และ Role-Based Access Control (RBAC) ครบวงจร ตั้งแต่ IPC handlers ใน main process, in-memory session, จนถึง UI Login page, Sidebar ที่ filter menu ตาม permission, และหน้า User Management สำหรับ admin

---

## ไฟล์ที่สร้าง / แก้ไข

```
dormy-manager/
├── main/
│   ├── index.js                              ✅ แก้ไข — register authHandlers + userHandlers ก่อนเปิดหน้าต่าง
│   ├── database/
│   │   ├── schema.js                         ✅ แก้ไข — เพิ่ม mustChangePassword ใน users table
│   │   ├── migrate.js                        ✅ แก้ไข — เพิ่ม V2_DDL (ALTER TABLE + UPDATE admin), แก้ chain version
│   │   └── seed.js                           ✅ แก้ไข — admin ถูก seed ด้วย mustChangePassword: 1
│   ├── utils/
│   │   ├── auth.js                           ✅ ใหม่ — session, hashPassword, verifyPassword, buildPermissionMap
│   │   └── permission.js                     ✅ ใหม่ — requireAuth(), requirePermission(key)
│   └── handlers/
│       ├── authHandlers.js                   ✅ ใหม่ — auth:login, auth:logout, auth:me, auth:changePassword
│       └── userHandlers.js                   ✅ ใหม่ — user:list, user:create, user:update, user:resetPassword
└── renderer/src/
    ├── main.jsx                              ✅ แก้ไข — wrap <App> ด้วย <AuthProvider>
    ├── App.jsx                               ✅ แก้ไข — routing ตาม auth state (Login / AppLayout)
    ├── lib/
    │   └── ipc.js                            ✅ ใหม่ — invoke() wrapper สำหรับ window.electron.invoke
    ├── context/
    │   └── AuthContext.jsx                   ✅ ใหม่ — user state, login(), logout(), refreshUser()
    ├── hooks/
    │   └── usePermission.js                  ✅ ใหม่ — has(key) → bool
    ├── pages/
    │   ├── LoginPage.jsx                     ✅ ใหม่ — login form + force change password screen
    │   └── UserManagementPage.jsx            ✅ ใหม่ — CRUD users (admin only)
    └── components/layout/
        ├── Sidebar.jsx                       ✅ ใหม่ — nav filtered ตาม permission
        └── AppLayout.jsx                     ✅ ใหม่ — layout หลัก + page routing
```

---

## IPC Channels (Phase 2)

| Channel | สิทธิ์ | หน้าที่ |
|---|---|---|
| `auth:login` | ทุกคน | ตรวจ credentials → สร้าง session → return user + permissions |
| `auth:logout` | ทุกคน | ล้าง in-memory session |
| `auth:me` | ทุกคน | คืน session ปัจจุบัน (ใช้ตอน renderer โหลด) |
| `auth:changePassword` | ต้อง login | ตรวจ password เดิม → hash ใหม่ → ล้าง mustChangePassword |
| `user:list` | `users.manage` | ดึง users ทั้งหมด (ไม่รวม hash) |
| `user:create` | `users.manage` | สร้าง user ใหม่ (mustChangePassword = 1) |
| `user:update` | `users.manage` | แก้ fullName, phone, role, isActive |
| `user:resetPassword` | `users.manage` | set hash ใหม่ + mustChangePassword = 1 |

---

## Session (In-Memory)

Session เก็บใน main process memory — ล้างเมื่อ app ปิด (intentional: desktop offline security)

```js
// โครงสร้าง session object ที่เก็บใน main/utils/auth.js
{
  id:                 1,
  username:           'admin',
  fullName:           'ผู้ดูแลระบบ',
  phone:              null,
  role:               'admin',
  mustChangePassword: false,
  permissions: {
    'dashboard.view': true,
    'rooms.view':     true,
    'bills.delete':   true,
    'users.manage':   true,
    // ... 21 keys ทั้งหมด
  }
}
```

---

## Migration v2

```sql
-- เพิ่มคอลัมน์ must_change_password ใน users (DEFAULT 0)
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

-- force admin ที่ถูก seed ใน v1 ให้เปลี่ยนรหัสผ่านตอน login ครั้งแรก
UPDATE users SET must_change_password = 1 WHERE username = 'admin';
```

> หมายเหตุ: migrate.js ถูกแก้ให้แต่ละ version block set `user_version` เลขของตัวเอง (ไม่ใช้ CURRENT_VERSION รวม) เพื่อให้ chain ถูกต้องเมื่อมีหลาย version

---

## การใช้งาน Auth ในเฟสถัดไป

```js
// ใน main process handler — ตรวจ permission ก่อนทำงาน
const { requireAuth, requirePermission } = require('../utils/permission');

ipcMain.handle('room:delete', async (_event, { id }) => {
  try {
    requireAuth();
    requirePermission('rooms.delete');
    // ... logic
  } catch (err) {
    return { success: false, error: err.message };
  }
});
```

```js
// ใน React component — ซ่อน/แสดง UI ตาม permission
import { usePermission } from '../hooks/usePermission';

export function SomeComponent() {
  const { has } = usePermission();

  return (
    <div>
      {has('rooms.delete') && <DeleteButton />}
    </div>
  );
}
```

---

## App Flow (Auth)

```
เปิดแอป
  └─> AuthProvider mount → เรียก auth:me
        ├─ มี session  → setUser() → App แสดง AppLayout
        └─ ไม่มี session → user = null → App แสดง LoginPage

LoginPage: กรอก admin / admin1234
  └─> auth:login
        └─ success + mustChangePassword = true
              └─> LoginPage แสดง "ต้องเปลี่ยนรหัสผ่าน" screen
                    └─> กรอก current + new + confirm
                          └─> auth:changePassword
                                └─> success → refreshUser() → App แสดง AppLayout

Sidebar: filter NAV_ITEMS ด้วย has(permission)
  admin  → 9 เมนู (ทั้งหมด)
  staff  → 6 เมนู (ไม่มี Analytics, Users, AuditLog, Settings-edit)
```

---

## Key Decisions (บันทึกไว้เพื่อ phase ถัดไป)

1. **Session อยู่ใน memory ของ main process** — renderer ไม่เก็บ credentials เอง, ทุก permission check ที่ sensitive ต้องทำที่ main process เท่านั้น
2. **buildPermissionMap ทำครั้งเดียวตอน login** — map ถูกเก็บใน session แทนการ query DB ทุกครั้ง เพื่อประสิทธิภาพ ถ้า admin แก้ permission ของ role จะมีผลครั้งถัดไปที่ login เท่านั้น
3. **mustChangePassword = 1 สำหรับ user ที่สร้างโดย admin** — ทุก user ใหม่ต้องเปลี่ยนรหัสผ่านในครั้งแรกที่ login
4. **Error message login เป็น generic** — ใช้ข้อความเดียวกันสำหรับ wrong username กับ wrong password เพื่อป้องกัน username enumeration

---

## Success Criteria ✅

- [x] Login ด้วย admin / admin1234 ได้
- [x] ครั้งแรก force change password ก่อนเข้าใช้งานได้จริง -----> password
- [x] หลังเปลี่ยนรหัสผ่านแล้วเข้าสู่ AppLayout ได้
- [x] Logout แล้วกลับหน้า Login และ session ถูกล้าง
- [x] Admin เห็น sidebar ครบ 9 เมนู
- [x] Staff login แล้วเห็นเพียง 6 เมนู (ไม่มี Users, Analytics, AuditLog) ---> staff123
- [x] Admin สร้าง staff ใหม่ได้จากหน้า UserManagementPage
- [x] Staff ใหม่ต้องเปลี่ยนรหัสผ่านตอน login ครั้งแรก
- [x] Admin รีเซ็ตรหัสผ่านผู้ใช้อื่นได้
- [x] Admin ปิด/เปิดใช้งาน user ได้
- [x] Staff เข้าหน้า UserManagementPage โดยตรงแล้วเห็นข้อความ "ไม่มีสิทธิ์"

---

## ขั้นตอนถัดไป → Phase 3 (Master Data CRUD)

ตาม `Plan-To-Make-Project.md` § Phase 3:
- `main/handlers/buildingHandlers.js` — CRUD buildings
- `main/handlers/roomHandlers.js` — CRUD rooms + filter ตึก/ชั้น/สถานะ
- `main/handlers/tenantHandlers.js` — CRUD tenants + search
- `main/handlers/settingsHandlers.js` — get/update app_settings (admin only edit)
- `renderer/pages/RoomListPage.jsx` — grid card เหมือน prototype + filter
- `renderer/pages/TenantListPage.jsx` — table + search
- `renderer/pages/SettingsPage.jsx` — admin only
- เคารพ `rooms.status` state machine: Vacant → Occupied / Reserved / Maintenance
