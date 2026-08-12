import { useState } from 'react';

export default function TreesTable({ trees, plotsById, onSave, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [busyId, setBusyId] = useState(null);

  function startEdit(tree) {
    setEditingId(tree.id);
    setDraft({ ...tree });
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
    if (!confirm('ลบต้นไม้นี้?')) return;
    setBusyId(id);
    try {
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">แปลง</th>
            <th className="px-3 py-2">ลำดับ</th>
            <th className="px-3 py-2">ชื่อ/สายพันธุ์</th>
            <th className="px-3 py-2">หมายเหตุ</th>
            <th className="px-3 py-2">พิกัด</th>
            <th className="px-3 py-2">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {trees.map(t => {
            const isEditing = editingId === t.id;
            return (
              <tr key={t.id} className="hover:bg-stone-50">
                <td className="px-3 py-2">{(plotsById.get(t.plotId) || {}).name || '-'}</td>
                <td className="px-3 py-2">{t.seq}</td>
                <td className="px-3 py-2">
                  {isEditing
                    ? <input value={draft.name || ''} onChange={e => setDraft({ ...draft, name: e.target.value })} className="w-32 rounded border border-stone-300 px-1.5 py-1 text-xs" />
                    : (t.name || '-')}
                </td>
                <td className="px-3 py-2">
                  {isEditing
                    ? <input value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} className="w-40 rounded border border-stone-300 px-1.5 py-1 text-xs" />
                    : (t.note || '-')}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{t.lat.toFixed(5)}, {t.lng.toFixed(5)}</td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button disabled={busyId === t.id} onClick={save} className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">บันทึก</button>
                      <button onClick={() => setEditingId(null)} className="rounded border border-stone-300 px-2 py-1 text-xs">ยกเลิก</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(t)} className="rounded border border-stone-300 px-2 py-1 text-xs hover:border-emerald-700">แก้ไข</button>
                      <button disabled={busyId === t.id} onClick={() => remove(t.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">ลบ</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {trees.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">ยังไม่มีต้นไม้</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
