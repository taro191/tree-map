import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import CommunityEnterpriseCard from '../components/CommunityEnterpriseCard';

export default function CommunityEnterprises() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [entities, setEntities] = useState([]);
  const [users, setUsers] = useState([]);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [e, u, p] = await Promise.all([api.listCommunityEnterprises(), api.listUsers(), api.listPlots()]);
      setEntities(e);
      setUsers(u);
      setPlots(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function createEntity(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.saveCommunityEnterprise({ id: crypto.randomUUID(), name: newName.trim() });
      setNewName('');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveEntity(draft) {
    const saved = await api.saveCommunityEnterprise(draft);
    setEntities(prev => prev.map(e => e.id === saved.id ? { ...saved, members: e.members } : e));
  }

  async function deleteEntity(id) {
    await api.deleteCommunityEnterprise(id);
    setEntities(prev => prev.filter(e => e.id !== id));
  }

  async function addMember(entityId, userId) {
    const members = await api.addCommunityEnterpriseMember(entityId, userId);
    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, members } : e));
  }

  async function removeMember(entityId, userId) {
    await api.removeCommunityEnterpriseMember(entityId, userId);
    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, members: e.members.filter(m => m.id !== userId) } : e));
  }

  async function linkPlot(plot, entityId) {
    const saved = await api.savePlot({ ...plot, communityEnterpriseId: entityId });
    setPlots(prev => prev.map(p => p.id === saved.id ? saved : p));
  }

  async function unlinkPlot(plot) {
    const saved = await api.savePlot({ ...plot, communityEnterpriseId: null });
    setPlots(prev => prev.map(p => p.id === saved.id ? saved : p));
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-emerald-900">🌳 วิสาหกิจชุมชน</h1>
          <p className="text-xs text-slate-500">จัดการกลุ่ม, สมาชิก, และแปลงที่ดินที่สังกัด</p>
        </div>
        <Link to="/" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:border-emerald-700">← กลับหน้าแดชบอร์ด</Link>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {isAdmin && (
          <form onSubmit={createEntity} className="flex items-end gap-2 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">ชื่อวิสาหกิจชุมชนใหม่</label>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <button
              type="submit" disabled={creating || !newName.trim()}
              className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {creating ? 'กำลังเพิ่ม...' : '+ เพิ่มกลุ่ม'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="space-y-4">
            {entities.map(entity => (
              <CommunityEnterpriseCard
                key={entity.id}
                entity={entity}
                users={users}
                plots={plots}
                canDelete={isAdmin}
                onSave={saveEntity}
                onDelete={deleteEntity}
                onAddMember={addMember}
                onRemoveMember={removeMember}
                onLinkPlot={linkPlot}
                onUnlinkPlot={unlinkPlot}
              />
            ))}
            {entities.length === 0 && <div className="py-8 text-center text-slate-400">ยังไม่มีวิสาหกิจชุมชน</div>}
          </div>
        )}
      </main>
    </div>
  );
}
