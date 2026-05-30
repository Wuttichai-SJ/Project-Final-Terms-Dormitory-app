import { useState, useEffect } from 'react';
import { Plus, FileSignature, BookmarkPlus, FileX, LogIn, X, Ban, Archive } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { usePermission } from '../hooks/usePermission';
import { Pagination, PAGE_SIZE } from '../components/Pagination';
import { formatPhone, formatIdCard, formatDate } from '../lib/format';

const LEASE_STATUS_STYLE = {
  Active:     { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Completed:  { badge: 'bg-slate-100 text-slate-600 border-slate-200',      dot: 'bg-slate-400'   },
  Terminated: { badge: 'bg-rose-50 text-rose-700 border-rose-200',          dot: 'bg-rose-500'    },
};
const LEASE_STATUS_LABEL = {
  Active:     'พักอยู่',
  Completed:  'ครบกำหนด',
  Terminated: 'ยกเลิกก่อนกำหนด',
};

const RES_STATUS_STYLE = {
  Active:    { badge: 'bg-amber-50 text-amber-700 border-amber-200',    dot: 'bg-amber-500'   },
  CheckedIn: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Cancelled: { badge: 'bg-slate-100 text-slate-500 border-slate-200',   dot: 'bg-slate-400'   },
};
const RES_STATUS_LABEL = {
  Active:    'รอเข้าพัก',
  CheckedIn: 'เช็คอินแล้ว',
  Cancelled: 'ยกเลิกแล้ว',
};

export function LeaseListPage() {
  const { has } = usePermission();
  const [tab, setTab] = useState('leases');

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สัญญาเช่า</h1>
          <p className="mt-1 text-sm text-slate-500">จัดการการเซ็นสัญญาเข้าพักและการจองห้อง</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <TabButton active={tab === 'leases'}       onClick={() => setTab('leases')}>
          <FileSignature className="w-4 h-4" /> สัญญาเช่า
        </TabButton>
        <TabButton active={tab === 'history'}      onClick={() => setTab('history')}>
          <Archive className="w-4 h-4" /> ประวัติ
        </TabButton>
        <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')}>
          <BookmarkPlus className="w-4 h-4" /> การจอง
        </TabButton>
      </div>

      {tab === 'leases'       && <LeasesTab canCheckin={has('lease.checkin')} canTerminate={has('lease.checkout')} />}
      {tab === 'history'      && <HistoryTab />}
      {tab === 'reservations' && <ReservationsTab canManage={has('lease.checkin')} />}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Leases Tab ───────────────────────────────────────────────────────────────

function LeasesTab({ canCheckin, canTerminate }) {
  const [leases, setLeases]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [page, setPage]           = useState(1);
  const [showCheckin, setShowCheckin] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState(null);

  async function fetchLeases() {
    setLoading(true);
    const res = await invoke('lease:list', { status: 'Active' });
    if (res.success) setLeases(res.data);
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => { fetchLeases(); }, []);

  const totalPages   = Math.max(1, Math.ceil(leases.length / PAGE_SIZE));
  const currentPage  = Math.min(page, totalPages);
  const paginated    = leases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          สัญญาที่ยังดำเนินอยู่ <span className="font-semibold text-slate-700">{leases.length}</span> รายการ
        </div>
        {canCheckin && (
          <button
            onClick={() => setShowCheckin(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เซ็นสัญญาใหม่
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : leases.length === 0 ? (
        <EmptyState icon={FileSignature} message="ยังไม่มีสัญญาเช่าในระบบ" hint='กดปุ่ม "เซ็นสัญญาใหม่" เพื่อเริ่มต้น' />
      ) : (
        <div>
          <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 font-medium text-slate-500">ผู้เช่า</th>
                  <th className="px-5 py-3 font-medium text-slate-500">ห้อง</th>
                  <th className="px-5 py-3 font-medium text-slate-500">วันเริ่ม</th>
                  <th className="px-5 py-3 font-medium text-slate-500">วันสิ้นสุด</th>
                  <th className="px-5 py-3 font-medium text-slate-500">ค่าเช่า/เดือน</th>
                  <th className="px-5 py-3 font-medium text-slate-500">เงินประกัน</th>
                  <th className="px-5 py-3 font-medium text-slate-500">สถานะ</th>
                  <th className="px-5 py-3 pr-6 font-medium text-right text-slate-500">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => {
                  const s = LEASE_STATUS_STYLE[l.status];
                  return (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{l.tenantName || '—'}</div>
                        <div className="text-xs text-slate-400">{l.tenantPhone || ''}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <div className="font-medium">ห้อง {l.roomNumber}</div>
                        <div className="text-xs text-slate-400">
                          {l.buildingName || `อาคาร ${l.buildingCode}`} · ชั้น {l.floor}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(l.startDate)}</td>
                      <td className="px-5 py-3 text-slate-600">{l.endDate ? formatDate(l.endDate) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3 text-slate-700">{Number(l.monthlyRentSnapshot).toLocaleString()} ฿</td>
                      <td className="px-5 py-3 text-slate-600">{Number(l.deposit).toLocaleString()} ฿</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {LEASE_STATUS_LABEL[l.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 pr-6">
                        <div className="flex items-center justify-end gap-3">
                          {canTerminate && l.status === 'Active' && (
                            <button
                              onClick={() => setTerminateTarget(l)}
                              className="flex items-center gap-1 text-xs transition-colors text-slate-400 hover:text-red-500"
                            >
                              <Ban className="w-3 h-3" /> ยกเลิกสัญญา
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} total={leases.length} onPageChange={setPage} />
        </div>
      )}

      {showCheckin && (
        <CheckinModal
          onClose={() => setShowCheckin(false)}
          onSaved={() => { setShowCheckin(false); fetchLeases(); }}
        />
      )}
      {terminateTarget && (
        <TerminateLeaseModal
          lease={terminateTarget}
          onCancel={() => setTerminateTarget(null)}
          onConfirmed={() => { setTerminateTarget(null); fetchLeases(); }}
        />
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
// Read-only archive of closed leases: Completed (ครบกำหนด) + Terminated (ยกเลิกก่อนกำหนด).
// Kept separate from the working "สัญญาเช่า" tab so the active list isn't cluttered
// by historical rows that exist only to anchor bills/move-out records.

function HistoryTab() {
  const [allLeases, setAllLeases] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [statusFilter, setStatus] = useState('');
  const [page, setPage]           = useState(1);

  async function fetchLeases() {
    setLoading(true);
    const res = await invoke('lease:list');
    if (res.success) setAllLeases(res.data.filter(l => l.status !== 'Active'));
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => { fetchLeases(); }, []);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const filtered = statusFilter ? allLeases.filter(l => l.status === statusFilter) : allLeases;
  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = {
    completed:  allLeases.filter(l => l.status === 'Completed').length,
    terminated: allLeases.filter(l => l.status === 'Terminated').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FilterChip active={statusFilter === ''}           onClick={() => setStatus('')}>          ทั้งหมด ({allLeases.length})</FilterChip>
        <FilterChip active={statusFilter === 'Completed'}  onClick={() => setStatus('Completed')}> ครบกำหนด ({counts.completed})</FilterChip>
        <FilterChip active={statusFilter === 'Terminated'} onClick={() => setStatus('Terminated')}>ยกเลิกก่อนกำหนด ({counts.terminated})</FilterChip>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Archive} message="ยังไม่มีประวัติสัญญา" hint="สัญญาที่สิ้นสุดหรือถูกยกเลิกจะปรากฏที่นี่" />
      ) : (
        <div>
          <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 font-medium text-slate-500">ผู้เช่า</th>
                  <th className="px-5 py-3 font-medium text-slate-500">ห้อง</th>
                  <th className="px-5 py-3 font-medium text-slate-500">วันเริ่ม</th>
                  <th className="px-5 py-3 font-medium text-slate-500">วันสิ้นสุด</th>
                  <th className="px-5 py-3 font-medium text-slate-500">ค่าเช่า/เดือน</th>
                  <th className="px-5 py-3 font-medium text-slate-500">เงินประกัน</th>
                  <th className="px-5 py-3 pr-6 font-medium text-slate-500">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(l => {
                  const s = LEASE_STATUS_STYLE[l.status];
                  return (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{l.tenantName || '—'}</div>
                        <div className="text-xs text-slate-400">{l.tenantPhone || ''}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <div className="font-medium">ห้อง {l.roomNumber}</div>
                        <div className="text-xs text-slate-400">
                          {l.buildingName || `อาคาร ${l.buildingCode}`} · ชั้น {l.floor}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(l.startDate)}</td>
                      <td className="px-5 py-3 text-slate-600">{l.endDate ? formatDate(l.endDate) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-3 text-slate-700">{Number(l.monthlyRentSnapshot).toLocaleString()} ฿</td>
                      <td className="px-5 py-3 text-slate-600">{Number(l.deposit).toLocaleString()} ฿</td>
                      <td className="px-5 py-3 pr-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {LEASE_STATUS_LABEL[l.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} total={filtered.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Reservations Tab ─────────────────────────────────────────────────────────

function ReservationsTab({ canManage }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [statusFilter, setStatus]       = useState('Active');
  const [page, setPage]                 = useState(1);
  const [showCreate, setShowCreate]     = useState(false);
  const [checkinTarget, setCheckinTarget] = useState(null);
  const [cancelTarget, setCancelTarget]   = useState(null);

  async function fetchReservations() {
    setLoading(true);
    const res = await invoke('reservation:list', statusFilter ? { status: statusFilter } : {});
    if (res.success) setReservations(res.data);
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => { fetchReservations(); }, [statusFilter]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const totalPages  = Math.max(1, Math.ceil(reservations.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = reservations.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterChip active={statusFilter === 'Active'}    onClick={() => setStatus('Active')}>    รอเข้าพัก</FilterChip>
          <FilterChip active={statusFilter === 'CheckedIn'} onClick={() => setStatus('CheckedIn')}> เช็คอินแล้ว</FilterChip>
          <FilterChip active={statusFilter === 'Cancelled'} onClick={() => setStatus('Cancelled')}> ยกเลิกแล้ว</FilterChip>
          <FilterChip active={statusFilter === ''}          onClick={() => setStatus('')}>          ทั้งหมด</FilterChip>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            จองห้องใหม่
          </button>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : reservations.length === 0 ? (
        <EmptyState icon={BookmarkPlus} message="ยังไม่มีการจอง" hint='กดปุ่ม "จองห้องใหม่" เพื่อเริ่มต้น' />
      ) : (
        <div>
          <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 font-medium text-slate-500">ผู้จอง</th>
                  <th className="px-5 py-3 font-medium text-slate-500">ห้อง</th>
                  <th className="px-5 py-3 font-medium text-slate-500">เบอร์โทร</th>
                  <th className="px-5 py-3 font-medium text-slate-500">วันเข้าพัก</th>
                  <th className="px-5 py-3 font-medium text-slate-500">เงินประกัน</th>
                  <th className="px-5 py-3 font-medium text-slate-500">สถานะ</th>
                  <th className="px-5 py-3 pr-6 font-medium text-right text-slate-500">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => {
                  const s = RES_STATUS_STYLE[r.status];
                  return (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-800">{r.tenantName}</td>
                      <td className="px-5 py-3 text-slate-600">
                        <div className="font-medium">ห้อง {r.roomNumber || '—'}</div>
                        <div className="text-xs text-slate-400">
                          {r.buildingName || `อาคาร ${r.buildingCode || ''}`}{r.floor ? ` · ชั้น ${r.floor}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{r.phone}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(r.moveInDate)}</td>
                      <td className="px-5 py-3 text-slate-600">{Number(r.deposit).toLocaleString()} ฿</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {RES_STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 pr-6">
                        <div className="flex items-center justify-end gap-3">
                          {canManage && r.status === 'Active' && (
                            <>
                              <button onClick={() => setCheckinTarget(r)} className="flex items-center gap-1 text-xs transition-colors text-slate-500 hover:text-indigo-600">
                                <LogIn className="w-3 h-3" /> เช็คอิน
                              </button>
                              <button onClick={() => setCancelTarget(r)} className="flex items-center gap-1 text-xs transition-colors text-slate-400 hover:text-red-500">
                                <FileX className="w-3 h-3" /> ยกเลิก
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={currentPage} total={reservations.length} onPageChange={setPage} />
        </div>
      )}

      {showCreate && (
        <ReservationFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchReservations(); }}
        />
      )}
      {checkinTarget && (
        <ReservationCheckinModal
          reservation={checkinTarget}
          onClose={() => setCheckinTarget(null)}
          onSaved={() => { setCheckinTarget(null); fetchReservations(); }}
        />
      )}
      {cancelTarget && (
        <ConfirmCancelModal
          reservation={cancelTarget}
          onCancel={() => setCancelTarget(null)}
          onConfirmed={() => { setCancelTarget(null); fetchReservations(); }}
        />
      )}
    </div>
  );
}

// ─── Check-in Modal (direct lease creation) ───────────────────────────────────
// Two modes:
//   - 'new'      → fill the form below and the backend will insert a fresh tenant
//                  row in the same transaction as the lease.
//   - 'existing' → pick a tenant from the dropdown (only those without an
//                  Active lease are eligible).

function CheckinModal({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [vacantRooms, setRooms]   = useState([]);
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState({
    tenantId:    '',
    fullName:    '',
    phone:       '',
    idCard:      '',
    nationality: '',
    address:     '',
    roomId:      '',
    startDate:   today,
    endDate:     '',
    deposit:     '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      const [tRes, rRes] = await Promise.all([
        invoke('tenant:list'),
        invoke('room:list', { status: 'Vacant' }),
      ]);
      // Only tenants who are Active in system AND have no current Active lease can sign a new one
      if (tRes.success) setAvailableTenants(tRes.data.filter(t => t.status === 'Active' && !t.currentLeaseId));
      if (rRes.success) setRooms(rRes.data);
    })();
  }, []);

  const selectedRoom = vacantRooms.find(r => r.id === Number(form.roomId));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const basePayload = {
        roomId:    Number(form.roomId),
        startDate: form.startDate,
        endDate:   form.endDate || null,
        deposit:   form.deposit !== '' ? Number(form.deposit) : 0,
      };
      const payload = mode === 'existing'
        ? { ...basePayload, tenantId: Number(form.tenantId) }
        : { ...basePayload, tenantData: {
            fullName:    form.fullName,
            phone:       form.phone,
            idCard:      form.idCard,
            nationality: form.nationality,
            address:     form.address,
          } };

      const res = await invoke('lease:create', payload);
      if (res.success) onSaved();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  const submitDisabled = loading || !form.roomId || (
    mode === 'existing' ? !form.tenantId : (!form.fullName || !form.phone)
  );

  return (
    <Modal title="เซ็นสัญญาเช่าใหม่" subtitle="กรอกข้อมูลเพื่อบันทึกผู้เช่าเข้าห้อง" onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ข้อมูลผู้เช่า">
          <div className="flex gap-2 mb-3">
            <ModeChip active={mode === 'new'}      onClick={() => setMode('new')}>กรอกข้อมูลใหม่</ModeChip>
            <ModeChip active={mode === 'existing'} onClick={() => setMode('existing')}>เลือกผู้เช่าที่มีอยู่</ModeChip>
          </div>

          {mode === 'existing' ? (
            <>
              <select value={form.tenantId} onChange={e => setForm(p => ({ ...p, tenantId: e.target.value }))} required className={inputCls}>
                <option value="">เลือกผู้เช่า...</option>
                {availableTenants.map(t => (
                  <option key={t.id} value={t.id}>{t.fullName} · {formatPhone(t.phone)}</option>
                ))}
              </select>
              {availableTenants.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">ไม่มีผู้เช่าที่ว่างอยู่ในระบบ — เลือก "กรอกข้อมูลใหม่"</p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-xs font-medium text-slate-500">ชื่อ-นามสกุล *</label>
                <input
                  value={form.fullName}
                  onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                  required
                  className={inputCls}
                  placeholder="เช่น นายสมชาย ใจดี"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-500">เบอร์โทร *</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                    required
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="092-441-9446"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-500">บัตรประชาชน</label>
                  <input
                    value={form.idCard}
                    onChange={e => setForm(p => ({ ...p, idCard: formatIdCard(e.target.value) }))}
                    inputMode="numeric"
                    maxLength={17}
                    placeholder="1-1111-11111-11-1"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-500">สัญชาติ</label>
                  <input
                    value={form.nationality}
                    onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))}
                    placeholder="ไทย"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs font-medium text-slate-500">ที่อยู่</label>
                  <input
                    value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}
        </Field>

        <Field label="ห้อง (เฉพาะห้องว่าง) *">
          <select value={form.roomId} onChange={e => setForm(p => ({ ...p, roomId: e.target.value }))} required className={inputCls}>
            <option value="">เลือกห้อง...</option>
            {vacantRooms.map(r => (
              <option key={r.id} value={r.id}>
                ห้อง {r.roomNumber} · {r.buildingName || `อาคาร ${r.buildingCode}`} · ชั้น {r.floor} · {Number(r.basePrice).toLocaleString()} ฿
              </option>
            ))}
          </select>
          {vacantRooms.length === 0 && <p className="mt-1 text-xs text-amber-600">ไม่มีห้องว่างในขณะนี้</p>}
        </Field>

        {selectedRoom && (
          <div className="p-3 text-xs rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
            ค่าเช่ารายเดือน (snapshot): <span className="font-semibold">{Number(selectedRoom.basePrice).toLocaleString()} ฿</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="วันเริ่มสัญญา *">
            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} required className={inputCls} />
          </Field>
          <Field label="วันสิ้นสุด (ถ้ามี)">
            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className={inputCls} />
          </Field>
        </div>

        <Field label="เงินประกัน">
          <input
            type="number" min="0"
            value={form.deposit}
            onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))}
            placeholder="เช่น 4500"
            className={inputCls}
          />
        </Field>

        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังบันทึก...' : 'ยืนยันการเซ็นสัญญา'} disabled={submitDisabled} />
      </form>
    </Modal>
  );
}

// ─── Terminate Lease Modal ────────────────────────────────────────────────────
// Quick-terminate path — just flips the lease + frees the room. No deposit math.
// Phase 8 Move-Out is where deposit refund + deductions are handled.

function TerminateLeaseModal({ lease, onCancel, onConfirmed }) {
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await invoke('lease:terminate', { id: lease.id, reason: reason || null });
      if (res.success) onConfirmed();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="ยืนยันการยกเลิกสัญญา" subtitle="ใช้สำหรับผู้เช่าที่ออกจากหอโดยไม่ได้แจ้งล่วงหน้า" onClose={onCancel}>
      {error && <ErrorBox message={error} />}
      <div className="p-3 text-sm rounded-xl bg-rose-50 text-rose-700 border border-rose-100">
        ยกเลิกสัญญาของ <span className="font-semibold">{lease.tenantName}</span> · ห้อง {lease.roomNumber}
        <p className="mt-1 text-xs text-rose-600">
          ห้องจะกลับเป็น <span className="font-semibold">ว่าง</span> ทันที · ไม่มีการคืน/หักเงินประกันในขั้นตอนนี้
        </p>
      </div>
      <Field label="เหตุผล (ไม่บังคับ)">
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder="เช่น ผู้เช่าออกโดยไม่แจ้ง, ผิดสัญญา"
          className={inputCls}
        />
      </Field>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">ปิด</button>
        <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:bg-slate-300 transition-colors">
          {loading ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกสัญญา'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Reservation Create Modal ─────────────────────────────────────────────────

function ReservationFormModal({ onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [vacantRooms, setRooms] = useState([]);
  const [form, setForm] = useState({
    roomId:      '',
    tenantName:  '',
    phone:       '',
    idCard:      '',
    nationality: '',
    address:     '',
    moveInDate:  today,
    deposit:     '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      const r = await invoke('room:list', { status: 'Vacant' });
      if (r.success) setRooms(r.data);
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await invoke('reservation:create', {
        ...form,
        roomId:  Number(form.roomId),
        deposit: form.deposit !== '' ? Number(form.deposit) : 0,
      });
      if (res.success) onSaved();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="จองห้องพัก" subtitle="กรอกข้อมูลผู้จองและห้องที่ต้องการจอง" onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ห้องที่จอง *">
          <select value={form.roomId} onChange={e => setForm(p => ({ ...p, roomId: e.target.value }))} required className={inputCls}>
            <option value="">เลือกห้อง...</option>
            {vacantRooms.map(r => (
              <option key={r.id} value={r.id}>
                ห้อง {r.roomNumber} · {r.buildingName || `อาคาร ${r.buildingCode}`} · ชั้น {r.floor}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ชื่อผู้จอง *">
          <input value={form.tenantName} onChange={e => setForm(p => ({ ...p, tenantName: e.target.value }))} required className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เบอร์โทร *">
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required className={inputCls} />
          </Field>
          <Field label="วันเข้าพัก *">
            <input type="date" value={form.moveInDate} onChange={e => setForm(p => ({ ...p, moveInDate: e.target.value }))} required className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="บัตรประชาชน">
            <input value={form.idCard} onChange={e => setForm(p => ({ ...p, idCard: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="สัญชาติ">
            <input value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} className={inputCls} placeholder="ไทย" />
          </Field>
        </div>
        <Field label="ที่อยู่">
          <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={2} className={inputCls} />
        </Field>
        <Field label="เงินมัดจำ">
          <input type="number" min="0" value={form.deposit} onChange={e => setForm(p => ({ ...p, deposit: e.target.value }))} className={inputCls} placeholder="เช่น 2000" />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังบันทึก...' : 'บันทึกการจอง'} disabled={loading} />
      </form>
    </Modal>
  );
}

// ─── Reservation Check-in Modal ───────────────────────────────────────────────

function ReservationCheckinModal({ reservation, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState({
    tenantMode: 'new',          // 'new' (create from reservation snapshot) | 'existing' (link to tenant)
    tenantId:   '',
    startDate:  reservation.moveInDate || today,
    endDate:    '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      const t = await invoke('tenant:list');
      if (t.success) setTenants(t.data.filter(x => x.status === 'Active'));
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await invoke('reservation:checkin', {
        id:        reservation.id,
        tenantId:  form.tenantMode === 'existing' ? Number(form.tenantId) : null,
        startDate: form.startDate,
        endDate:   form.endDate || null,
      });
      if (res.success) onSaved();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="เช็คอินจากการจอง" subtitle={`ผู้จอง: ${reservation.tenantName} · ห้อง ${reservation.roomNumber}`} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ผู้เช่า">
          <div className="flex gap-2 mb-2">
            <ModeChip active={form.tenantMode === 'new'}      onClick={() => setForm(p => ({ ...p, tenantMode: 'new' }))}>
              สร้างใหม่จากข้อมูลการจอง
            </ModeChip>
            <ModeChip active={form.tenantMode === 'existing'} onClick={() => setForm(p => ({ ...p, tenantMode: 'existing' }))}>
              ใช้ผู้เช่าที่มีอยู่
            </ModeChip>
          </div>
          {form.tenantMode === 'existing' ? (
            <select value={form.tenantId} onChange={e => setForm(p => ({ ...p, tenantId: e.target.value }))} required className={inputCls}>
              <option value="">เลือกผู้เช่า...</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.fullName} · {t.phone}</option>)}
            </select>
          ) : (
            <p className="text-xs text-slate-500">
              จะสร้างผู้เช่ารายใหม่: <span className="font-medium text-slate-700">{reservation.tenantName}</span> · {reservation.phone}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="วันเริ่มสัญญา *">
            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} required className={inputCls} />
          </Field>
          <Field label="วันสิ้นสุด (ถ้ามี)">
            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className={inputCls} />
          </Field>
        </div>

        <div className="p-3 text-xs rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
          เงินประกันจากการจอง: <span className="font-semibold">{Number(reservation.deposit).toLocaleString()} ฿</span> (จะถูกบันทึกลงในสัญญาเช่าโดยอัตโนมัติ)
        </div>

        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังเช็คอิน...' : 'ยืนยันเช็คอิน'} disabled={loading || (form.tenantMode === 'existing' && !form.tenantId)} />
      </form>
    </Modal>
  );
}

function ConfirmCancelModal({ reservation, onCancel, onConfirmed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await invoke('reservation:cancel', { id: reservation.id });
      if (res.success) onConfirmed();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="ยืนยันการยกเลิกการจอง" onClose={onCancel}>
      {error && <ErrorBox message={error} />}
      <p className="text-sm text-slate-600">
        ยกเลิกการจองห้อง <span className="font-semibold text-slate-800">{reservation.roomNumber}</span> ของ{' '}
        <span className="font-semibold text-slate-800">{reservation.tenantName}</span> ใช่หรือไม่?
        <span className="block mt-1 text-xs text-slate-400">ห้องจะกลับเป็น Vacant ทันที</span>
      </p>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">ปิด</button>
        <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:bg-slate-300 transition-colors">
          {loading ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ModeChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
        active
          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, message, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
      <Icon className="w-12 h-12 opacity-30" />
      <p className="text-sm font-medium">{message}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 space-y-4 bg-white shadow-2xl rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1 -m-1 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitLabel, disabled }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">ยกเลิก</button>
      <button type="submit" disabled={disabled} className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">{submitLabel}</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ message }) {
  return <div className="p-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">{message}</div>;
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300 transition-colors bg-white';
