import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import InfoBox from '../components/InfoBox';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const { user } = useAuth();
  const [plots, setPlots] = useState([]);
  const [trees, setTrees] = useState([]);
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

  const identityLine = [user?.email, user?.phone].filter(Boolean).join(' · ');

  return (
    <div>
      <PageHeader
        title="แดชบอร์ด"
        subtitle={identityLine || undefined}
        actions={
          <a href="/api/admin/export/geojson" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">📥 Export GeoJSON</a>
        }
      />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoBox icon="📍" label="แปลงที่ดิน" value={scopedPlots.length} color="blue" />
          <InfoBox icon="🌳" label="ต้นไม้" value={scopedTrees.length} color="green" />
          {isEnterpriseAdmin ? (
            <InfoBox icon="🏢" label="สิทธิ์ปัจจุบัน" value="admin วิสาหกิจชุมชน" color="amber" />
          ) : (
            <InfoBox icon="🛡️" label="สิทธิ์ปัจจุบัน" value="admin ระบบ" color="slate" />
          )}
        </div>
      )}
    </div>
  );
}
