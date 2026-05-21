import { useState } from 'react';
import { Home, LogIn, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { invoke } from '../lib/ipc';

export function LoginPage() {
  const { login, user, refreshUser } = useAuth();

  // Login form state
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Force-change-password form state (shown when mustChangePassword is true after login)
  const [cpForm, setCpForm] = useState({ current: '', next: '', confirm: '' });
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await login(form.username, form.password);
    if (!res.success) setError(res.error);
    setLoading(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (cpForm.next !== cpForm.confirm) {
      setCpError('รหัสผ่านใหม่ทั้งสองช่องต้องตรงกัน');
      return;
    }
    setCpLoading(true);
    setCpError('');
    const res = await invoke('auth:changePassword', {
      currentPassword: cpForm.current,
      newPassword:     cpForm.next,
    });
    if (res.success) {
      await refreshUser();
    } else {
      setCpError(res.error);
    }
    setCpLoading(false);
  }

  // After login, if mustChangePassword → show change-password screen
  // if (user?.mustChangePassword) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen p-6 bg-slate-100">
  //       <div className="w-full max-w-sm p-8 space-y-6 bg-white shadow-lg rounded-2xl">
  //         <div className="space-y-2 text-center">
  //           <div className="inline-flex p-3 rounded-full bg-amber-100">
  //             <Lock className="w-7 h-7 text-amber-600" />
  //           </div>
  //           <h1 className="text-xl font-bold text-slate-800">ต้องเปลี่ยนรหัสผ่าน</h1>
  //           <p className="text-sm text-slate-500">กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</p>
  //         </div>

  //         {cpError && (
  //           <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
  //             {cpError}
  //           </div>
  //         )}

  //         <form onSubmit={handleChangePassword} className="space-y-4">
  //           <Field label="รหัสผ่านปัจจุบัน">
  //             <input
  //               type="password"
  //               value={cpForm.current}
  //               onChange={e => setCpForm(p => ({ ...p, current: e.target.value }))}
  //               required
  //               autoFocus
  //               className={inputCls}
  //             />
  //           </Field>
  //           <Field label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)">
  //             <input
  //               type="password"
  //               value={cpForm.next}
  //               onChange={e => setCpForm(p => ({ ...p, next: e.target.value }))}
  //               required
  //               minLength={6}
  //               className={inputCls}
  //             />
  //           </Field>
  //           <Field label="ยืนยันรหัสผ่านใหม่">
  //             <input
  //               type="password"
  //               value={cpForm.confirm}
  //               onChange={e => setCpForm(p => ({ ...p, confirm: e.target.value }))}
  //               required
  //               minLength={6}
  //               className={inputCls}
  //             />
  //           </Field>
  //           <button
  //             type="submit"
  //             disabled={cpLoading}
  //             className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
  //           >
  //             {cpLoading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
  //           </button>
  //         </form>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-slate-100">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white shadow-lg rounded-2xl">
        <div className="space-y-2 text-center">
          <div className="inline-flex p-3 bg-indigo-100 rounded-full">
            <Home className="text-indigo-600 w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Dormy Manager</h1>
          <p className="text-sm text-slate-500">ระบบบริหารจัดการหอพัก</p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Field label="ชื่อผู้ใช้">
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              required
              autoFocus
              placeholder="admin"
              className={inputCls}
            />
          </Field>
          <Field label="รหัสผ่าน">
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
                placeholder="••••••••"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(p => !p)}
                className="absolute -translate-y-1/2 right-3 top-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
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

const inputCls = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
