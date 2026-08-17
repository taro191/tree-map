import MapView from './MapView';

export default function PlotLayoutModal({ plot, trees, onClose }) {
  const plotTrees = trees.filter(t => t.plotId === plot.id);

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-2xl rounded-lg bg-white p-4 shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">ผังต้นไม้: {plot.name}</h3>
          <button onClick={onClose} className="rounded bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow hover:bg-gray-100">✕ ปิด</button>
        </div>
        <div className="h-[28rem] overflow-hidden rounded-lg border border-stone-200">
          <MapView plots={[plot]} trees={plotTrees} selectedPlotId={plot.id} onSelectPlot={() => {}} />
        </div>
        {plotTrees.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">แปลงนี้ยังไม่มีต้นไม้</p>
        )}
      </div>
    </div>
  );
}
