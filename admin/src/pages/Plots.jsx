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
  const [activeTab, setActiveTab] = useState('map');
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

  const tabs = [
    { id: 'map', label: '🗺️ แผนที่' },
    { id: 'table', label: `📋 ตาราง (${scopedPlots.length})` }
  ];

  return (
    <div>
      <PageHeader
        title="แปลงต้นไม้"
        subtitle={`ทั้งหมด ${scopedPlots.length} แปลง`}
        actions={
          <a href="/api/admin/export/plots.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export แปลง (CSV)</a>
        }
      />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <Card noPadding>
          <div className="flex border-b border-gray-200 bg-gray-50">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'map' ? (
            <div className="h-[34rem]">
              <MapView plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} />
            </div>
          ) : (
            <PlotsTable
              plots={scopedPlots} trees={scopedTrees} selectedPlotId={selectedPlotId}
              onSelectPlot={id => setSelectedPlotId(prev => prev === id ? null : id)}
              onSave={savePlot} onDelete={deletePlot} onUpdateStatus={updatePlotStatus}
            />
          )}
        </Card>
      )}
    </div>
  );
}
