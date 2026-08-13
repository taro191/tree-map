import { useState } from 'react';

const ROLE_LABELS = {
  admin: 'admin ระบบ',
  enterprise_admin: 'admin ประจำวิสาหกิจชุมชน'
};

export default function AddUserModal({ entities, onClose, onSave }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');
  const [managedCommunityEnterpriseId, setManagedCommunityEnterpriseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!email.trim() && !phone.trim()) { setError('กรอกอีเมลหรือเบอร์โทรศัพท์อย่างน้อย 1 อย่าง'); return; }
    if (role === 'enterprise_admin' && !managedCommunityEnterpriseId) { setError('กรุณาเลือกวิสาหกิจชุมชนที่จะดูแล'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave({
        email: email.trim() || null, phone: phone.trim() || null, password, role,
        managedCommunityEnterpriseId: role === 'enterprise_admin' ? managedCommunityEnterpriseId : null
      });
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
          <h3 className="text-sm font-bold text-slate-700">เพิ่มผู้ใช้ใหม่</h3>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">อีเมล</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เบอร์โทรศัพท์</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0812345678" className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">สิทธิ์</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {role === 'enterprise_admin' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">วิสาหกิจชุมชนที่ดูแล</label>
              <select value={managedCommunityEnterpriseId} onChange={e => setManagedCommunityEnterpriseId(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">เลือกกลุ่ม...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-gray-200 p-4">
          <button disabled={busy} onClick={save} className="flex-1 rounded bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}
          </button>
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
