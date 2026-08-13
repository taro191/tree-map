import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import TreesTable from '../components/TreesTable';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

export default function Trees() {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [trees, setTrees] = useState([]);
  const [filterPlotId, setFilterPlotId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [p, t] = await Promise.all([api.listPlots(), api.listTrees()]);
      setPlots(p);
      setTrees(t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const isEnterpriseAdmin = user?.role === 'enterprise_admin';
  const scopedPlots = useMemo(() => (
    isEnterpriseAdmin ? plots.filter(p => p.communityEnterpriseId === user.managedCommunityEnterpriseId) : plots
  ), [plots, isEnterpriseAdmin, user]);
  const scopedPlotIds = useMemo(() => new Set(scopedPlots.map(p => p.id)), [scopedPlots]);
  const scopedTrees = useMemo(() => (
    isEnterpriseAdmin ? trees.filter(t => scopedPlotIds.has(t.plotId)) : trees
  ), [trees, isEnterpriseAdmin, scopedPlotIds]);
  const plotsById = useMemo(() => new Map(scopedPlots.map(p => [p.id, p])), [scopedPlots]);
  const visibleTrees = filterPlotId ? scopedTrees.filter(t => t.plotId === filterPlotId) : scopedTrees;

  async function saveTree(tree) {
    const saved = await api.saveTree(tree);
    setTrees(prev => prev.map(t => t.id === saved.id ? saved : t));
  }

  async function deleteTree(id) {
    await api.deleteTree(id);
    setTrees(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="ต้นไม้"
        subtitle={`ทั้งหมด ${scopedTrees.length} ต้น`}
        actions={
          <a href="/api/admin/export/trees.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export ต้นไม้ (CSV)</a>
        }
      />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <Card
          title={`รายการต้นไม้ (${visibleTrees.length})`}
          noPadding
          headerRight={
            <select
              value={filterPlotId} onChange={e => setFilterPlotId(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-normal text-slate-600"
            >
              <option value="">ทุกแปลง</option>
              {scopedPlots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          }
        >
          <TreesTable trees={visibleTrees} plotsById={plotsById} onSave={saveTree} onDelete={deleteTree} />
        </Card>
      )}
    </div>
  );
}
