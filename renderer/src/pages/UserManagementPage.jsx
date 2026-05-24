import { useState, useEffect } from 'react';
import { Plus, UserCircle } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { usePermission } from '../hooks/usePermission';

export function UserManagementPage() {
  const { has } = usePermission();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  async function fetchUsers() {
    setLoading(true);
    const res = await invoke('user:list');
    if (res.success) setUsers(res.data);
    else setError(res.error);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleToggleActive(u) {
    await invoke('user:update', {
      id:       u.id,
      fullName: u.fullName,
      phone:    u.phone,
      role:     u.role,
      isActive: !u.isActive,
    });
    fetchUsers();
  }

  if (!has('users.manage')) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-500">
        ไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">จัดการผู้ใช้งาน</h1>
          <p className="text-sm text-slate-500">ผู้ใช้ทั้งหมดในระบบ</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้ใหม่
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="overflow-hidden bg-white border rounded-xl border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b bg-slate-50 border-slate-200">
                <th className="px-4 py-3 font-medium text-slate-600">ชื่อ</th>
                <th className="px-4 py-3 font-medium text-slate-600">Username</th>
                <th className="px-4 py-3 font-medium text-slate-600">สิทธิ์</th>
                <th className="px-4 py-3 font-medium text-slate-600">เบอร์โทร</th>
                <th className="px-4 py-3 font-medium text-slate-600">เข้าสู่ระบบล่าสุด</th>
                <th className="px-4 py-3 font-medium text-slate-600">สถานะ</th>
                <th className="px-4 py-3 pr-6 font-medium text-right text-slate-600">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-5 h-5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-800">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.username}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.phone ? formatPhone(u.phone) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString('th-TH')
                      : 'ยังไม่เคยเข้า'}
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge active={u.isActive} />
                  </td>
                  <td className="px-4 py-3 pr-6">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setEditTarget(u)}
                        className="text-xs transition-colors text-slate-500 hover:text-indigo-600"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`text-xs transition-colors ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                      >
                        {u.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchUsers(); }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchUsers(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ username: '', password: '', fullName: '', phone: '', role: 'staff' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await invoke('user:create', form);
    if (res.success) onCreated();
    else setError(res.error);
    setLoading(false);
  }

  return (
    <Modal title="เพิ่มผู้ใช้ใหม่" onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ชื่อ-นามสกุล *">
          <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} required className={inputCls} />
        </Field>
        <Field label="Username *">
          <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} required className={inputCls} />
        </Field>
        <Field label="รหัสผ่านเริ่มต้น * (อย่างน้อย 6 ตัว)">
          <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={6} className={inputCls} />
        </Field>
        <Field label="เบอร์โทรศัพท์">
          <input
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
            inputMode="numeric"
            maxLength={12}
            placeholder="092-441-9446"
            className={inputCls}
          />
        </Field>
        <Field label="สิทธิ์ *">
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputCls}>
            <option value="staff">Staff — พนักงาน</option>
            <option value="admin">Admin — ผู้ดูแลระบบ</option>
          </select>
        </Field>
        <ModalActions
          onCancel={onClose}
          submitLabel={loading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}
          disabled={loading}
        />
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ fullName: user.fullName, phone: formatPhone(user.phone || ''), role: user.role });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await invoke('user:update', { id: user.id, ...form, isActive: user.isActive });
    if (res.success) onSaved();
    else setError(res.error);
    setLoading(false);
  }

  return (
    <Modal title="แก้ไขข้อมูลผู้ใช้" onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="ชื่อ-นามสกุล *">
          <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} required className={inputCls} />
        </Field>
        <Field label="เบอร์โทรศัพท์">
          <input
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: formatPhone(e.target.value) }))}
            inputMode="numeric"
            maxLength={12}
            placeholder="092-441-9446"
            className={inputCls}
          />
        </Field>
        <Field label="สิทธิ์ *">
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputCls}>
            <option value="staff">Staff — พนักงาน</option>
            <option value="admin">Admin — ผู้ดูแลระบบ</option>
          </select>
        </Field>
        <ModalActions
          onCancel={onClose}
          submitLabel={loading ? 'กำลังบันทึก...' : 'บันทึก'}
          disabled={loading}
        />
      </form>

      <div className="pt-3 border-t border-slate-200">
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="text-xs transition-colors text-slate-400 hover:text-red-500"
          >
            รีเซ็ตรหัสผ่าน
          </button>
        ) : (
          <InlineResetPassword user={user} onDone={() => setShowReset(false)} />
        )}
      </div>
    </Modal>
  );
}

function InlineResetPassword({ user, onDone }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await invoke('user:resetPassword', { id: user.id, newPassword: password });
    if (res.success) {
      setDone(true);
      setTimeout(onDone, 1200);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  if (done) return (
    <p className="text-xs text-green-600">รีเซ็ตสำเร็จแล้ว</p>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && <ErrorBox message={error} />}
      <Field label="รหัสผ่านใหม่ * (อย่างน้อย 6 ตัว)">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          autoFocus
          className={inputCls}
        />
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 py-1.5 text-xs border rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
          ยกเลิก
        </button>
        <button type="submit" disabled={loading} className="flex-1 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-slate-300 transition-colors">
          {loading ? 'กำลังรีเซ็ต...' : 'ยืนยันรีเซ็ต'}
        </button>
      </div>
    </form>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

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

function ModalActions({ onCancel, submitLabel, submitClassName = 'bg-indigo-600 hover:bg-indigo-700', disabled }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2 text-sm transition-colors border rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50"
      >
        ยกเลิก
      </button>
      <button
        type="submit"
        disabled={disabled}
        className={`flex-1 disabled:bg-slate-300 text-white text-sm py-2 rounded-lg transition-colors ${submitClassName}`}
      >
        {submitLabel}
      </button>
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
  return (
    <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">{message}</div>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
      {role === 'admin' ? 'Admin' : 'Staff'}
    </span>
  );
}

function ActiveBadge({ active }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {active ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </span>
  );
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// Thai phone: 10 digits → XXX-XXX-XXXX
function formatPhone(value) {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
