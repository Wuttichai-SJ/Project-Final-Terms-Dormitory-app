// Unit tests for the lease status state-machine — the "dormitory rules" that
// govern which leases show up in the ประวัติ (History) tab on LeaseListPage,
// and which transitions/guards the backend enforces.
//
// No new dependencies. Run with the built-in Node test runner:
//     node --test tests/lease-status.test.js
//
// Each rule under test is mirrored as a small pure function. If the real code
// in renderer/src/pages/LeaseListPage.jsx or main/handlers/leaseHandlers.js
// changes its rule, update the mirrored function here so the test stays a
// faithful contract of the dormitory policy.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ─── Rules mirrored from production code ─────────────────────────────────────

// LeaseListPage.jsx — LEASE_STATUS_LABEL
const LEASE_STATUS_LABEL = {
  Active:     'พักอยู่',
  Completed:  'ครบกำหนด',
  Terminated: 'ยกเลิกก่อนกำหนด',
};

const VALID_LEASE_STATUSES = ['Active', 'Completed', 'Terminated'];

// HistoryTab — `data.filter(l => l.status !== 'Active')`
function filterHistory(leases) {
  return leases.filter(l => l.status !== 'Active');
}

// HistoryTab — sub-filter chip behaviour (ทั้งหมด / ครบกำหนด / ยกเลิกก่อนกำหนด)
function applyHistoryFilter(historyLeases, statusFilter) {
  return statusFilter
    ? historyLeases.filter(l => l.status === statusFilter)
    : historyLeases;
}

// leaseHandlers.js `lease:terminate` — guard: only Active can be terminated
function canTerminate(lease) {
  return lease.status === 'Active';
}

// leaseHandlers.js `lease:terminate` transaction — defensive room-release rule:
// flip room to Vacant ONLY if it is currently Occupied by this very tenant.
function shouldFreeRoom(room, lease) {
  return room.status === 'Occupied' && room.currentTenantId === lease.tenantId;
}

// leaseHandlers.js `lease:create` — room must be Vacant to receive a new lease
function canCreateLeaseInRoom(room) {
  return room.status === 'Vacant';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Dormitory rule: valid lease statuses', () => {
  test('only three statuses are recognised', () => {
    assert.deepEqual([...VALID_LEASE_STATUSES].sort(),
                     ['Active', 'Completed', 'Terminated'].sort());
  });

  test('every valid status has a Thai label', () => {
    for (const s of VALID_LEASE_STATUSES) {
      assert.ok(LEASE_STATUS_LABEL[s], `missing label for ${s}`);
    }
  });

  test('Thai labels match the visible UI strings', () => {
    assert.equal(LEASE_STATUS_LABEL.Active,     'พักอยู่');
    assert.equal(LEASE_STATUS_LABEL.Completed,  'ครบกำหนด');
    assert.equal(LEASE_STATUS_LABEL.Terminated, 'ยกเลิกก่อนกำหนด');
  });
});

describe('Dormitory rule: ประวัติ (History) tab membership', () => {
  test('Active leases never appear in the history tab', () => {
    const leases = [
      { id: 1, status: 'Active' },
      { id: 2, status: 'Completed' },
      { id: 3, status: 'Terminated' },
      { id: 4, status: 'Active' },
    ];
    const history = filterHistory(leases);
    assert.equal(history.length, 2);
    assert.ok(history.every(l => l.status !== 'Active'));
  });

  test('both Completed and Terminated leases appear in history', () => {
    const leases = [
      { id: 1, status: 'Completed' },
      { id: 2, status: 'Terminated' },
    ];
    const history = filterHistory(leases);
    assert.equal(history.length, 2);
    assert.ok(history.some(l => l.status === 'Completed'));
    assert.ok(history.some(l => l.status === 'Terminated'));
  });

  test('all-Active dataset yields an empty history tab', () => {
    const leases = [
      { id: 1, status: 'Active' },
      { id: 2, status: 'Active' },
    ];
    assert.deepEqual(filterHistory(leases), []);
  });

  test('empty input is safe', () => {
    assert.deepEqual(filterHistory([]), []);
  });
});

describe('Dormitory rule: ประวัติ chip filters (ทั้งหมด / ครบกำหนด / ยกเลิกก่อนกำหนด)', () => {
  const history = [
    { id: 1, status: 'Completed' },
    { id: 2, status: 'Terminated' },
    { id: 3, status: 'Completed' },
    { id: 4, status: 'Terminated' },
  ];

  test('"ทั้งหมด" returns every history row', () => {
    assert.equal(applyHistoryFilter(history, '').length, 4);
  });

  test('"ครบกำหนด" returns only Completed rows', () => {
    const out = applyHistoryFilter(history, 'Completed');
    assert.equal(out.length, 2);
    assert.ok(out.every(l => l.status === 'Completed'));
  });

  test('"ยกเลิกก่อนกำหนด" returns only Terminated rows', () => {
    const out = applyHistoryFilter(history, 'Terminated');
    assert.equal(out.length, 2);
    assert.ok(out.every(l => l.status === 'Terminated'));
  });

  test('filter for non-history status (e.g. Active) returns nothing', () => {
    // Defensive — Active should never reach this function, but if it does
    // the History tab must not surface it.
    assert.deepEqual(applyHistoryFilter(history, 'Active'), []);
  });

  test('counts per status match what the chips would display', () => {
    const completedCount  = history.filter(l => l.status === 'Completed').length;
    const terminatedCount = history.filter(l => l.status === 'Terminated').length;
    assert.equal(completedCount, 2);
    assert.equal(terminatedCount, 2);
    assert.equal(completedCount + terminatedCount, history.length);
  });
});

describe('Dormitory rule: lease termination guard', () => {
  test('an Active lease can be terminated', () => {
    assert.equal(canTerminate({ status: 'Active' }), true);
  });

  test('a Completed lease cannot be terminated again', () => {
    assert.equal(canTerminate({ status: 'Completed' }), false);
  });

  test('a Terminated lease cannot be terminated again', () => {
    assert.equal(canTerminate({ status: 'Terminated' }), false);
  });
});

describe('Dormitory rule: room release on lease termination', () => {
  test('frees the room when it is Occupied by this very tenant', () => {
    const room  = { status: 'Occupied', currentTenantId: 7 };
    const lease = { tenantId: 7 };
    assert.equal(shouldFreeRoom(room, lease), true);
  });

  test('does NOT touch a Vacant room (no clobber)', () => {
    const room  = { status: 'Vacant', currentTenantId: null };
    const lease = { tenantId: 7 };
    assert.equal(shouldFreeRoom(room, lease), false);
  });

  test('does NOT touch a Maintenance room (manual flag wins)', () => {
    const room  = { status: 'Maintenance', currentTenantId: 7 };
    const lease = { tenantId: 7 };
    assert.equal(shouldFreeRoom(room, lease), false);
  });

  test('does NOT touch a Reserved room', () => {
    const room  = { status: 'Reserved', currentTenantId: 7 };
    const lease = { tenantId: 7 };
    assert.equal(shouldFreeRoom(room, lease), false);
  });

  test('does NOT free a room occupied by a different tenant', () => {
    const room  = { status: 'Occupied', currentTenantId: 99 };
    const lease = { tenantId: 7 };
    assert.equal(shouldFreeRoom(room, lease), false);
  });
});

describe('Dormitory rule: new lease can only be signed in a Vacant room', () => {
  test('Vacant room accepts a new lease', () => {
    assert.equal(canCreateLeaseInRoom({ status: 'Vacant' }), true);
  });

  test('Occupied room rejects a new lease', () => {
    assert.equal(canCreateLeaseInRoom({ status: 'Occupied' }), false);
  });

  test('Reserved room rejects a new lease', () => {
    assert.equal(canCreateLeaseInRoom({ status: 'Reserved' }), false);
  });

  test('Maintenance room rejects a new lease', () => {
    assert.equal(canCreateLeaseInRoom({ status: 'Maintenance' }), false);
  });
});

describe('Dormitory rule: valid lease status transitions', () => {
  // Allowed transitions per CLAUDE.md:
  //   Active → Completed   (natural end)
  //   Active → Terminated  (early move-out)
  // Nothing else. In particular: no transition out of Completed/Terminated,
  // and no creation directly in Completed/Terminated state.
  const ALLOWED = new Set([
    'Active->Completed',
    'Active->Terminated',
  ]);

  function isAllowedTransition(from, to) {
    return ALLOWED.has(`${from}->${to}`);
  }

  test('Active → Completed is allowed', () => {
    assert.equal(isAllowedTransition('Active', 'Completed'), true);
  });

  test('Active → Terminated is allowed', () => {
    assert.equal(isAllowedTransition('Active', 'Terminated'), true);
  });

  test('Completed → anything is forbidden', () => {
    for (const to of VALID_LEASE_STATUSES) {
      assert.equal(isAllowedTransition('Completed', to), false,
        `Completed→${to} should be forbidden`);
    }
  });

  test('Terminated → anything is forbidden', () => {
    for (const to of VALID_LEASE_STATUSES) {
      assert.equal(isAllowedTransition('Terminated', to), false,
        `Terminated→${to} should be forbidden`);
    }
  });

  test('Active → Active (no-op) is forbidden', () => {
    assert.equal(isAllowedTransition('Active', 'Active'), false);
  });
});
