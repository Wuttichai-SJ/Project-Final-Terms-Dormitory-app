import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2, Settings } from 'lucide-react';
import { invoke } from '../lib/ipc';
import { usePermission } from '../hooks/usePermission';

export function SettingsPage() {
  const { has } = usePermission();
  const canEdit = has('settings.edit');

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">จัดการข้อมูลหอพัก อัตราค่าบริการ และอาคาร</p>
      </div>
      <div className="grid grid-cols-1 min-[1228px]:grid-cols-[1fr_380px] gap-6 items-start">
        <RatesSection canEdit={canEdit} />
        <BuildingsSection canEdit={canEdit} />
      </div>
    </div>
  );
}

// ─── Rates / App Settings ─────────────────────────────────────────────────────

function RatesSection({ canEdit }) {
  const [form, setForm]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    invoke('settings:get').then(res => {
      if (res.success) setForm(res.data);
      setLoading(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const res = await invoke('settings:update', form);
    if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else setError(res.error);
    setSaving(false);
  }

  function set(key) {
    return e => setForm(p => ({ ...p, [key]: e.target.value }));
  }
  function setCheck(key) {
    return e => setForm(p => ({ ...p, [key]: e.target.checked ? 1 : 0 }));
  }

  if (loading || !form) return (
    <div className="p-8 bg-white border shadow-sm rounded-2xl border-slate-200">
      <p className="text-sm text-slate-400">กำลังโหลด...</p>
    </div>
  );

  return (
    <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      {/* Card header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Settings className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">ข้อมูลหอพัก & อัตราค่าบริการ</h2>
          <p className="text-xs text-slate-400 mt-0.5">ใช้สำหรับคำนวณบิลรายเดือนของผู้เช่า</p>
        </div>
      </div>

      {error && <div className="px-6 pt-5"><ErrorBox message={error} /></div>}
      {saved && (
        <div className="px-6 pt-5">
          <div className="p-3 text-sm border text-emerald-700 border-emerald-200 rounded-xl bg-emerald-50">
            บันทึกเรียบร้อยแล้ว
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-8">

        {/* Dormitory info */}
        <div className="space-y-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ข้อมูลหอพัก</p>
          <Field label="ชื่อหอพัก">
            <input
              value={form.dormitoryName || ''}
              onChange={set('dormitoryName')}
              disabled={!canEdit}
              className={inputCls(canEdit)}
              placeholder="เช่น หอพักพรทิพย์"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ที่อยู่">
              <input value={form.dormitoryAddress || ''} onChange={set('dormitoryAddress')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="เบอร์โทรติดต่อ">
              <input value={form.dormitoryPhone || ''} onChange={set('dormitoryPhone')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
          </div>
        </div>

        {/* Rates */}
        <div className="pt-8 space-y-4 border-t border-dashed border-slate-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">อัตราค่าบริการ</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="ค่าไฟ (หน่วย)">
              <input type="number" min="0" step="0.01" value={form.electricRate} onChange={set('electricRate')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="ค่าน้ำ (หน่วย)">
              <input type="number" min="0" step="0.01" value={form.waterRate} onChange={set('waterRate')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="ค่าน้ำขั้นต่ำ (เดือน)">
              <input type="number" min="0" value={form.minWaterBill} onChange={set('minWaterBill')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="ค่าขยะ (เดือน)">
              <input type="number" min="0" value={form.trashFee} onChange={set('trashFee')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="ค่าส่วนกลาง (เดือน)">
              <input type="number" min="0" value={form.commonFee} onChange={set('commonFee')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
            <Field label="ค่าอินเทอร์เน็ต (เดือน)">
              <input type="number" min="0" value={form.internetFee} onChange={set('internetFee')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
          </div>
        </div>

        {/* VAT & billing */}
        <div className="pt-8 space-y-4 border-t border-dashed border-slate-200">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">ภาษี & การชำระ</p>
          <label className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-50 border-slate-200' : 'border-slate-100 bg-slate-50'}`}>
            <input
              type="checkbox"
              checked={!!form.vatEnabled}
              onChange={setCheck('vatEnabled')}
              disabled={!canEdit}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">เปิดใช้งาน VAT</p>
              <p className="text-xs text-slate-400">คำนวณ VAT รวมในใบแจ้งหนี้</p>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="อัตรา VAT (%)">
              <input
                type="number" min="0" step="0.1"
                value={form.defaultVatRate}
                onChange={set('defaultVatRate')}
                disabled={!canEdit || !form.vatEnabled}
                className={inputCls(canEdit && !!form.vatEnabled)}
              />
            </Field>
            <Field label="กำหนดชำระ (วันหลังออกบิล)">
              <input type="number" min="1" value={form.dueDays} onChange={set('dueDays')} disabled={!canEdit} className={inputCls(canEdit)} />
            </Field>
          </div>
          <Field label="นโยบายย้ายออกก่อนกำหนด">
            <select value={form.earlyTerminationPolicy} onChange={set('earlyTerminationPolicy')} disabled={!canEdit} className={inputCls(canEdit)}>
              <option value="A">A — ริบเงินประกันทั้งหมด</option>
              <option value="B">B — หักตามสัดส่วนเดือนที่เหลือ</option>
              <option value="C">C — หักครึ่งหนึ่งของเงินประกัน</option>
            </select>
          </Field>
        </div>

        {/* Footer actions */}
        <div className="flex items-center pt-5 border-t border-slate-100">
          {canEdit ? (
            <button
              type="submit"
              disabled={saving}
              className="px-7 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          ) : (
            <p className="text-xs text-slate-400">เฉพาะ admin เท่านั้นที่สามารถแก้ไขการตั้งค่าได้</p>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Buildings ────────────────────────────────────────────────────────────────

function BuildingsSection({ canEdit }) {
  const [list, setList]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [listVersion, setListVersion] = useState(0);

  function refresh() { setListVersion(v => v + 1); }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await invoke('building:list');
      if (cancelled) return;
      if (res.success) setList(res.data);
      else setError(res.error);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [listVersion]);

  async function handleDelete(b) {
    const res = await invoke('building:delete', { id: b.id });
    if (res.success) refresh();
    else setError(res.error);
  }

  return (
    <div className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">อาคาร</h2>
            <p className="text-xs text-slate-400 mt-0.5">จัดการอาคารและจำนวนชั้น</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="p-2 text-indigo-600 transition-colors bg-indigo-50 hover:bg-indigo-100 rounded-xl"
            title="เพิ่มอาคาร"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <div className="px-6 pt-4"><ErrorBox message={error} /></div>}

      <div className="p-4">
        {loading ? (
          <p className="px-2 py-3 text-sm text-slate-400">กำลังโหลด...</p>
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm text-slate-400">ยังไม่มีอาคารในระบบ</p>
            {canEdit && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm font-medium text-indigo-500 transition-colors hover:text-indigo-700">
                + เพิ่มอาคารแรก
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(b => (
              <div key={b.id} className="flex items-center justify-between px-5 py-4 transition-colors rounded-xl hover:bg-slate-50 group">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center text-base font-bold text-indigo-600 w-11 h-11 rounded-xl bg-indigo-50 shrink-0">
                    {b.code}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{b.name || `อาคาร ${b.code}`}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {b.floors ? `${b.floors} ชั้น` : 'ไม่ระบุจำนวนชั้น'}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setEditTarget(b)}
                      className="p-2 transition-colors rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="p-2 transition-colors rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <BuildingFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}
      {editTarget && (
        <BuildingFormModal
          building={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Building Form Modal ──────────────────────────────────────────────────────

function BuildingFormModal({ building, onClose, onSaved }) {
  const isEdit = !!building;
  const [form, setForm] = useState({
    code:   building?.code   ?? '',
    name:   building?.name   ?? '',
    floors: building?.floors ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const channel = isEdit ? 'building:update' : 'building:create';
    const payload = { ...form };
    if (isEdit) payload.id = building.id;

    try {
      const res = await invoke(channel, payload);
      if (res.success) onSaved();
      else setError(res.error);
    } catch (err) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={isEdit ? 'แก้ไขอาคาร' : 'เพิ่มอาคาร'} onClose={onClose}>
      {error && <ErrorBox message={error} />}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="รหัสอาคาร *">
            <input
              value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              required
              className={inputCls(true)}
              placeholder="เช่น 1, A, B1"
            />
          </Field>
          <Field label="จำนวนชั้น">
            <input
              type="number" min="1"
              value={form.floors}
              onChange={e => setForm(p => ({ ...p, floors: e.target.value }))}
              className={inputCls(true)}
            />
          </Field>
        </div>
        <Field label="ชื่ออาคาร">
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className={inputCls(true)}
            placeholder="เช่น อาคารหลัก"
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'เพิ่มอาคาร'} disabled={loading} />
      </form>
    </Modal>
  );
}

// ─── Shared tiny components ───────────────────────────────────────────────────

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
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 text-sm font-medium border rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        ยกเลิก
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
      >
        {submitLabel}
      </button>
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
  return (
    <div className="p-3 text-sm text-red-700 border border-red-200 rounded-xl bg-red-50">{message}</div>
  );
}

const inputCls = (enabled) =>
  `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
    enabled
      ? 'border-slate-200 bg-white hover:border-slate-300'
      : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
  }`;
