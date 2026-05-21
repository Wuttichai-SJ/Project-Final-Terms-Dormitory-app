import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
        กำลังโหลด...
      </div>
    );
  }

  // Not logged in, or logged in but must change password first
  if (!user || user.mustChangePassword) return <LoginPage />;

  return <AppLayout />;
}
