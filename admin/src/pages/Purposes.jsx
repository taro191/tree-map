import { useEffect, useState } from 'react';
import { api } from '../api';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';

export default function Purposes() {
  const [purposes, setPurposes] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      setPurposes(await api.listPurposes());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function createPurpose(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const created = await api.addPurpose(newName.trim());
      setPurposes(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(purpose) {
    setEditingId(purpose.id);
    setDraftName(purpose.name);
  }

  async function saveEdit(id) {
    if (!draftName.trim()) return;
    setBusyId(id);
    setError('');
    try {
      const updated = await api.updatePurpose(id, draftName.trim());
      setPurposes(prev => prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm('ลบวัตถุประสงค์นี้? แปลง/วิสาหกิจชุมชนที่เลือกไว้จะถูกล้างค่านี้ออก')) return;
    setBusyId(id);
    setError('');
    try {
      await api.deletePurpose(id);
      setPurposes(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader title="วัตถุประสงค์" subtitle="รายการวัตถุประสงค์ให้เลือกใช้กับแปลงและวิสาหกิจชุมชน เช่น เพื่อ carbon credit, เพื่อกลุ่มไร่อ้อย" />

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <Card title={`รายการวัตถุประสงค์ (${purposes.length})`}>
        <form onSubmit={createPurpose} className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">วัตถุประสงค์ใหม่</label>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="เช่น เพื่อ carbon credit"
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit" disabled={creating || !newName.trim()}
            className="rounded bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            {creating ? 'กำลังเพิ่ม...' : '+ เพิ่มวัตถุประสงค์'}
          </button>
        </form>

        {loading ? (
          <div className="py-8 text-center text-slate-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {purposes.map(p => {
              const isEditing = editingId === p.id;
              return (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  {isEditing ? (
                    <input
                      value={draftName} onChange={e => setDraftName(e.target.value)}
                      className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  <div className="flex shrink-0 gap-2">
                    {isEditing ? (
                      <>
                        <button disabled={busyId === p.id || !draftName.trim()} onClick={() => saveEdit(p.id)} className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">บันทึก</button>
                        <button onClick={() => setEditingId(null)} className="rounded border border-stone-300 px-2 py-1 text-xs">ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)} className="rounded border border-gray-300 px-2 py-1 text-xs hover:border-emerald-600 hover:text-emerald-700">แก้ไข</button>
                        <button disabled={busyId === p.id} onClick={() => remove(p.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">ลบ</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
            {purposes.length === 0 && <li className="py-4 text-center text-slate-400">ยังไม่มีวัตถุประสงค์</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}
