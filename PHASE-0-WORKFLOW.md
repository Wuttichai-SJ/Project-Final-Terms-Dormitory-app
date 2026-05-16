# Phase 0 — Project Bootstrap Workflow

> เอกสารนี้สรุปสิ่งที่ทำใน **Phase 0** ของโปรเจกต์ Dormy Manager
> อ้างอิงจาก `Plan-To-Make-Project.md` หัวข้อ **Section 6 — Phase 0**
> สถานะ: ✅ **Phase 0 เสร็จสมบูรณ์** — พร้อมเริ่ม Phase 1 (Database Foundation)

---

## 1. เป้าหมายของเฟส (Goals)

สร้าง **skeleton** ของ Electron + React + Tailwind app ให้ใช้งานได้:
- เปิดหน้าต่างแอป (BrowserWindow) เห็น UI React 19
- Tailwind CSS render สี/styling ได้ถูกต้อง
- มี **IPC bridge** (main ↔ renderer) ทำงานครบ round-trip
- มี npm scripts สำหรับ dev / build / dist
- พร้อมต่อยอด Phase 1 ทันที (เพิ่ม SQLite + drizzle)

---

## 2. ไฟล์ที่สร้างทั้งหมด (12 ไฟล์)

```
dormy-manager/
├── package.json                   # deps + npm scripts + electron-builder config
├── vite.config.js                 # Vite rooted ที่ renderer/, port 5173
├── tailwind.config.js             # Tailwind v4 (informational — v4 ใช้ @source ใน CSS)
├── postcss.config.js              # @tailwindcss/postcss + autoprefixer
├── .gitignore                     # node_modules, dist, *.sqlite, .env
├── PHASE-0-WORKFLOW.md            # ← ไฟล์นี้
│
├── main/
│   ├── index.js                   # Electron main: BrowserWindow + ipcMain.handle('app:ping')
│   └── preload.js                 # contextBridge → window.electron.{invoke, on}
│
└── renderer/
    ├── index.html                 # entry HTML, mounts <div id="root">
    └── src/
        ├── main.jsx               # ReactDOM.createRoot + StrictMode
        ├── App.jsx                # "Hello Dormy" + ปุ่ม Ping Main Process
        └── index.css              # @import "tailwindcss"; + font-family
```

---

## 3. Tech Stack ที่ติดตั้ง

| Layer | Package | เวอร์ชัน (resolved) |
|---|---|---|
| Desktop shell | `electron` | 33.x |
| Build | `electron-builder` | 25.x |
| Bundler | `vite` | 6.x |
| Frontend | `react`, `react-dom` | 19.x |
| Vite plugin | `@vitejs/plugin-react` | 4.x |
| CSS | `tailwindcss` + `@tailwindcss/postcss` + `autoprefixer` + `postcss` | v4 |
| Icons | `lucide-react` | 0.469.x |
| Animation | `motion` | 11.x |
| Date | `date-fns` | 4.x |
| Charts | `recharts` | 2.x |
| Database (native) | `better-sqlite3` | 11.x — *not compiled yet, see §6* |
| ORM | `drizzle-orm` + `drizzle-kit` | 0.38.x / 0.30.x |
| Auth (native) | `bcrypt` | 5.x — *not compiled yet, see §6* |
| Dev | `concurrently`, `wait-on` | 9.x / 8.x |

> รวม **718 packages** หลังรัน `npm install`

---

## 4. Workflow ที่ทำตามลำดับ

### Step 1 — สร้างโฟลเดอร์โปรเจกต์ใหม่
- สร้าง `dormy-manager/` แยกจาก prototype `dormymanager---ระบบบริหารจัดการหอพัก/` ตามที่ผู้ใช้สั่ง
- prototype เก่ายังคงอยู่ใช้เป็น **reference UI** เท่านั้น

### Step 2 — เขียน `package.json` แบบเต็ม
- ใส่ deps + devDeps ทั้งหมดที่ระบุใน plan ตอนเดียว (เร็วกว่า `npm install` ทีละตัว)
- ตั้ง `"main": "main/index.js"` ให้ Electron เริ่มจาก entry ที่ถูกต้อง
- ตั้ง `"type": "commonjs"` เพราะ Electron main process ใช้ `require()`
- ใส่ `electron-builder` config ขั้นต้น (appId, outputDir, win target = nsis)

### Step 3 — `npm install` (เจอปัญหา + แก้)
- **ปัญหา:** `better-sqlite3` และ `bcrypt` เป็น native modules ที่ต้อง compile จาก C++
  - ไม่มี prebuilt binaries สำหรับ Node 24.7.0 (ตัวที่ user ใช้)
  - Visual Studio C++ toolset ไม่ได้ติดตั้งบนเครื่อง
  - ผลคือ `npm install` rollback ทั้งหมด
- **วิธีแก้ในเฟสนี้:**
  - รัน `npm install --ignore-scripts --no-audit --no-fund`
  - ข้าม postinstall ของ native modules → JS-only packages ติดตั้งครบ
  - **Phase 0 ไม่ต้องใช้ better-sqlite3/bcrypt** — รอ Phase 1 ค่อยจัดการ
- **ผลข้างเคียง:** Electron binary ก็ไม่ดาวน์โหลด (เพราะถูก skip)
  - แก้โดยรัน `node node_modules/electron/install.js` ด้วยตัวเอง
  - ดาวน์โหลด `electron.exe` ~188 MB สำเร็จ

### Step 4 — เขียน Config ไฟล์
- **vite.config.js** — root = `renderer/`, build outDir = `renderer/dist/`, dev server :5173 (strictPort)
- **postcss.config.js** — ใส่ `@tailwindcss/postcss` (Tailwind v4 plugin) + `autoprefixer`
- **tailwind.config.js** — minimal เพราะ v4 ใช้ `@source` directive ใน CSS แทน
- **ปัญหา:** เขียนเริ่มต้นเป็น ESM `export default` แต่ Node parse เป็น CommonJS (เพราะ `"type": "commonjs"`)
- **แก้:** เปลี่ยนเป็น `module.exports = {...}` ทั้ง 3 ไฟล์ + `require()` ใน `vite.config.js`

### Step 5 — เขียน Electron Main Process
- **main/index.js**
  - `app.whenReady().then(createMainWindow)`
  - BrowserWindow 1280×800, min 1024×700
  - Security flags ตาม plan: `nodeIntegration: false`, `contextIsolation: true`
  - Dev mode → load `http://localhost:5173`, เปิด devtools (detached)
  - Prod mode → load `renderer/dist/index.html`
  - **Smoke-test IPC handler:** `ipcMain.handle('app:ping', ...)` คืน `{success, data:{message, timestamp, electronVersion, nodeVersion}}`
  - Quit เมื่อปิดทุก window (ยกเว้น macOS ตามธรรมเนียม)

### Step 6 — เขียน Preload (Context Bridge)
- **main/preload.js**
  - Expose `window.electron.invoke(channel, payload)` → wrap `ipcRenderer.invoke`
  - Expose `window.electron.on(channel, listener)` → คืน unsubscribe function (สำคัญสำหรับ React useEffect cleanup)
  - **ไม่ expose Node.js API ใด ๆ** — เฉพาะ 2 method นี้เท่านั้น (กฎ security ตาม plan)

### Step 7 — เขียน React Skeleton
- **renderer/index.html** — มี `<div id="root">`, lang="th", script type="module" → `/src/main.jsx`
- **renderer/src/main.jsx** — `ReactDOM.createRoot` + `<StrictMode>`
- **renderer/src/index.css** — `@import "tailwindcss";` + `@source` directives (Tailwind v4 syntax) + font stack รองรับภาษาไทย (Sarabun fallback)
- **renderer/src/App.jsx** — Phase 0 smoke screen:
  - แสดง "Hello Dormy" พร้อม icon (`lucide-react`)
  - 4 status pills: React 19 / Vite+Tailwind / Electron Shell / IPC Bridge
  - ปุ่ม **"Ping Main Process"** เรียก `window.electron.invoke('app:ping')`
  - แสดงผลลัพธ์ (message, electron version, node version, timestamp) ใน panel สีเขียว
  - Disable ปุ่มถ้าไม่เจอ `window.electron` (กัน error ตอน dev เปิดผ่าน browser ตรง)

### Step 8 — npm Scripts
| Script | คำสั่งจริง | ใช้ตอนไหน |
|---|---|---|
| `npm run dev:renderer` | `vite` | start Vite dev server (:5173) |
| `npm run dev:electron` | `wait-on http://localhost:5173 && electron .` | รอ Vite พร้อม แล้วเปิด Electron |
| `npm run dev` | `concurrently ... npm:dev:renderer npm:dev:electron` | คำสั่งหลักตอนพัฒนา — เปิดทั้งสองพร้อมกัน |
| `npm run build:renderer` | `vite build` | bundle React → `renderer/dist/` |
| `npm run build` | (alias) | สำหรับ Phase 0 = `build:renderer` |
| `npm run dist` | `npm run build && electron-builder` | สร้าง `.exe` installer (Phase 11) |
| `postinstall` | `electron-builder install-app-deps` | (deferred — รัน manual ใน Phase 1) |

### Step 9 — Validate ว่า build ใช้ได้
- `npx vite build` → สำเร็จ
  - 1579 modules transformed
  - `dist/index.html` 0.40 kB
  - `dist/assets/index-*.css` 10.93 kB (Tailwind v4 JIT ใช้คลาสจริงเท่าที่ App.jsx เรียก)
  - `dist/assets/index-*.js` 199.43 kB (React + lucide + App)
- `node --check main/index.js` + `node --check main/preload.js` → SYNTAX OK
- `npx electron --version` → `v33.4.11`

---

## 5. ปัญหาที่เจอ + วิธีแก้ (สำหรับ future reference)

| # | ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|---|
| 1 | `npm install` rollback ทั้งหมด เพราะ `better-sqlite3` build fail | ไม่มี VS C++ toolset + ไม่มี prebuild สำหรับ Node 24 | ใช้ `--ignore-scripts` ข้าม native compile, ใส่ TODO รอ Phase 1 |
| 2 | Electron binary ไม่ถูกดาวน์โหลด | `--ignore-scripts` ข้าม postinstall ของ `electron` ด้วย | รัน `node node_modules/electron/install.js` แยก |
| 3 | Vite build error: `Unexpected token 'export'` ที่ `postcss.config.js` | `"type": "commonjs"` ใน package.json ทำให้ `.js` ทุกไฟล์ parse เป็น CJS | เปลี่ยน `export default` → `module.exports` ใน 3 config files |

---

## 6. ⚠️ Known Issues / Open Items (จะแก้ใน Phase 1)

### 6.1 Native modules ยังไม่ rebuild สำหรับ Electron
- `better-sqlite3` และ `bcrypt` ติดตั้งแล้ว แต่ **ยังไม่ compile**
- เมื่อเริ่ม Phase 1 ต้องรัน 1 ใน 2 ทาง:
  - **ทาง A (แนะนำ):** ติดตั้ง Visual Studio Build Tools (Desktop development with C++) แล้วรัน `npx electron-rebuild`
  - **ทาง B:** ใช้ prebuilt binaries สำหรับ Electron — `npx @electron/rebuild` ลอง pull prebuilds ก่อน fallback ไป compile
- ถ้า import `better-sqlite3` ตอนนี้จะ throw `Cannot find module` หรือ ABI mismatch error

### 6.2 หัวข้อจาก plan ที่ "open" ตั้งแต่ Phase 0
ตาม `Plan-To-Make-Project.md` Section 10:
- [ ] เลือกระหว่าง `npm` กับ `pnpm` — **ใช้ npm ไปก่อน** (ตามที่ผู้ใช้มีติดเครื่อง)
- [ ] กลยุทธ์ rebuild native modules ตอน package — รอ Phase 6/11

---

## 7. วิธีรันโปรเจกต์ (สำหรับผู้ใช้)

```bash
cd dormy-manager

# (ครั้งเดียวหลังจาก clone — ไม่ต้องรันเพราะติดตั้งแล้ว)
npm install --ignore-scripts
node node_modules/electron/install.js

# Dev mode — เปิด Vite + Electron พร้อมกัน
npm run dev

# Build renderer แบบ production (ตรวจสอบไฟล์ใน renderer/dist/)
npm run build

# (Phase 11) สร้าง .exe installer
npm run dist
```

**คาดหวังตอนรัน `npm run dev`:**
1. Terminal เห็น 2 process — `VITE` (สีน้ำเงิน) และ `ELECTRON` (สีม่วง)
2. หน้าต่าง Electron เปิด ขนาด 1280×800
3. เห็น card สีขาว มี "Hello Dormy" + icon บ้าน + 4 status pills (เขียวทั้งหมด)
4. กดปุ่ม **Ping Main Process** → ขึ้น panel สีเขียว แสดง electron version + node version + timestamp
5. แก้ `App.jsx` → hot reload เปลี่ยน UI ทันที (HMR ผ่าน Vite)

---

## 8. Success Criteria (จาก plan) — สถานะ

| Criteria | สถานะ |
|---|---|
| `npm init` + ติดตั้ง deps ครบ | ✅ (native modules ติดตั้งแต่ยังไม่ compile — defer Phase 1) |
| ตั้ง `vite.config.js`, `tailwind.config.js`, `postcss.config.js` | ✅ |
| สร้าง `main/index.js` (BrowserWindow + load vite dev server) | ✅ |
| สร้าง `main/preload.js` (contextBridge: invoke, on) | ✅ |
| npm scripts: `dev`, `build`, `dist` | ✅ |
| Smoke test: window เปิด, hot reload, IPC ping/pong | ⏳ ผู้ใช้รัน `npm run dev` เพื่อยืนยัน UI (validate ฝั่ง build/syntax แล้ว) |
| **เปิดแอปแล้วเห็น "Hello Dormy" จาก React + กดปุ่มเรียก IPC ได้** | ⏳ รอผู้ใช้ทดสอบจริง |

---

## 9. Next Step → Phase 1 (Database Foundation)

ตามที่ plan ระบุ:
1. ติดตั้ง VS Build Tools + รัน `npx electron-rebuild` เพื่อ compile `better-sqlite3` + `bcrypt` สำหรับ Electron ABI
2. สร้าง `main/database/client.js` — เปิด SQLite ที่ `app.getPath('userData')/dormy.sqlite`
3. สร้าง `main/database/schema.js` — drizzle schema **ครบ 14 ตาราง** ตาม `Database-schema.md`
4. ตั้ง `drizzle.config.js` + generate migration แรก
5. รัน migration ตอน app boot (idempotent)
6. สร้าง `main/database/seed.js` — admin user + role_permissions 22 rows + app_settings + อาคารแรก

**Success criteria Phase 1:** เปิดแอปครั้งแรกแล้ว `.sqlite` ถูกสร้าง มี admin 1 คน + permission rows ครบ + DB browser เปิดดูได้

---

_เอกสารอัปเดตล่าสุด: 2026-05-16_
