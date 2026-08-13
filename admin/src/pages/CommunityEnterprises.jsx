import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import CommunityEnterpriseCard from '../components/CommunityEnterpriseCard';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

function CommunityEnterpriseDetailModal({ onClose, ...cardProps }) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow hover:bg-gray-100">✕ ปิด</button>
        </div>
        <CommunityEnterpriseCard {...cardProps} />
      </div>
    </div>
  );
}

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
  const [managingId, setManagingId] = useState(null);

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
    setManagingId(prev => prev === id ? null : prev);
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

  const purposesById = useMemo(() => new Map(purposes.map(p => [p.id, p.name])), [purposes]);
  const managingEntity = entities.find(e => e.id === managingId) || null;

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
          <Card title={`รายชื่อวิสาหกิจชุมชน (${entities.length})`} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">ชื่อกลุ่ม</th>
                    <th className="px-3 py-2">วัตถุประสงค์หลัก</th>
                    <th className="px-3 py-2">ที่ตั้ง</th>
                    <th className="px-3 py-2">สมาชิก</th>
                    <th className="px-3 py-2">แปลงที่อนุมัติ</th>
                    <th className="px-3 py-2">รออนุมัติ</th>
                    <th className="px-3 py-2">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entities.map(entity => {
                    const approvedCount = plots.filter(p => p.communityEnterpriseId === entity.id && p.communityEnterpriseStatus === 'approved').length;
                    const pendingCount = plots.filter(p => p.communityEnterpriseId === entity.id && p.communityEnterpriseStatus === 'pending').length;
                    return (
                      <tr key={entity.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2 font-semibold text-slate-700">{entity.name}</td>
                        <td className="px-3 py-2">
                          {entity.purposeId && purposesById.has(entity.purposeId) ? purposesById.get(entity.purposeId) : 'ยังไม่กำหนดวัตถุประสงค์'}
                        </td>
                        <td className="px-3 py-2">{[entity.district, entity.province].filter(Boolean).join(' ') || '-'}</td>
                        <td className="px-3 py-2">{entity.members.length}</td>
                        <td className="px-3 py-2">{approvedCount}</td>
                        <td className="px-3 py-2">
                          {pendingCount > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{pendingCount}</span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setManagingId(entity.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs hover:border-emerald-600 hover:text-emerald-700"
                          >
                            จัดการ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {entities.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">ยังไม่มีวิสาหกิจชุมชน</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {managingEntity && (
        <CommunityEnterpriseDetailModal
          onClose={() => setManagingId(null)}
          entity={managingEntity}
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
      )}
    </div>
  );
}
