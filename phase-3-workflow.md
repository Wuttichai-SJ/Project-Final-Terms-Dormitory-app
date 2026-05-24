# Phase 3 Workflow — Master Data CRUD

## Goal
Build full CRUD for Buildings, Rooms, Tenants, and App Settings — the core master data that every later phase (Lease, Billing, Move-Out) depends on.

---

## Files Read Before Starting

| File | Why |
|---|---|
| `.claude/skills/SKILL.md` | Code style rules: JS only, named exports, Thai UI, no hardcoded rates |
| `Plan-To-Make-Project.md` § Phase 3 | Scope checklist and success criteria |
| `main/database/schema.js` | Column names and types for all 4 tables (buildings, rooms, tenants, app_settings) |
| `main/database/seed.js` | Full PERMISSIONS matrix — confirmed keys: rooms.view/create/edit/delete, tenants.view/create/edit/delete, settings.view/edit |
| `main/handlers/authHandlers.js` | Handler pattern to follow (requireAuth, try/catch, { success, data/error }) |
| `main/utils/permission.js` | requireAuth() / requirePermission() signatures |
| `renderer/src/components/layout/Sidebar.jsx` | Existing nav items + permission keys |
| `renderer/src/components/layout/AppLayout.jsx` | Page routing pattern (renderPage switch) |
| `renderer/src/hooks/usePermission.js` | `has(key)` usage in components |
| `renderer/src/pages/UserManagementPage.jsx` | UI sub-component pattern to follow (Modal, Field, ModalActions, ErrorBox, inputCls) |

---

## What Was Built

### Backend — 4 new handler files

| File | IPC Channels |
|---|---|
| `main/handlers/buildingHandlers.js` | `building:list` `building:create` `building:update` `building:delete` |
| `main/handlers/roomHandlers.js` | `room:list` `room:create` `room:update` `room:delete` |
| `main/handlers/tenantHandlers.js` | `tenant:list` `tenant:get` `tenant:create` `tenant:update` `tenant:delete` |
| `main/handlers/settingsHandlers.js` | `settings:get` `settings:update` |

All handlers follow the established pattern:
- `requireAuth()` on every channel
- `requirePermission(key)` for write operations
- `try/catch` wrapping everything
- Return `{ success: true, data }` or `{ success: false, error }`

**Key safety rules enforced in handlers:**
- `room:list` — supports optional filters (buildingId, floor, status) with left-joins for building name and tenant name
- `room:update` — blocks manual setting of `Occupied` or `Reserved` status (managed by lease/reservation handlers in Phase 4)
- `room:delete` — only allows `Vacant` rooms to be deleted
- `tenant:delete` — only allows `MovedOut` tenants to be deleted (Active tenants must go through Move-Out first)
- `building:delete` — blocks if any rooms still exist in the building
- `settings:update` — snapshots `updatedByUserId` + `updatedAt` on every save

### Backend — `main/index.js` updated
Registered all 4 new handler sets after the existing auth + user handlers.

### Frontend — 3 new pages

| File | Features |
|---|---|
| `renderer/src/pages/RoomListPage.jsx` | Grid card view · Filter by building/floor/status · Add/Edit modal · Delete (Vacant only) · Status badge color-coded · Tenant name on occupied cards |
| `renderer/src/pages/TenantListPage.jsx` | Searchable table · 300ms debounced search · Add/Edit modal · Delete (MovedOut only) · Status badge |
| `renderer/src/pages/SettingsPage.jsx` | Rates form (all app_settings fields) · VAT toggle · Early-termination policy select · Building list with add/edit/delete · Read-only for staff |

### Frontend — Wiring

| File | Change |
|---|---|
| `renderer/src/components/layout/AppLayout.jsx` | Added imports for 3 new pages; added `rooms`, `tenants`, `settings` cases to `renderPage()` and `PAGE_LABELS` |
| `renderer/src/components/layout/Sidebar.jsx` | Added `tenants` nav item with `UserRound` icon and `tenants.view` permission; imported `UserRound` from lucide-react |

---

## Design Decisions

- **Room status state machine:** `room:update` handler rejects any attempt to manually set `Occupied` or `Reserved`. Those transitions belong to `lease:checkin` and `reservation:create` (Phase 4). The form shows the current status but marks it read-only with an explanatory message when it can't be changed.
- **Filter floors dynamically:** Floor filter options are derived from the current room list (not a fixed range), so the dropdown shows only floors that actually have rooms matching the other active filters.
- **Settings read-only for staff:** `settings.edit` permission is staff=0. Inputs are visually disabled (`bg-slate-50 cursor-not-allowed`) and a note is shown. Staff can still read rates for billing preview via `settings:get`.
- **Buildings in Settings page:** Building management sits inside SettingsPage (not its own sidebar item) because buildings are configuration, not operational data.

---

## Phase 3 Success Criteria (from Plan-To-Make-Project.md)

- [x] เพิ่ม/แก้ไข/ลบ ห้องพัก ครบ — with building + floor + status filters
- [x] เพิ่ม/แก้ไข/ลบ ผู้เช่า ครบ — with name/phone search
- [x] SettingsPage ใช้งานได้ (admin edit, staff read-only)
- [x] Building CRUD อยู่ใน SettingsPage
- [x] เคารพ rooms.status state machine — Occupied/Reserved ถูก block จากการแก้ด้วยตนเอง

---

## Files Created / Modified Summary

**Created:**
- `main/handlers/buildingHandlers.js`
- `main/handlers/roomHandlers.js`
- `main/handlers/tenantHandlers.js`
- `main/handlers/settingsHandlers.js`
- `renderer/src/pages/RoomListPage.jsx`
- `renderer/src/pages/TenantListPage.jsx`
- `renderer/src/pages/SettingsPage.jsx`

**Modified:**
- `main/index.js` — registered 4 new handler sets
- `renderer/src/components/layout/AppLayout.jsx` — added 3 page imports + routes
- `renderer/src/components/layout/Sidebar.jsx` — added ผู้เช่า nav item

---

## Bug Fixes Applied After Initial Build

### Fix: เพิ่มอาคารไม่ได้ — Building add never refreshed the list

**Root cause (1) — `onSaved` called `fetchBuildings()` which didn't exist after refactor.**
`BuildingsSection` originally called a named `fetchBuildings` function, which was later inlined into a `useEffect`. The `onSaved` callbacks still referenced the old function name, so calling them did nothing or threw.

**Root cause (2) — `useEffect` didn't re-run because there was no state change to trigger it.**
Even after fixing the function name, calling `fetchBuildings()` directly from `onSaved` bypassed React's data-flow model. If the function didn't also call `setLoading(true)`, the effect didn't visually update.

**Root cause (3) — `BuildingFormModal.handleSubmit` had no try/catch.**
If `invoke` threw (e.g., channel not registered because Electron main process wasn't restarted), the error was a silent unhandled rejection — `setError` was never called, and the button stayed frozen at "กำลังบันทึก..." with no user feedback.

**Fix applied to `SettingsPage.jsx`:**
1. Switched `BuildingsSection` to a `listVersion` state + `useEffect` pattern (with cancellation flag) for reliable list refresh.
2. Changed both `onSaved` callbacks to call `refresh()` (which increments `listVersion`) instead of `fetchBuildings()`.
3. Wrapped `invoke` in `BuildingFormModal.handleSubmit` with `try/catch/finally` so IPC errors surface as an `<ErrorBox>` and `setLoading(false)` is guaranteed to run.

```js
// After fix — BuildingFormModal.handleSubmit
try {
  const res = await invoke(channel, payload);
  if (res.success) onSaved();
  else setError(res.error);
} catch (err) {
  setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
} finally {
  setLoading(false);
}
```

---

## Fix: building:create ยังมี Error — "No handler registered"

**Root cause — Electron main process was never restarted after Phase 3 handlers were added.**
`ipcMain.handle` registrations only take effect when the main process starts. Unlike the renderer (Vite hot reload), the main process must be fully restarted (`Ctrl+C` → `npm run dev`) for new handlers to be available. Until restarted, any `invoke('building:create', ...)` call throws `Error: No handler registered for 'building:create'`.

**Secondary root cause — handler passed `address` column that didn't exist in older DBs.**
`buildingHandlers.js` destructured `address` from the payload and included `address: null` in every INSERT/UPDATE. If the database was created before `address TEXT` was added to the `buildings` table DDL, SQLite would throw `table buildings has no column named address`. Since the address field was already removed from the UI form, the fix was to drop it from the handler entirely.

**Fix applied to `main/handlers/buildingHandlers.js`:**
- Removed `address` from `building:create` and `building:update` parameter destructuring
- Removed `address: address?.trim() || null` from both `.values()` and `.set()` calls

---

## Feature: Floor Validation in RoomFormModal

**Problem:** A building configured with 5 floors allowed rooms to be added on floor 6, 10, or any number — there was no validation.

**Fix applied to `renderer/src/pages/RoomListPage.jsx`:**
1. Derived `selectedBuilding` from `buildings.find(b => b.id === Number(form.buildingId))` inside `RoomFormModal`.
2. Computed `maxFloor = selectedBuilding?.floors ?? null`.
3. Added pre-submit validation: if `maxFloor !== null && Number(form.floor) > maxFloor`, show error and return early.
4. Added `max={maxFloor || undefined}` on the floor `<input>` so the browser also enforces the limit.
5. Floor label shows the allowed range: `ชั้น * (1–5)` when building has floors set.
6. When the user switches building, floor is auto-clamped: if the current floor exceeds the new building's max, it resets to `newMax`.

---

## Feature: Remove Default Room Prices from Settings

**Problem:** SettingsPage had a "ราคาห้องพักเริ่มต้น" section with `fanRoomPrice` and `airRoomPrice` fields. The user prefers to set room prices manually per room when adding a room, not via global defaults.

**Fix applied:**
- `main/handlers/settingsHandlers.js` — removed `fanRoomPrice` and `airRoomPrice` from the payload destructuring and from the `db.update(appSettings).set({...})` call. The DB columns remain; they are simply no longer updated (preserving their last value).
- `renderer/src/pages/SettingsPage.jsx` — removed the "ราคาห้องพักเริ่มต้น" `<fieldset>` block entirely.

---

## UI Redesign: SettingsPage & RoomListPage

Both pages were redesigned to a modern, formal SaaS aesthetic while keeping all logic intact.

**Design system applied:**
| Token | Value |
|---|---|
| Card | `bg-white rounded-2xl border border-slate-200 shadow-sm` |
| Section sub-header | `text-[11px] font-bold text-slate-400 uppercase tracking-widest` |
| Input | `border-slate-200 rounded-xl px-3 py-2.5` with `focus:ring-2 focus:ring-indigo-500` |
| Primary button | `bg-indigo-600 rounded-xl font-semibold hover:bg-indigo-700` |
| Modal overlay | `bg-black/40 backdrop-blur-sm` |

**SettingsPage changes:**
- Wrapped RatesSection and BuildingsSection in white `rounded-2xl` cards with icon+title headers
- Form sections separated by dashed dividers with uppercase tracking labels
- VAT checkbox redesigned as a full-row clickable label with description
- Building list: code displayed as a colored square badge; edit/delete buttons appear on hover (`group-hover:opacity-100`)
- Empty state includes a quick-add link

**RoomListPage changes:**
- Stats bar (total / vacant / occupied / maintenance counts) embedded in the filter card
- "ล้างตัวกรอง" clear button appears only when a filter is active
- Skeleton pulse loader while fetching (replaces plain text)
- Room cards: colored dot status badge, bold room number, type chip, price + tenant rows, footer action bar with divider between แก้ไข and ลบ
- Modals use `backdrop-blur-sm` for depth

---

## UI Tweaks: SettingsPage Layout & Building Section Polish

### Responsive 2-column layout for SettingsPage
- Wrapped `RatesSection` and `BuildingsSection` in a CSS grid: `grid-cols-1 min-[1228px]:grid-cols-[1fr_380px]`
- Below 1228px: sections stack vertically (Buildings below Rates)
- At 1228px and above: Rates fills remaining width on the left, Buildings sits in a fixed 380px column on the right
- Used `items-start` so the shorter card doesn't stretch to match the taller one
- Removed `max-w-4xl` constraint so the layout uses full available width

### Building section polish
- Add building button: removed text label, kept icon only (`<Plus className="w-4 h-4" />`) with `title="เพิ่มอาคาร"` tooltip
- Building list items: increased padding (`px-4 py-3.5` → `px-5 py-4`), gap (`gap-3` → `gap-4`), code badge size (`w-9 h-9 text-sm` → `w-11 h-11 text-base`), item spacing (`space-y-1` → `space-y-2`) — overall larger, more breathable appearance

---

## Next Phase

**Phase 4 — Lease (Check-in / Check-out):**
- `leaseHandlers.js` — `lease:create` sets room → Occupied, `lease:checkout` sets room → Vacant
- `reservationHandlers.js` — reserve → convert to lease at check-in
- `LeaseManagementPage.jsx` — list + check-in flow
- Transactions wrap lease + room status update atomically
