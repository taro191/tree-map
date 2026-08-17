import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import MapView, { computeBounds } from '../components/MapView';

// Fills the A4 printable area (210x297mm minus the 12mm @page margin on
// each side): full 186mm width, and enough height to leave room above for
// the plot-info text block while still nearly filling the 273mm content height.
const MAP_W_MM = 186;
const MAP_H_MM = 240;

// The map is loaded at a size bigger than the frame in every direction, so a
// 90/270deg rotation (which doesn't change a square's footprint) always
// leaves the frame fully covered by real map content -- the overflow is
// simply clipped by the frame instead of needing to shrink to fit.
const CONTENT_SIZE_MM = 250;

// Each +/- click moves half a zoom level for finer control; the map itself
// must allow fractional zoom (see zoomSnap on MapView below) or Leaflet
// would just round this back to a whole level.
const ZOOM_STEP = 0.5;

function NorthArrow({ rotation }) {
  return (
    <div
      className="absolute right-3 top-3 z-[500] flex flex-col items-center rounded-full bg-white/90 p-1.5 shadow"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg width="22" height="26" viewBox="0 0 22 26">
        <polygon points="11,0 18,18 11,13.5" fill="#111827" />
        <polygon points="11,0 4,18 11,13.5" fill="#d1d5db" />
      </svg>
      <span className="text-[10px] font-bold leading-none text-slate-800">N</span>
    </div>
  );
}

// A custom zoom control, since the built-in Leaflet one lives inside the
// oversized/rotated map content (see CONTENT_SIZE_MM below) and would be
// clipped away by the frame no matter which corner it's anchored to.
function ZoomButtons({ onZoomIn, onZoomOut }) {
  return (
    <div className="absolute right-12 top-3 z-[500] flex flex-col overflow-hidden rounded shadow print:hidden">
      <button
        onClick={onZoomIn}
        className="flex h-7 w-7 items-center justify-center border-b border-gray-200 bg-white text-base font-bold leading-none text-slate-700 hover:bg-gray-100"
      >+</button>
      <button
        onClick={onZoomOut}
        className="flex h-7 w-7 items-center justify-center bg-white text-base font-bold leading-none text-slate-700 hover:bg-gray-100"
      >−</button>
    </div>
  );
}

export default function PlotPrint() {
  const { id } = useParams();
  const { user } = useAuth();
  const [plot, setPlot] = useState(null);
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rotation, setRotation] = useState(0);
  const mapRef = useRef(null);

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

  function rotateBy(delta) {
    setRotation(r => (r + delta + 360) % 360);
  }

  function centerToFrame() {
    const map = mapRef.current;
    const bounds = computeBounds([plot], trees);
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: [8, 8] });
  }

  function zoomBy(delta) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta * ZOOM_STEP);
  }

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-slate-700">ผังต้นไม้: {plot.name}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => rotateBy(-90)} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">⟲ หมุนซ้าย 90°</button>
          <button onClick={centerToFrame} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">🎯 เซนเตอร์</button>
          <button onClick={() => rotateBy(90)} className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">⟳ หมุนขวา 90°</button>
          <button
            onClick={() => window.print()}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >🖨️ พิมพ์</button>
        </div>
      </div>

      <div className="mb-3 text-sm text-slate-600">
        <p className="text-base font-bold text-slate-800">{plot.name}</p>
        <p>เจ้าของ: {plot.ownerName || '-'} · เบอร์ติดต่อ: {plot.ownerContact || '-'}</p>
        <p>ที่ตั้ง: {[plot.subdistrict, plot.district, plot.province].filter(Boolean).join(' ') || '-'} {plot.postcode || ''}</p>
        <p>เนื้อที่: {plot.areaRai || 0} ไร่ {plot.areaNgan || 0} งาน {plot.areaWa || 0} ตร.วา · จำนวนต้นไม้: {trees.length} ต้น</p>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded border border-stone-300 print:rounded-none print:border-black"
        style={{ width: `${MAP_W_MM}mm`, height: `${MAP_H_MM}mm`, clipPath: 'inset(0)' }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: `${CONTENT_SIZE_MM}mm`, height: `${CONTENT_SIZE_MM}mm`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
        >
          <MapView
            plots={[plot]} trees={trees} selectedPlotId={plot.id} onSelectPlot={() => {}}
            onMapReady={m => { mapRef.current = m; }}
            zoomControl={false}
            zoomSnap={ZOOM_STEP}
          />
        </div>
        <ZoomButtons onZoomIn={() => zoomBy(1)} onZoomOut={() => zoomBy(-1)} />
        <NorthArrow rotation={rotation} />
      </div>
    </div>
  );
}
