import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import CommunityEnterpriseCard from '../components/CommunityEnterpriseCard';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

export default function CommunityEnterprises() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [entities, setEntities] = useState([]);
  const [users, setUsers] = useState([]);
  const [plots, setPlots] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [e, u, p, pu] = await Promise.all([api.listCommunityEnterprises(), api.listUsers(), api.listPlots(), api.listPurposes()]);
      setEntities(e);
      setUsers(u);
      setPlots(p);
      setPurposes(pu);
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
    // Admin picking a plot directly here is treated as an immediate approval (no waiting on
    // the group's own review) -- link it (lands as 'pending' server-side), then approve right
    // away, which also grants the plot's owner membership. Reload since approval touches both
    // the plot's status and the group's member list.
    const saved = await api.savePlot({ ...plot, communityEnterpriseId: entityId });
    await api.approvePlotJoin(entityId, saved.id);
    await reload();
  }

  async function approvePendingPlot(entityId, plotId) {
    await api.approvePlotJoin(entityId, plotId);
    await reload();
  }

  async function unlinkPlot(plot) {
    const saved = await api.savePlot({ ...plot, communityEnterpriseId: null });
    setPlots(prev => prev.map(p => p.id === saved.id ? saved : p));
  }

  return (
    <div>
      <PageHeader title="วิสาหกิจชุมชน" subtitle="จัดการกลุ่ม, สมาชิก, และแปลงที่ดินที่สังกัด" />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        {isAdmin && (
          <Card title="เพิ่มวิสาหกิจชุมชนใหม่">
            <form onSubmit={createEntity} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-500">ชื่อวิสาหกิจชุมชนใหม่</label>
                <input
                  value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <button
                type="submit" disabled={creating || !newName.trim()}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {creating ? 'กำลังเพิ่ม...' : '+ เพิ่มกลุ่ม'}
              </button>
            </form>
          </Card>
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
                purposes={purposes}
                canDelete={isAdmin}
                onSave={saveEntity}
                onDelete={deleteEntity}
                onAddMember={addMember}
                onRemoveMember={removeMember}
                onLinkPlot={linkPlot}
                onUnlinkPlot={unlinkPlot}
                onApprovePlot={approvePendingPlot}
              />
            ))}
            {entities.length === 0 && <div className="py-8 text-center text-slate-400">ยังไม่มีวิสาหกิจชุมชน</div>}
          </div>
        )}
      </div>
    </div>
  );
}
