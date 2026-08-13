import { useState } from 'react';
import PlotStatusModal from './PlotStatusModal';

const FIELDS = [
  ['name', 'ชื่อแปลง'],
  ['ownerName', 'เจ้าของ'],
  ['ownerContact', 'เบอร์ติดต่อ'],
  ['docTitle', 'เอกสารสิทธิ์'],
  ['areaRai', 'ไร่'],
  ['areaNgan', 'งาน'],
  ['areaWa', 'ตร.วา'],
  ['district', 'อำเภอ'],
  ['province', 'จังหวัด'],
  ['postcode', 'รหัสไปรษณีย์']
];

const STATUS_LABELS = {
  data_entry: 'ป้อนข้อมูลแปลง',
  tree_survey: 'สำรวจต้นไม้',
  submitted: 'ส่งแปลงตรวจสอบ',
  approved: 'ตรวจสอบผ่าน'
};

const STATUS_COLORS = {
  data_entry: 'bg-gray-500',
  tree_survey: 'bg-blue-600',
  submitted: 'bg-amber-500',
  approved: 'bg-emerald-600'
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${STATUS_COLORS[status] || 'bg-gray-500'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function PlotsTable({ plots, trees, purposes = [], selectedPlotId, onSelectPlot, onSave, onDelete, onUpdateStatus }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [reviewingPlot, setReviewingPlot] = useState(null);
  const purposesById = new Map(purposes.map(p => [p.id, p.name]));

  function startEdit(plot) {
    setEditingId(plot.id);
    setDraft({ ...plot });
  }

  async function save() {
    setBusyId(editingId);
    try {
      await onSave(draft);
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm('ลบแปลงนี้และต้นไม้ทั้งหมดในแปลง?')) return;
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">สถานะ</th>
            {FIELDS.map(([key, label]) => <th key={key} className="px-3 py-2">{label}</th>)}
            <th className="px-3 py-2">วัตถุประสงค์</th>
            <th className="px-3 py-2">ต้นไม้</th>
            <th className="px-3 py-2">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {plots.map(p => {
            const isEditing = editingId === p.id;
            const locked = p.status === 'submitted' || p.status === 'approved';
            const treeCount = trees.filter(t => t.plotId === p.id).length;
            return (
              <tr
                key={p.id}
                onClick={() => !isEditing && onSelectPlot(p.id)}
                className={`cursor-pointer ${p.id === selectedPlotId ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}
              >
                <td className="px-3 py-2"><StatusBadge status={p.status || 'data_entry'} /></td>
                {FIELDS.map(([key]) => (
                  <td key={key} className="px-3 py-2">
                    {isEditing ? (
                      <input
                        value={draft[key] || ''}
                        onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                        onClick={e => e.stopPropagation()}
                        className="w-24 rounded border border-stone-300 px-1.5 py-1 text-xs"
                      />
                    ) : (p[key] || '-')}
                  </td>
                ))}
                <td className="px-3 py-2" onClick={e => isEditing && e.stopPropagation()}>
                  {isEditing ? (
                    <select
                      value={draft.purposeId || ''}
                      onChange={e => setDraft({ ...draft, purposeId: e.target.value || null })}
                      className="w-32 rounded border border-stone-300 px-1.5 py-1 text-xs"
                    >
                      <option value="">ยังไม่กำหนดวัตถุประสงค์</option>
                      {purposes.map(pu => <option key={pu.id} value={pu.id}>{pu.name}</option>)}
                    </select>
                  ) : (purposesById.get(p.purposeId) || 'ยังไม่กำหนดวัตถุประสงค์')}
                </td>
                <td className="px-3 py-2">{treeCount}</td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button disabled={busyId === p.id} onClick={save} className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">บันทึก</button>
                      <button onClick={() => setEditingId(null)} className="rounded border border-stone-300 px-2 py-1 text-xs">ยกเลิก</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={locked} title={locked ? 'ต้องเปลี่ยนสถานะกลับก่อนจึงจะแก้ไขได้' : ''}
                        onClick={() => startEdit(p)}
                        className="rounded border border-stone-300 px-2 py-1 text-xs hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >แก้ไข</button>
                      <button onClick={() => setReviewingPlot(p)} className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">จัดการสถานะ</button>
                      <button disabled={busyId === p.id} onClick={() => remove(p.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">ลบ</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {plots.length === 0 && (
            <tr><td colSpan={FIELDS.length + 4} className="px-3 py-6 text-center text-slate-400">ยังไม่มีแปลง</td></tr>
          )}
        </tbody>
      </table>
      {reviewingPlot && (
        <PlotStatusModal
          plot={reviewingPlot}
          onClose={() => setReviewingPlot(null)}
          onSave={(status, note, photos) => onUpdateStatus(reviewingPlot.id, status, note, photos)}
        />
      )}
    </div>
  );
}
