import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView from '../components/MapView';
import PlotsTable from '../components/PlotsTable';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

const STATUS_LABELS = {
  data_entry: 'ป้อนข้อมูลแปลง',
  tree_survey: 'สำรวจต้นไม้',
  submitted: 'ส่งแปลงตรวจสอบ',
  approved: 'ตรวจสอบผ่าน'
};

export default function Plots() {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [trees, setTrees] = useState([]);
  const [entities, setEntities] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [activeTab, setActiveTab] = useState('map');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ceFilter, setCeFilter] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const [p, t, e, pu] = await Promise.all([api.listPlots(), api.listTrees(), api.listCommunityEnterprises(), api.listPurposes()]);
      setPlots(p);
      setTrees(t);
      setEntities(e);
      setPurposes(pu);
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

  const filteredPlots = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedPlots.filter(p => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (ceFilter && p.communityEnterpriseId !== ceFilter) return false;
      if (q) {
        const haystack = [p.name, p.ownerName, p.ownerContact].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scopedPlots, statusFilter, ceFilter, search]);

  const filteredPlotIds = useMemo(() => new Set(filteredPlots.map(p => p.id)), [filteredPlots]);
  const filteredTrees = useMemo(() => trees.filter(t => filteredPlotIds.has(t.plotId)), [trees, filteredPlotIds]);

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
    { id: 'table', label: `📋 ตาราง (${filteredPlots.length})` }
  ];

  const filtersActive = !!(search.trim() || statusFilter || ceFilter);

  return (
    <div>
      <PageHeader
        title="แปลง"
        subtitle={filtersActive ? `แสดง ${filteredPlots.length} จากทั้งหมด ${scopedPlots.length} แปลง` : `ทั้งหมด ${scopedPlots.length} แปลง`}
        actions={
          <a href="/api/admin/export/plots.csv" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export แปลง (CSV)</a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อแปลง / เจ้าของ / เบอร์โทร"
          className="min-w-[220px] flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
        />
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-slate-600"
        >
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!isEnterpriseAdmin && (
          <select
            value={ceFilter} onChange={e => setCeFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-slate-600"
          >
            <option value="">ทุกวิสาหกิจชุมชน</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        {filtersActive && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCeFilter(''); }}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-700"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

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

          {filteredPlots.length === 0 ? (
            <div className="py-16 text-center text-slate-400">ไม่พบแปลงที่ตรงกับตัวกรอง</div>
          ) : activeTab === 'map' ? (
            <div className="h-[34rem]">
              <MapView plots={filteredPlots} trees={filteredTrees} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} />
            </div>
          ) : (
            <PlotsTable
              plots={filteredPlots} trees={filteredTrees} purposes={purposes} selectedPlotId={selectedPlotId}
              onSelectPlot={id => setSelectedPlotId(prev => prev === id ? null : id)}
              onSave={savePlot} onDelete={deletePlot} onUpdateStatus={updatePlotStatus}
            />
          )}
        </Card>
      )}
    </div>
  );
}
