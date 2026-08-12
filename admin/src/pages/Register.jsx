import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() && !phone.trim()) { setError('กรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 อย่าง'); return; }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setBusy(true);
    try {
      await register(email.trim() || null, phone.trim() || null, password);
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
        <p className="mb-4 text-center text-sm font-semibold text-slate-600">สมัครสมาชิกใหม่</p>
        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="mb-1 block text-xs font-semibold text-slate-500">อีเมล (กรอกอย่างน้อย 1 อย่างกับเบอร์โทรศัพท์)</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500">เบอร์โทรศัพท์</label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="0812345678"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
        <input
          type="password" required value={password} onChange={e => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold text-slate-500">ยืนยันรหัสผ่าน</label>
        <input
          type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
          className="mb-6 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit" disabled={busy}
          className="mb-4 w-full rounded bg-emerald-700 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
        <p className="text-center text-sm text-slate-500">
          มีบัญชีอยู่แล้ว? <Link to="/login" className="font-semibold text-emerald-700">เข้าสู่ระบบ</Link>
        </p>
      </form>
    </div>
  );
}
