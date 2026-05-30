import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BedDouble, Search } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { usePermission } from '../hooks/usePermission';
import { Pagination, PAGE_SIZE } from '../components/Pagination';

const STATUS_STYLE = {
  Vacant:      { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
  Occupied:    { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',     dot: 'bg-indigo-500' },
  Reserved:    { badge: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-500' },
  Maintenance: { badge: 'bg-red-50 text-red-700 border-red-200',              dot: 'bg-red-500' },
};
const STATUS_LABEL = {
  Vacant:      'ว่าง',
  Occupied:    'มีผู้เช่า',
  Reserved:    'จอง',
  Maintenance: 'ซ่อมบำรุง',
};

export function RoomListPage() {
  const { has } = usePermission();
  const [rooms, setRooms]           = useState([]);
  const [buildings, setBuildings]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filters, setFilters]       = useState({ buildingId: '', floor: '', status: '' });
  const [roomSearch, setRoomSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [editTarget, setEditTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function fetchRooms() {
    setLoading(true);
    const payload = {};
    if (filters.buildingId) payload.buildingId = Number(filters.buildingId);
    if (filters.floor)      payload.floor      = Number(filters.floor);
    if (filters.status)     payload.status     = filters.status;
    const res = await invoke('room:list', payload);
    if (res.success) setRooms(res.data);
    else setError(res.error);
    setLoading(false);
  }

  async function fetchBuildings() {
    const res = await invoke('building:list');
    if (res.success) setBuildings(res.data);
  }

  useEffect(() => { fetchBuildings(); }, []);
  useEffect(() => { fetchRooms(); }, [filters]);

  // Reset to first page whenever filters or search change
  useEffect(() => { setPage(1); }, [filters, roomSearch]);

  const floorOptions = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  const visibleRooms = roomSearch.trim()
    ? rooms.filter(r => String(r.roomNumber).toLowerCase().includes(roomSearch.trim().toLowerCase()))
    : rooms;

  const totalPages    = Math.max(1, Math.ceil(visibleRooms.length / PAGE_SIZE));
  const currentPage   = Math.min(page, totalPages);
  const paginatedRooms = visibleRooms.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleDelete(room) {
    const res = await invoke('room:delete', { id: room.id });
    if (res.success) { setDeleteTarget(null); fetchRooms(); }
    else setError(res.error);
  }

  const stats = {
    vacant:      rooms.filter(r => r.status === 'Vacant').length,
    occupied:    rooms.filter(r => r.status === 'Occupied').length,
    maintenance: rooms.filter(r => r.status === 'Maintenance').length,
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ห้องพัก</h1>
          <p className="mt-1 text-sm text-slate-500">ห้องพักทั้งหมดในระบบ</p>
        </div>
        {has('rooms.create') && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่มห้องใหม่
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">{error}</div>
      )}

      {/* Stats + Filters row */}
      <div className="p-4 bg-white border shadow-sm rounded-2xl border-slate-200">
        <div className="flex items-center gap-6">
          {/* Stats */}
          {!loading && rooms.length > 0 && (
            <div className="flex items-center gap-5 pr-6 border-r border-slate-100">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">{rooms.length}</p>
                <p className="text-xs text-slate-400">ทั้งหมด</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{stats.vacant}</p>
                <p className="text-xs text-slate-400">ว่าง</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-600">{stats.occupied}</p>
                <p className="text-xs text-slate-400">มีผู้เช่า</p>
              </div>
              {stats.maintenance > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-red-500">{stats.maintenance}</p>
                  <p className="text-xs text-slate-400">ซ่อมบำรุง</p>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center flex-1 gap-3">
            <select
              value={filters.buildingId}
              onChange={e => setFilters(f => ({ ...f, buildingId: e.target.value, floor: '' }))}
              className={filterCls}
            >
              <option value="">ทุกอาคาร</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name || `อาคาร ${b.code}`}</option>
              ))}
            </select>

            <select
              value={filters.floor}
              onChange={e => setFilters(f => ({ ...f, floor: e.target.value }))}
              className={filterCls}
            >
              <option value="">ทุกชั้น</option>
              {floorOptions.map(f => (
                <option key={f} value={f}>ชั้น {f}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className={filterCls}
            >
              <option value="">ทุกสถานะ</option>
              <option value="Vacant">ว่าง</option>
              <option value="Occupied">มีผู้เช่า</option>
              <option value="Reserved">จอง</option>
              <option value="Maintenance">ซ่อมบำรุง</option>
            </select>

            {(filters.buildingId || filters.floor || filters.status) && (
              <button
                onClick={() => setFilters({ buildingId: '', floor: '', status: '' })}
                className="text-xs transition-colors text-slate-400 hover:text-slate-600 whitespace-nowrap"
              >
                ล้างตัวกรอง
              </button>
            )}

            <div className="relative ml-auto">
              <Search className="absolute w-4 h-4 left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                value={roomSearch}
                onChange={e => setRoomSearch(e.target.value)}
                placeholder="ค้นหาหมายเลขห้อง..."
                className="w-56 pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Room table */}
      {loading ? (
        <div className="bg-white border shadow-sm rounded-2xl border-slate-200">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="m-3 border-b h-14 border-slate-100 last:border-0 animate-pulse bg-slate-50/60 rounded-xl" />
          ))}
        </div>
      ) : visibleRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-300">
          <BedDouble className="w-12 h-12" />
          <p className="text-sm text-slate-400">
            {roomSearch.trim() ? `ไม่พบห้องที่ตรงกับ "${roomSearch}"` : 'ไม่พบห้องพักที่ตรงกับเงื่อนไข'}
          </p>
        </div>
      ) : (
        <div>
        <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 font-medium text-slate-500">ห้อง</th>
                <th className="px-5 py-3 font-medium text-slate-500">อาคาร / ชั้น</th>
                <th className="px-5 py-3 font-medium text-slate-500">ประเภท</th>
                <th className="px-5 py-3 font-medium text-slate-500">ราคา/เดือน</th>
                <th className="px-5 py-3 font-medium text-slate-500">ผู้เช่า</th>
                <th className="px-5 py-3 font-medium text-slate-500">สถานะ</th>
                <th className="px-5 py-3 pr-6 font-medium text-right text-slate-500">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRooms.map(room => {
                const style = STATUS_STYLE[room.status];
                return (
                  <tr key={room.id} className="transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-800">{room.roomNumber}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {room.buildingName || `อาคาร ${room.buildingCode}`} · ชั้น {room.floor}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${room.type === 'Air' ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                        {room.type === 'Air' ? 'แอร์' : 'พัดลม'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{room.basePrice.toLocaleString()} ฿</td>
                    <td className="px-5 py-3 text-slate-500">{room.status === 'Occupied' ? (room.tenantName || '—') : '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {STATUS_LABEL[room.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 pr-6">
                      <div className="flex items-center justify-end gap-3">
                        {has('rooms.edit') && (
                          <button onClick={() => setEditTarget(room)} className="flex items-center gap-1 text-xs transition-colors text-slate-400 hover:text-indigo-600">
                            <Pencil className="w-3 h-3" /> แก้ไข
                          </button>
                        )}
                        {has('rooms.delete') && room.status === 'Vacant' && (
                          <button onClick={() => setDeleteTarget(room)} className="flex items-center gap-1 text-xs transition-colors text-slate-400 hover:text-red-500">
                            <Trash2 className="w-3 h-3" /> ลบ
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
        <Pagination page={currentPage} total={visibleRooms.length} onPageChange={setPage} />
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <RoomFormModal
          buildings={buildings}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchRooms(); }}
        />
      )}
      {editTarget && (
        <RoomFormModal
          room={editTarget}
          buildings={buildings}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchRooms(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          label={`ห้อง ${deleteTarget.roomNumber}`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

// ─── Room Form Modal ──────────────────────────────────────────────────────────

function RoomFormModal({ room, buildings, onClose, onSaved }) {
  const isEdit = !!room;
  const [form, setForm] = useState({
    roomNumber: room?.roomNumber ?? '',
    buildingId: room?.buildingId ?? (buildings[0]?.id ?? ''),
    floor:      room?.floor ?? 1,
    type:       room?.type ?? 'Fan',
    basePrice:  room?.basePrice ?? '',
    status:     room?.status ?? 'Vacant',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const selectedBuilding = buildings.find(b => b.id === Number(form.buildingId));
  const maxFloor = selectedBuilding?.floors ?? null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (maxFloor !== null && Number(form.floor) > maxFloor) {
      setError(`ชั้นที่ ${form.floor} เกินจำนวนชั้นของอาคารนี้ (มีทั้งหมด ${maxFloor} ชั้น)`);
      return;
    }
    setLoading(true);
    setError('');
    const channel = isEdit ? 'room:update' : 'room:create';
    const payload = {
      ...form,
      buildingId: Number(form.buildingId),
      floor:      Number(form.floor),
      basePrice:  Number(form.basePrice),
    };
    if (isEdit) payload.id = room.id;
    const res = await invoke(channel, payload);
    if (res.success) onSaved();
    else setError(res.error);
    setLoading(false);
  }

  const editableStatuses = ['Vacant', 'Maintenance'];

  return (
    <Modal title={isEdit ? 'แก้ไขห้องพัก' : 'เพิ่มห้องพักใหม่'} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="หมายเลขห้อง *">
            <input
              value={form.roomNumber}
              onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))}
              required
              className={inputCls}
              placeholder="เช่น 101"
            />
          </Field>
          <Field label={`ชั้น *${maxFloor ? ` (1–${maxFloor})` : ''}`}>
            <input
              type="number"
              min="1"
              max={maxFloor || undefined}
              value={form.floor}
              onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
              required
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="อาคาร *">
          <select
            value={form.buildingId}
            onChange={e => {
              const newId = e.target.value;
              const newB  = buildings.find(b => b.id === Number(newId));
              const newMax = newB?.floors ?? null;
              setForm(p => ({
                ...p,
                buildingId: newId,
                floor: newMax && Number(p.floor) > newMax ? newMax : p.floor,
              }));
            }}
            required
            className={inputCls}
          >
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name || `อาคาร ${b.code}`}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ประเภท *">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className={inputCls}>
              <option value="Fan">พัดลม (Fan)</option>
              <option value="Air">แอร์ (Air)</option>
            </select>
          </Field>
          <Field label="ราคา *">
            <input
              type="number"
              min="0"
              value={form.basePrice}
              onChange={e => setForm(p => ({ ...p, basePrice: e.target.value }))}
              required
              className={inputCls}
              placeholder="เช่น 4500"
            />
          </Field>
        </div>
        {isEdit && (
          <Field label="สถานะ">
            {editableStatuses.includes(form.status) ? (
              // Vacant/Maintenance — staff can flip between these two manually
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                {editableStatuses.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            ) : (
              // Occupied/Reserved — locked, must go through lease/reservation flow
              <>
                <select disabled value={form.status} className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`}>
                  <option value={form.status}>{STATUS_LABEL[form.status]}</option>
                </select>
                <p className="mt-1 text-xs text-amber-600">
                  ห้องนี้กำลัง{form.status === 'Occupied' ? 'มีผู้เช่าอยู่' : 'ถูกจอง'} —
                  ต้อง{form.status === 'Occupied' ? 'ยกเลิกสัญญาเช่า' : 'ยกเลิกการจอง'}ก่อนจึงจะเปลี่ยนสถานะได้
                </p>
              </>
            )}
          </Field>
        )}
        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มห้อง'} disabled={loading} />
      </form>
    </Modal>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

function ConfirmDeleteModal({ label, onCancel, onConfirm }) {
  return (
    <Modal title="ยืนยันการลบ" onClose={onCancel}>
      <p className="text-sm text-slate-600">
        คุณต้องการลบ <span className="font-semibold text-slate-800">{label}</span> ใช่หรือไม่?
        <span className="block mt-1 text-xs text-slate-400">การดำเนินการนี้ไม่สามารถยกเลิกได้</span>
      </p>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">ยกเลิก</button>
        <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors">ลบ</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 space-y-4 bg-white shadow-2xl rounded-2xl">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
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

const inputCls  = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-slate-300 transition-colors bg-white';
const filterCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-slate-700 hover:border-slate-300 transition-colors';
