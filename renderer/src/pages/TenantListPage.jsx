import { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { usePermission } from '../hooks/usePermission';
import { Pagination, PAGE_SIZE } from '../components/Pagination';
import { formatPhone, formatIdCard } from '../lib/format';

export function TenantListPage() {
  const { has } = usePermission();
  const [tenants, setTenants]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [editTarget, setEditTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError]   = useState('');

  async function fetchTenants(q = search) {
    setLoading(true);
    const res = await invoke('tenant:list', { search: q || undefined });
    if (res.success) setTenants(res.data);
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => { fetchTenants(); }, []);

  // Debounce search — wait 300ms after last keystroke before hitting backend
  useEffect(() => {
    const t = setTimeout(() => fetchTenants(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page whenever the search query changes
  useEffect(() => { setPage(1); }, [search]);

  const totalPages   = Math.max(1, Math.ceil(tenants.length / PAGE_SIZE));
  const currentPage  = Math.min(page, totalPages);
  const paginatedTenants = tenants.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function handleDelete(tenant) {
    setDeleteError('');
    const res = await invoke('tenant:delete', { id: tenant.id });
    if (res.success) { setDeleteTarget(null); fetchTenants(); }
    else setDeleteError(res.error);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ผู้เช่า</h1>
          <p className="text-sm text-slate-500">ผู้เช่าทั้งหมดในระบบ</p>
        </div>
        {has('tenants.create') && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            เพิ่มผู้เช่าใหม่
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{error}</div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute w-4 h-4 left-3 top-2.5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือเบอร์โทร..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">{search ? 'ไม่พบผู้เช่าที่ตรงกับการค้นหา' : 'ยังไม่มีผู้เช่าในระบบ'}</p>
        </div>
      ) : (
        <div>
        <div className="overflow-hidden bg-white border rounded-xl border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-slate-50 border-slate-200">
                <th className="px-4 py-3 font-medium text-slate-600">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3 font-medium text-slate-600">เบอร์โทร</th>
                <th className="px-4 py-3 font-medium text-slate-600">บัตรประชาชน</th>
                <th className="px-4 py-3 font-medium text-slate-600">สัญชาติ</th>
                <th className="px-4 py-3 font-medium text-slate-600">สถานะ</th>
                <th className="px-4 py-3 pr-6 font-medium text-right text-slate-600">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTenants.map(t => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.fullName}</td>
                  <td className="px-4 py-3 text-slate-500">{formatPhone(t.phone)}</td>
                  <td className="px-4 py-3 text-slate-500">{t.idCard ? formatIdCard(t.idCard) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{t.nationality || '—'}</td>
                  <td className="px-4 py-3">
                    <ResidencyBadge tenant={t} />
                  </td>
                  <td className="px-4 py-3 pr-6">
                    <div className="flex items-center justify-end gap-3">
                      {has('tenants.edit') && (
                        <button onClick={() => setEditTarget(t)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                          <Pencil className="w-3 h-3" /> แก้ไข
                        </button>
                      )}
                      {has('tenants.delete') && !t.currentLeaseId && (
                        <button onClick={() => { setDeleteError(''); setDeleteTarget(t); }} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3 h-3" /> ลบ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={currentPage} total={tenants.length} onPageChange={setPage} />
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <TenantFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); fetchTenants(); }}
        />
      )}
      {editTarget && (
        <TenantFormModal
          tenant={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchTenants(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          label={deleteTarget.fullName}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}

// ─── Tenant Form Modal ────────────────────────────────────────────────────────

function TenantFormModal({ tenant, onClose, onSaved }) {
  const isEdit = !!tenant;
  const [form, setForm] = useState({
    fullName:    tenant?.fullName    ?? '',
    phone:       tenant?.phone       ?? '',
    idCard:      tenant?.idCard      ?? '',
    nationality: tenant?.nationality ?? '',
    address:     tenant?.address     ?? '',
    note:        tenant?.note        ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const channel = isEdit ? 'tenant:update' : 'tenant:create';
    const payload = { ...form };
    if (isEdit) payload.id = tenant.id;

    const res = await invoke(channel, payload);
    if (res.success) onSaved();
    else setError(res.error);
    setLoading(false);
  }

  function set(key) {
    return e => setForm(p => ({ ...p, [key]: e.target.value }));
  }

  function setPhone(e) {
    setForm(p => ({ ...p, phone: formatPhone(e.target.value) }));
  }

  function setIdCard(e) {
    setForm(p => ({ ...p, idCard: formatIdCard(e.target.value) }));
  }

  return (
    <Modal title={isEdit ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มผู้เช่าใหม่'} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ชื่อ-นามสกุล *">
          <input value={form.fullName} onChange={set('fullName')} required className={inputCls} />
        </Field>
        <Field label="เบอร์โทรศัพท์ *">
          <input
            value={form.phone}
            onChange={setPhone}
            required
            inputMode="numeric"
            maxLength={12}
            placeholder="092-441-9446"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เลขบัตรประชาชน">
            <input
              value={form.idCard}
              onChange={setIdCard}
              inputMode="numeric"
              maxLength={17}
              placeholder="1-1111-11111-11-1"
              className={inputCls}
            />
          </Field>
          <Field label="สัญชาติ">
            <input value={form.nationality} onChange={set('nationality')} className={inputCls} placeholder="ไทย" />
          </Field>
        </div>
        <Field label="ที่อยู่">
          <textarea value={form.address} onChange={set('address')} rows={2} className={inputCls} />
        </Field>
        <Field label="หมายเหตุ">
          <input value={form.note} onChange={set('note')} className={inputCls} />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มผู้เช่า'} disabled={loading} />
      </form>
    </Modal>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

function ConfirmDeleteModal({ label, error, onCancel, onConfirm }) {
  return (
    <Modal title="ยืนยันการลบ" onClose={onCancel}>
      <p className="text-sm text-slate-600">คุณต้องการลบ <span className="font-medium text-slate-800">{label}</span> ออกจากระบบใช่หรือไม่?</p>
      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2">
        ระบบจะซ่อนผู้เช่ารายนี้ออกจากรายการ แต่ประวัติสัญญาเช่า/บิล/บันทึก Move-Out จะยังถูกเก็บไว้เพื่อการอ้างอิงและการตรวจสอบ
      </p>
      {error && <ErrorBox message={error} />}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2 text-sm border rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">ยกเลิก</button>
        <button onClick={onConfirm} className="flex-1 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">ลบ</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md p-6 space-y-4 bg-white shadow-xl rounded-2xl">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, submitLabel, disabled }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 py-2 text-sm border rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">ยกเลิก</button>
      <button type="submit" disabled={disabled} className="flex-1 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">{submitLabel}</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block mb-1 text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ message }) {
  return <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{message}</div>;
}

// Three states (drived from joined currentLeaseId on tenant:list):
//   - MovedOut          → slate "ย้ายออกแล้ว"
//   - Active + lease    → green "พักอยู่ · ห้อง XX"
//   - Active + no lease → slate "ลงทะเบียน"
function ResidencyBadge({ tenant }) {
  if (tenant.status !== 'Active') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">ย้ายออกแล้ว</span>;
  }
  if (tenant.currentLeaseId) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        พักอยู่ · ห้อง {tenant.currentRoomNumber}
      </span>
    );
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">ลงทะเบียน</span>;
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
