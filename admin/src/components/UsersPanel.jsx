import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import Card from './Card';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import ChangePasswordModal from './ChangePasswordModal';

const ROLE_LABELS = {
  user: 'ผู้ใช้ทั่วไป',
  admin: 'admin ระบบ',
  enterprise_admin: 'admin ประจำวิสาหกิจชุมชน'
};

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [filterCe, setFilterCe] = useState('');
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);

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

  // A user is "affiliated" with a community enterprise either by being a plain member
  // (community_enterprise_members) or by being the enterprise_admin who manages it.
  const affiliatedEntityIdsById = useMemo(() => {
    const map = new Map();
    function add(userId, entityId) {
      const set = map.get(userId) || new Set();
      set.add(entityId);
      map.set(userId, set);
    }
    entities.forEach(e => {
      (e.members || []).forEach(m => add(m.id, e.id));
    });
    users.forEach(u => {
      if (u.role === 'enterprise_admin' && u.managedCommunityEnterpriseId) add(u.id, u.managedCommunityEnterpriseId);
    });
    return map;
  }, [entities, users]);

  const entityNameById = useMemo(() => new Map(entities.map(e => [e.id, e.name])), [entities]);

  const filteredUsers = useMemo(() => {
    if (!filterCe) return users;
    return users.filter(u => (affiliatedEntityIdsById.get(u.id) || new Set()).has(filterCe));
  }, [users, affiliatedEntityIdsById, filterCe]);

  async function addUser(data) {
    await api.addUser(data.email, data.phone, data.password, data.role, data.managedCommunityEnterpriseId);
    await reload();
  }

  async function saveEdit(data) {
    await api.updateUserProfile(editingUser.id, { name: data.name, email: data.email, phone: data.phone });
    const roleChanged = data.role !== editingUser.role
      || (data.managedCommunityEnterpriseId || null) !== (editingUser.managedCommunityEnterpriseId || null);
    if (roleChanged) {
      await api.updateUserRole(editingUser.id, data.role, data.managedCommunityEnterpriseId);
    }
    await reload();
  }

  async function savePassword(password) {
    await api.updateUserPassword(passwordUser.id, password);
  }

  return (
    <Card
      title={`ผู้ใช้ระบบ admin (${filteredUsers.length})`}
      noPadding
      headerRight={
        <div className="flex items-center gap-2">
          <select
            value={filterCe} onChange={e => setFilterCe(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-normal text-slate-600"
          >
            <option value="">ทุกวิสาหกิจชุมชน</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-900"
          >
            + เพิ่มผู้ใช้ใหม่
          </button>
        </div>
      }
    >
      {error && <div className="m-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">ชื่อ / อีเมล / เบอร์โทร</th>
              <th className="px-3 py-2">สิทธิ์</th>
              <th className="px-3 py-2">วิสาหกิจชุมชน</th>
              <th className="px-3 py-2">วันที่สร้าง</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map(u => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-700">{u.name || '-'}</div>
                  <div className="text-xs text-slate-400">{[u.email, u.phone].filter(Boolean).join(' · ') || '-'}</div>
                </td>
                <td className="px-3 py-2 text-xs">{ROLE_LABELS[u.role] || u.role}</td>
                <td className="px-3 py-2 text-xs">
                  {[...(affiliatedEntityIdsById.get(u.id) || [])].map(id => entityNameById.get(id)).filter(Boolean).join(', ') || '-'}
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : ''}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs hover:border-emerald-600 hover:text-emerald-700"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setPasswordUser(u)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs hover:border-amber-500 hover:text-amber-700"
                    >
                      เปลี่ยนรหัสผ่าน
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">ไม่มีผู้ใช้</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddUserModal entities={entities} onClose={() => setShowAdd(false)} onSave={addUser} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} entities={entities} onClose={() => setEditingUser(null)} onSave={saveEdit} />
      )}
      {passwordUser && (
        <ChangePasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} onSave={savePassword} />
      )}
    </Card>
  );
}
