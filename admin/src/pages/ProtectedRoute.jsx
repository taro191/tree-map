import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ children, requireAdmin }) {
  const { user, logout } = useAuth();
  if (user === undefined) {
    return <div className="flex h-screen items-center justify-center bg-gray-100 text-slate-500">กำลังโหลด...</div>;
  }
  if (user === null) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'user') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-100 text-center text-slate-600">
        <p className="text-lg font-bold text-red-700">ไม่มีสิทธิ์เข้าถึงระบบ admin</p>
        <p className="max-w-sm text-sm text-slate-500">บัญชีนี้เป็นบัญชีผู้ใช้ทั่วไปสำหรับแอปภาคสนามเท่านั้น ไม่สามารถเข้าหน้าแดชบอร์ด admin ได้</p>
        <button onClick={logout} className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">ออกจากระบบ</button>
      </div>
    );
  }
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}
