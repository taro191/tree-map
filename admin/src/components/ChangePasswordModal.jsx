import { useState } from 'react';

export default function ChangePasswordModal({ user, onClose, onSave }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirm) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-gray-200 bg-white shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <h3 className="text-sm font-bold text-slate-700">เปลี่ยนรหัสผ่าน</h3>
          <p className="mt-0.5 text-xs text-slate-500">{[user.name, user.email, user.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">ยืนยันรหัสผ่านใหม่</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 p-4">
          <button disabled={busy} onClick={save} className="flex-1 rounded bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
