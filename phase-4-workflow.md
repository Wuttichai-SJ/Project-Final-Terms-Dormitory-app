# Phase 4 Workflow — Lease (Check-in) & Reservations

## Goal
Build the Lease lifecycle entry point: signing a new lease (= Check-in) and the
Reservation flow (reserve a Vacant room → later convert to a lease). Every
state-changing operation runs inside a single SQLite transaction so the
`leases`, `rooms`, `reservations`, and `tenants` tables can never drift out of
sync. An audit log row is written for every transition.

---

## Files Read Before Starting

| File | Why |
|---|---|
| `.claude/skills/SKILL.md` | Code style rules: JS only, named exports, Thai UI, no hardcoded rates |
| `Plan-To-Make-Project.md` § Phase 4 (lines 430–441) | Scope checklist + success criteria — `lease:create` transaction, `monthly_rent_snapshot`, reservation→lease conversion, audit log |
| `phase-3-workflow.md` | Format reference for this file + handler/page conventions |
| `main/database/schema.js` | Confirmed columns for `leases`, `reservations`, `rooms`, `tenants`, `audit_logs` |
| `main/database/seed.js` | Confirmed permission keys `lease.checkin` (admin + staff) and `lease.checkout` (admin only) |
| `main/handlers/roomHandlers.js` | Handler pattern + state-machine guard (Occupied/Reserved blocked from manual edit) |
| `main/handlers/tenantHandlers.js` | Handler pattern + UNIQUE-constraint error handling |
| `main/database/client.js` | `getSqlite()` is available for raw `sqlite.transaction()` blocks |
| `main/utils/auth.js`, `main/utils/permission.js` | `requireAuth()`, `requirePermission()`, session shape |
| `renderer/src/components/Pagination.jsx` | Reused for both lease + reservation tables (10 rows/page) |
| `renderer/src/components/layout/Sidebar.jsx` | Existing `leases` nav entry — only needed permission-key fix |

---

## What Was Built

### Backend — 1 utility + 2 new handler files

| File | Exports |
|---|---|
| `main/utils/audit.js` | `writeAudit({ action, entityType, entityId, payload })` — inserts into `audit_logs` using the current session user. Designed to be called *inside* a `sqlite.transaction()` block so the log commits or rolls back atomically with the change. |
| `main/handlers/leaseHandlers.js` | `lease:list` · `lease:get` · `lease:create` (Check-in) |
| `main/handlers/reservationHandlers.js` | `reservation:list` · `reservation:create` · `reservation:cancel` · `reservation:checkin` (convert reservation → lease) |

All handlers follow the established pattern:
- `requireAuth()` on every channel
- `requirePermission('lease.checkin')` for every state-changing channel
- `try/catch` wrapping everything, returns `{ success: true, data }` or `{ success: false, error }`
- Pre-flight validation **outside** the transaction so the client gets clean Thai error messages
- `sqlite.transaction(() => { ... })()` wraps every multi-step write so rollback is guaranteed on any throw

**Key safety rules enforced:**
- `lease:create`
  - Tenant must exist and be `Active`
  - Tenant must not already have another `Active` lease
  - Room must exist and be `Vacant`
  - `monthly_rent_snapshot` is **read from `rooms.base_price` at INSERT time** — never recomputed later
- `reservation:create`
  - Room must exist and be `Vacant` (so reserving a room nobody can take is impossible)
  - Sets the room to `Reserved` inside the same transaction
- `reservation:cancel`
  - Only `Active` reservations can be cancelled
  - Defensive: only flips the room back to `Vacant` if it is still `Reserved` (so a room that was manually flipped to Maintenance keeps that status)
- `reservation:checkin`
  - Reservation must be `Active`
  - Room must be `Reserved` *or* `Vacant` (covers the rare case where the room was manually freed before check-in)
  - Two tenant modes: link to an existing `Active` tenant **or** create a fresh tenant from the reservation snapshot
  - Deposit on the reservation carries over to the new lease
  - Sets room → `Occupied`, reservation → `CheckedIn`, lease → `Active` in one transaction

### Backend — `main/index.js` updated
Imports and registers both new handler sets after the existing settings handlers.

### Frontend — 1 new page

| File | Features |
|---|---|
| `renderer/src/pages/LeaseListPage.jsx` | Two-tab UI (สัญญาเช่า / การจอง). Lease tab: status filter chips · paginated table (10 rows) · "เซ็นสัญญาใหม่" modal picks tenant + Vacant room + dates + deposit. Reservation tab: status filter chips · paginated table · "จองห้องใหม่" modal · per-row [เช็คอิน] [ยกเลิก] actions. Check-in-from-reservation modal supports both "create new tenant" and "link existing tenant" modes. |

### Frontend — Wiring

| File | Change |
|---|---|
| `renderer/src/components/layout/AppLayout.jsx` | Added `LeaseListPage` import and `'leases'` route case |
| `renderer/src/components/layout/Sidebar.jsx` | Fixed `leases` nav permission key from `'rooms.view'` → `'lease.checkin'` (matches the actual permission gate on backend writes) |

---

## Design Decisions

- **Transactions, not optimistic state.** Every multi-step write (lease+room, reservation+room, reservation→lease+tenant+room) runs inside `sqlite.transaction(() => { ... })()`. If any step throws, the whole change is rolled back — there is no scenario where a room ends up `Occupied` without a matching `Active` lease, or vice versa.
- **`monthly_rent_snapshot` is frozen at signing.** The handler reads `room.base_price` once during `lease:create` and writes it to the lease row. Changing `rooms.base_price` later does not retroactively change any past lease. This is the foundation for the Phase 6 billing snapshot pattern.
- **Reservation deposit carries forward.** When converting a reservation → lease, the deposit recorded on the reservation row becomes the lease's deposit. The user does not have to retype it.
- **Two tenant modes on check-in-from-reservation.** A reservation stores the walk-in's details on the reservation row itself (not in `tenants`). At check-in time, the staff can either (a) create a fresh `tenants` row from that snapshot, or (b) link to an existing `Active` tenant if the walk-in was actually a returning customer. Mode (a) is the default.
- **Defensive room-state checks on cancel.** `reservation:cancel` only flips the room back to `Vacant` if it is still `Reserved`. This avoids clobbering a room that a separate process moved into Maintenance (or any other state) while the reservation was open.
- **Audit log lives in a util, not inline.** Phase 4+ needs to write audit rows in many places. `main/utils/audit.js` exists so each handler is one line: `writeAudit({ action, entityType, entityId, payload })`. It reads the user id from the in-memory session, so handlers never have to plumb the session through.
- **Lease check-out NOT included in Phase 4.** The plan's Phase 4 checklist asks only for `lease:create`. The full move-out flow (deposit refund, deductions, early-termination penalty) is Phase 8. The `lease.checkout` permission exists in the seed already — it will be consumed by `moveOutHandlers.js` later.

---

## Phase 4 Success Criteria (from Plan-To-Make-Project.md)

- [x] `leaseHandlers.js` exists with `lease:create` running INSERT lease + UPDATE rooms inside a single transaction
- [x] `reservationHandlers.js` supports reserve + convert-reservation-to-lease
- [x] `LeaseManagementPage.jsx` (named `LeaseListPage` here) lists leases and has the check-in flow
- [x] `monthly_rent_snapshot` is recorded at signing from `rooms.base_price`
- [x] Audit log row written on every state change (`lease.checkin`, `reservation.create`, `reservation.cancel`, `reservation.checkin`)
- [x] Room status auto-transitions: Vacant → Occupied on check-in, Vacant → Reserved on reserve, Reserved → Vacant on cancel, Reserved → Occupied on convert
- [x] History preserved in `leases` table (every lease keeps its row regardless of status)

---

## Files Created / Modified Summary

**Created:**
- `main/utils/audit.js`
- `main/handlers/leaseHandlers.js`
- `main/handlers/reservationHandlers.js`
- `renderer/src/pages/LeaseListPage.jsx`

**Modified:**
- `main/index.js` — registered the 2 new handler sets
- `renderer/src/components/layout/AppLayout.jsx` — added `'leases'` route + `LeaseListPage` import
- `renderer/src/components/layout/Sidebar.jsx` — fixed `leases` permission key to `lease.checkin`

---

## IPC Channels Added

| Channel | Permission | Description |
|---|---|---|
| `lease:list` | `rooms.view` | Returns leases joined with tenant + room + building; optional `status`/`tenantId`/`roomId` filters |
| `lease:get` | `rooms.view` | One lease by id with the same join shape |
| `lease:create` | `lease.checkin` | Transaction: INSERT lease + UPDATE rooms → Occupied + audit |
| `reservation:list` | `rooms.view` | Returns reservations joined with room + building; optional `status` filter |
| `reservation:create` | `lease.checkin` | Transaction: INSERT reservation + UPDATE rooms → Reserved + audit |
| `reservation:cancel` | `lease.checkin` | Transaction: UPDATE reservation → Cancelled + UPDATE rooms → Vacant + audit |
| `reservation:checkin` | `lease.checkin` | Transaction: (resolve/create tenant) + INSERT lease + UPDATE rooms → Occupied + UPDATE reservation → CheckedIn + audit |

All channels return `{ success, data }` on success or `{ success: false, error }` (Thai) on failure.

---

## Gotchas to Remember

- **Electron main process must be restarted after adding handlers.** `ipcMain.handle` registrations only take effect at process boot. `Ctrl+C` → `npm run dev` is required; Vite hot reload only updates the renderer.
- **`getSqlite()` is the entry point for transactions.** Drizzle does not expose a transaction wrapper in the version pinned here, so `getSqlite().transaction(fn)()` is the canonical pattern. Don't try to nest drizzle's API inside it — call drizzle methods *inside* the transaction callback; better-sqlite3 ties them all to the same connection automatically.
- **Audit log writes need a session.** `writeAudit` silently no-ops if `getSession()` returns null (e.g. boot-time seeding). All Phase 4 channels run after `requireAuth()` so a session is guaranteed by then.
- **Room state is the source of truth for what's "Vacant".** The check-in modal queries `room:list?status=Vacant` for its dropdown — so a room reserved by another staffer immediately disappears from the picker on next open.

---

## Next Phase

**Phase 5 — Meter Reading (~0.5 วัน):**
- `meterHandlers.js` — `meter:record` (room/period), `meter:getByRoom`
- Unique guard `(room_id, year, month)` before insert
- Sync `rooms.last_elec_reading` + `last_water_reading` back to `rooms` on every record
- `MeterReadingForm.jsx` — per-room form, with frontend + backend guard for `current >= previous`
