import { useAuth } from '../context/AuthContext';

// Returns { has } where has(key) → bool.
// Usage: const { has } = usePermission();
//        if (has('bills.delete')) { ... }
export function usePermission() {
  const { user } = useAuth();

  function has(key) {
    if (!user) return false;
    return user.permissions[key] === true;
  }

  return { has };
}
