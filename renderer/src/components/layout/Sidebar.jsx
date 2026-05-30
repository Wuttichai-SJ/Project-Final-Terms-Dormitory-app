import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../hooks/usePermission';
import {
  Home, Users, LogOut, Settings, Shield,
  Building2, FileText, BarChart3, ClipboardList, UserRound,
} from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'หน้าหลัก',        icon: Home,          permission: 'dashboard.view' },
  { key: 'rooms',     label: 'ห้องพัก',           icon: Building2,     permission: 'rooms.view' },
  { key: 'tenants',   label: 'ผู้เช่า',           icon: UserRound,     permission: 'tenants.view' },
  { key: 'leases',    label: 'สัญญาเช่า',         icon: FileText,      permission: 'lease.checkin' },
  { key: 'billing',   label: 'ออกบิล',            icon: ClipboardList, permission: 'bills.create' },
  { key: 'summary',   label: 'สรุปการชำระ',       icon: BarChart3,     permission: 'summary.view' },
  { key: 'analytics', label: 'วิเคราะห์',         icon: BarChart3,     permission: 'analytics.view' },
  { key: 'settings',  label: 'ตั้งค่า',           icon: Settings,      permission: 'settings.view' },
  { key: 'users',     label: 'จัดการผู้ใช้',      icon: Users,         permission: 'users.manage' },
  { key: 'audit',     label: 'ประวัติการใช้งาน',  icon: Shield,        permission: 'audit.view' },
];

export function Sidebar({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  const { has } = usePermission();

  const visibleItems = NAV_ITEMS.filter(item => has(item.permission));

  return (
    <aside className="flex flex-col h-screen text-white w-60 bg-slate-800 shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white">Dormy Manager</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
              ${currentPage === key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-5 py-4 space-y-1 border-t border-slate-700">
        <p className="text-xs text-slate-400">{user?.role === 'admin' ? 'admin' : 'staff'}</p>
        <p className="text-sm font-medium truncate text-slate-200">{user?.fullName}</p>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-xs transition-colors mt-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  );
}
