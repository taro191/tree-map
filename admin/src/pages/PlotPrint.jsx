import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView from '../components/MapView';

export default function PlotPrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const [plot, setPlot] = useState(null);
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [plots, allTrees] = await Promise.all([api.listPlots(), api.listTrees()]);
        const found = plots.find(p => p.id === id);
        if (!found) { setError('ไม่พบแปลงนี้'); return; }
        setPlot(found);
        setTrees(allTrees.filter(t => t.plotId === id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลดข้อมูล...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!plot) return null;

  const isEnterpriseAdmin = user?.role === 'enterprise_admin';
  if (isEnterpriseAdmin && plot.communityEnterpriseId !== user.managedCommunityEnterpriseId) {
    return <div className="p-8 text-center text-red-600">ไม่มีสิทธิ์เข้าถึงแปลงนี้</div>;
  }

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-slate-700">ผังต้นไม้: {plot.name}</h1>
        <button
          onClick={() => window.print()}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >🖨️ พิมพ์</button>
      </div>

      <div className="mb-3 text-sm text-slate-600">
        <p className="text-base font-bold text-slate-800">{plot.name}</p>
        <p>เจ้าของ: {plot.ownerName || '-'} · เบอร์ติดต่อ: {plot.ownerContact || '-'}</p>
        <p>ที่ตั้ง: {[plot.subdistrict, plot.district, plot.province].filter(Boolean).join(' ') || '-'} {plot.postcode || ''}</p>
        <p>เนื้อที่: {plot.areaRai || 0} ไร่ {plot.areaNgan || 0} งาน {plot.areaWa || 0} ตร.วา · จำนวนต้นไม้: {trees.length} ต้น</p>
      </div>

      <div className="h-[220mm] w-full overflow-hidden rounded border border-stone-300 print:rounded-none print:border-black">
        <MapView plots={[plot]} trees={trees} selectedPlotId={plot.id} onSelectPlot={() => {}} />
      </div>
    </div>
  );
}
