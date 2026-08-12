import { useEffect, useState } from 'react';
import { api } from '../api';

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { reload(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() && !phone.trim()) { setError('กรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 อย่าง'); return; }
    setBusy(true);
    try {
      await api.addUser(email.trim() || null, phone.trim() || null, password);
      setEmail('');
      setPhone('');
      setPassword('');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-700">ผู้ใช้ระบบ admin ({users.length})</h3>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">อีเมลผู้ใช้ใหม่</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">เบอร์โทรศัพท์</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="0812345678"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <button
          type="submit" disabled={busy}
          className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          {busy ? 'กำลังเพิ่ม...' : '+ เพิ่มผู้ใช้'}
        </button>
      </form>
      <ul className="divide-y divide-stone-100 text-sm">
        {users.map(u => (
          <li key={u.id} className="flex items-center justify-between py-1.5">
            <span>{[u.email, u.phone].filter(Boolean).join(' · ')}</span>
            <span className="text-xs text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : ''}</span>
          </li>
        ))}
        {users.length === 0 && <li className="py-1.5 text-slate-400">ยังไม่มีผู้ใช้</li>}
      </ul>
    </div>
  );
}
