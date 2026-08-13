import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView from '../components/MapView';
import PlotsTable from '../components/PlotsTable';
import TreesTable from '../components/TreesTable';
import UsersPanel from '../components/UsersPanel';
import Card from '../components/Card';
import InfoBox from '../components/InfoBox';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [trees, setTrees] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlySelectedPlotTrees, setOnlySelectedPlotTrees] = useState(false);

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
  const visibleTrees = onlySelectedPlotTrees && selectedPlotId
    ? scopedTrees.filter(t => t.plotId === selectedPlotId)
    : scopedTrees;

  async function savePlot(plot) {
    const saved = await api.savePlot(plot);
    setPlots(prev => prev.map(p => p.id === saved.id ? saved : p));
  }

  async function deletePlot(id) {
    await api.deletePlot(id);
    setPlots(prev => prev.filter(p => p.id !== id));
    setTrees(prev => prev.filter(t => t.plotId !== id));
    if (selectedPlotId === id) setSelectedPlotId(null);
  }

  async function updatePlotStatus(id, status, note, photos) {
    const updated = await api.updatePlotStatus(id, status, note, photos);
    setPlots(prev => prev.map(p => p.id === updated.id ? updated : p));
  }

  async function saveTree(tree) {
    const saved = await api.saveTree(tree);
    setTrees(prev => prev.map(t => t.id === saved.id ? saved : t));
  }

  async function deleteTree(id) {
    await api.deleteTree(id);
    setTrees(prev => prev.filter(t => t.id !== id));
  }

  const identityLine = [user?.email, user?.phone].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        subtitle={identityLine || undefined}
        actions={
          <>
            <a href="/api/admin/export/plots.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export แปลง (CSV)</a>
            <a href="/api/admin/export/trees.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export ต้นไม้ (CSV)</a>
            <a href="/api/admin/export/geojson" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export GeoJSON</a>
          </>
        }
      />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox icon="📍" label="แปลงที่ดิน" value={scopedPlots.length} color="blue" />
            <InfoBox icon="🌳" label="ต้นไม้" value={scopedTrees.length} color="green" />
            {isEnterpriseAdmin ? (
              <InfoBox icon="🏢" label="สิทธิ์ปัจจุบัน" value="admin วิสาหกิจชุมชน" color="amber" />
            ) : (
              <InfoBox icon="🛡️" label="สิทธิ์ปัจจุบัน" value="admin ระบบ" color="slate" />
            )}
          </div>

          <Card title="แผนที่ภาพรวม" noPadding>
            <div className="h-96">
              <MapView plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} />
            </div>
          </Card>

          <Card title={`แปลงที่ดิน (${scopedPlots.length})`} noPadding>
            <PlotsTable
              plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId}
              onSelectPlot={id => setSelectedPlotId(prev => prev === id ? null : id)}
              onSave={savePlot} onDelete={deletePlot} onUpdateStatus={updatePlotStatus}
            />
          </Card>

          <Card
            title={`ต้นไม้ (${visibleTrees.length})`}
            noPadding
            headerRight={
              <label className="flex items-center gap-2 text-xs font-normal text-slate-500">
                <input type="checkbox" checked={onlySelectedPlotTrees} onChange={e => setOnlySelectedPlotTrees(e.target.checked)} disabled={!selectedPlotId} />
                แสดงเฉพาะแปลงที่เลือกบนแผนที่/ตาราง
              </label>
            }
          >
            <TreesTable trees={visibleTrees} plotsById={plotsById} onSave={saveTree} onDelete={deleteTree} />
          </Card>

          {user?.role === 'admin' && <UsersPanel />}
        </div>
      )}
    </div>
  );
}
