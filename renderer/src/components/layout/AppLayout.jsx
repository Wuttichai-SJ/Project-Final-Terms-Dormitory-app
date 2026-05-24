import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { UserManagementPage } from '../../pages/UserManagementPage';
import { RoomListPage }        from '../../pages/RoomListPage';
import { TenantListPage }      from '../../pages/TenantListPage';
import { SettingsPage }        from '../../pages/SettingsPage';

// Placeholder shown for pages not yet built in later phases
function ComingSoon({ label }) {
  return (
    <div className="flex-1 flex items-center justify-center h-full text-slate-400">
      <div className="text-center space-y-2">
        <p className="text-4xl">🚧</p>
        <p className="font-medium text-slate-500">{label}</p>
        <p className="text-sm">จะถูกพัฒนาในเฟสถัดไป</p>
      </div>
    </div>
  );
}

const PAGE_LABELS = {
  dashboard: 'หน้าหลัก (Dashboard)',
  rooms:     'ห้องพัก',
  tenants:   'ผู้เช่า',
  leases:    'สัญญาเช่า',
  billing:   'ออกบิล',
  summary:   'สรุปการชำระ',
  analytics: 'วิเคราะห์',
  settings:  'ตั้งค่า',
  audit:     'ประวัติการใช้งาน',
};

export function AppLayout() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  function renderPage() {
    if (currentPage === 'users')    return <UserManagementPage />;
    if (currentPage === 'rooms')    return <RoomListPage />;
    if (currentPage === 'tenants')  return <TenantListPage />;
    if (currentPage === 'settings') return <SettingsPage />;
    return <ComingSoon label={PAGE_LABELS[currentPage] || currentPage} />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}
