import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-3xl">🌳</span>
        <span className="text-2xl font-bold text-slate-800">แผนที่ต้นไม้ <span className="font-light text-slate-400">Admin</span></span>
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-center text-sm font-semibold text-slate-600">กรอกข้อมูลเพื่อเข้าสู่ระบบ</p>
        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="mb-1 block text-xs font-semibold text-slate-500">อีเมล หรือ เบอร์โทรศัพท์</label>
        <input
          type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)}
          placeholder="เช่น 0812345678 หรือ name@email.com"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่าน</label>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          className="mb-6 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit" disabled={busy}
          className="mb-4 w-full rounded bg-emerald-700 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <p className="text-center text-sm text-slate-500">
          ยังไม่มีบัญชี? <Link to="/register" className="font-semibold text-emerald-700">สมัครสมาชิก</Link>
        </p>
      </form>
    </div>
  );
}
