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
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-emerald-900">เข้าสู่ระบบ admin</h1>
        <p className="mb-6 text-sm text-slate-500">ระบบแผนที่ต้นไม้</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="mb-1 block text-xs font-semibold text-slate-500">อีเมล หรือ เบอร์โทรศัพท์</label>
        <input
          type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)}
          placeholder="เช่น 0812345678 หรือ name@email.com"
          className="mb-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่าน</label>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit" disabled={busy}
          className="mb-4 w-full rounded-lg bg-emerald-800 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
        <p className="text-center text-sm text-slate-500">
          ยังไม่มีบัญชี? <Link to="/register" className="font-semibold text-emerald-800">สมัครสมาชิก</Link>
        </p>
      </form>
    </div>
  );
}
