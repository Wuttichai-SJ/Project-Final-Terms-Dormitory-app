import { useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './components/layout/AppLayout';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm bg-slate-100 text-slate-400">
        กำลังโหลด...
      </div>
    );
  }

  // Not logged in, or logged in but must change password first
  // if (!user || user.mustChangePassword) return <LoginPage />;
  if (!user) return <LoginPage/>

  return <AppLayout />;
}
