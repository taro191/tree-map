import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView from '../components/MapView';
import PlotsTable from '../components/PlotsTable';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

export default function Plots() {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [trees, setTrees] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState(null);
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

  return (
    <div>
      <PageHeader
        title="แปลงที่ดิน"
        subtitle={`ทั้งหมด ${scopedPlots.length} แปลง`}
        actions={
          <a href="/api/admin/export/plots.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export แปลง (CSV)</a>
        }
      />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="space-y-5">
          <Card title="แผนที่แปลงที่ดิน" noPadding>
            <div className="h-96">
              <MapView plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} />
            </div>
          </Card>

          <Card title={`รายการแปลง (${scopedPlots.length})`} noPadding>
            <PlotsTable
              plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId}
              onSelectPlot={id => setSelectedPlotId(prev => prev === id ? null : id)}
              onSave={savePlot} onDelete={deletePlot} onUpdateStatus={updatePlotStatus}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
