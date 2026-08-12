import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return <div className="flex h-screen items-center justify-center text-slate-500">กำลังโหลด...</div>;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
