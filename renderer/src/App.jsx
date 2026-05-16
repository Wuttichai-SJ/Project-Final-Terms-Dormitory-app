import { useState } from 'react';
import { Home, Zap } from 'lucide-react';

// Phase 0 smoke-test screen. Confirms three things visually:
//   1. React + Vite + Tailwind render
//   2. preload.js exposed window.electron
//   3. IPC round-trip to main works (app:ping)
export function App() {
  const [pingResult, setPingResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasElectronBridge = typeof window !== 'undefined' && Boolean(window.electron);

  async function handlePing() {
    setLoading(true);
    setError(null);
    try {
      const res = await window.electron.invoke('app:ping');
      if (!res?.success) throw new Error(res?.error || 'unknown error');
      setPingResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Home className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Hello Dormy</h1>
            <p className="text-sm text-slate-500">Phase 0 — Project Bootstrap</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatusPill label="React 19" ok />
          <StatusPill label="Vite + Tailwind" ok />
          <StatusPill label="Electron Shell" ok />
          <StatusPill label="IPC Bridge" ok={hasElectronBridge} />
        </div>

        <button
          onClick={handlePing}
          disabled={!hasElectronBridge || loading}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium py-3 rounded-xl transition-colors"
        >
          <Zap className="w-4 h-4" />
          {loading ? 'Pinging...' : 'Ping Main Process'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        {pingResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-1 text-sm font-mono">
            <div><span className="text-emerald-700">message:</span> {pingResult.message}</div>
            <div><span className="text-emerald-700">electron:</span> {pingResult.electronVersion}</div>
            <div><span className="text-emerald-700">node:</span> {pingResult.nodeVersion}</div>
            <div><span className="text-emerald-700">at:</span> {pingResult.timestamp}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ label, ok }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      <span className="text-slate-700">{label}</span>
    </div>
  );
}
