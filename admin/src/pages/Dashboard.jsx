import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView from '../components/MapView';
import PlotsTable from '../components/PlotsTable';
import TreesTable from '../components/TreesTable';

export default function Dashboard() {
  const { user, logout } = useAuth();
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

  const plotsById = useMemo(() => new Map(plots.map(p => [p.id, p])), [plots]);
  const visibleTrees = onlySelectedPlotTrees && selectedPlotId
    ? trees.filter(t => t.plotId === selectedPlotId)
    : trees;

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

  async function saveTree(tree) {
    const saved = await api.saveTree(tree);
    setTrees(prev => prev.map(t => t.id === saved.id ? saved : t));
  }

  async function deleteTree(id) {
    await api.deleteTree(id);
    setTrees(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-lg font-bold text-emerald-900">🌳 แผนที่ต้นไม้ · Admin</h1>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/export/plots.csv" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:border-emerald-700">Export แปลง (CSV)</a>
          <a href="/api/admin/export/trees.csv" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:border-emerald-700">Export ต้นไม้ (CSV)</a>
          <a href="/api/admin/export/geojson" className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold hover:border-emerald-700">Export GeoJSON</a>
          <button onClick={logout} className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900">ออกจากระบบ</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            <div className="h-96 overflow-hidden rounded-xl border border-stone-200">
              <MapView plots={plots} trees={trees} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} />
            </div>

            <section>
              <h2 className="mb-2 text-sm font-bold text-slate-700">แปลงที่ดิน ({plots.length})</h2>
              <PlotsTable
                plots={plots} trees={trees} selectedPlotId={selectedPlotId}
                onSelectPlot={id => setSelectedPlotId(prev => prev === id ? null : id)}
                onSave={savePlot} onDelete={deletePlot}
              />
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700">ต้นไม้ ({visibleTrees.length})</h2>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={onlySelectedPlotTrees} onChange={e => setOnlySelectedPlotTrees(e.target.checked)} disabled={!selectedPlotId} />
                  แสดงเฉพาะแปลงที่เลือกบนแผนที่/ตาราง
                </label>
              </div>
              <TreesTable trees={visibleTrees} plotsById={plotsById} onSave={saveTree} onDelete={deleteTree} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
