import { useEffect, useState } from 'react';
import { api } from '../api';

const ROLE_LABELS = {
  user: 'ผู้ใช้ทั่วไป',
  admin: 'admin ระบบ',
  enterprise_admin: 'admin ประจำวิสาหกิจชุมชน'
};

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState({});
  const [roleBusyId, setRoleBusyId] = useState(null);
  const [roleError, setRoleError] = useState('');

  async function reload() {
    try {
      const [u, e] = await Promise.all([api.listUsers(), api.listCommunityEnterprises()]);
      setUsers(u);
      setEntities(e);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { reload(); }, []);

  function draftFor(u) {
    return roleDrafts[u.id] || { role: u.role, managedCommunityEnterpriseId: u.managedCommunityEnterpriseId || '' };
  }

  function setDraft(u, patch) {
    setRoleDrafts(prev => ({ ...prev, [u.id]: { ...draftFor(u), ...patch } }));
  }

  async function applyRole(u) {
    const draft = draftFor(u);
    if (draft.role === 'enterprise_admin' && !draft.managedCommunityEnterpriseId) {
      setRoleError('กรุณาเลือกวิสาหกิจชุมชนที่จะดูแล');
      return;
    }
    setRoleBusyId(u.id);
    setRoleError('');
    try {
      const updated = await api.updateUserRole(u.id, draft.role, draft.managedCommunityEnterpriseId || null);
      setUsers(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      setRoleDrafts(prev => { const next = { ...prev }; delete next[u.id]; return next; });
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setRoleBusyId(null);
    }
  }

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
      {roleError && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{roleError}</div>}
      <ul className="divide-y divide-stone-100 text-sm">
        {users.map(u => {
          const draft = draftFor(u);
          const dirty = draft.role !== u.role || (draft.managedCommunityEnterpriseId || null) !== (u.managedCommunityEnterpriseId || null);
          return (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div>{[u.name, u.email, u.phone].filter(Boolean).join(' · ')}</div>
                <div className="text-xs text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={draft.role}
                  onChange={e => setDraft(u, { role: e.target.value, managedCommunityEnterpriseId: e.target.value === 'enterprise_admin' ? draft.managedCommunityEnterpriseId : '' })}
                  className="rounded border border-stone-300 px-2 py-1 text-xs"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {draft.role === 'enterprise_admin' && (
                  <select
                    value={draft.managedCommunityEnterpriseId}
                    onChange={e => setDraft(u, { managedCommunityEnterpriseId: e.target.value })}
                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                  >
                    <option value="">เลือกกลุ่ม...</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                )}
                {dirty && (
                  <button
                    disabled={roleBusyId === u.id}
                    onClick={() => applyRole(u)}
                    className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {roleBusyId === u.id ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {users.length === 0 && <li className="py-1.5 text-slate-400">ยังไม่มีผู้ใช้</li>}
      </ul>
    </div>
  );
}
