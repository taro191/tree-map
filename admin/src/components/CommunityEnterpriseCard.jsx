import { useState } from 'react';

const FIELDS = [
  ['name', 'ชื่อกลุ่ม', 'text'],
  ['registrationNo', 'เลขทะเบียน', 'text'],
  ['district', 'อำเภอ', 'text'],
  ['province', 'จังหวัด', 'text'],
  ['postcode', 'รหัสไปรษณีย์', 'text'],
  ['registeredDate', 'วันที่จดทะเบียน', 'date'],
  ['chairperson', 'ประธาน/ผู้แทนกลุ่ม', 'text'],
  ['contactPhone', 'เบอร์ติดต่อ', 'tel']
];

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CommunityEnterpriseCard({ entity, users, plots, canDelete = true, onSave, onDelete, onAddMember, onRemoveMember, onLinkPlot, onUnlinkPlot }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newPlotId, setNewPlotId] = useState('');

  const memberIds = new Set(entity.members.map(m => m.id));
  const availableUsers = users.filter(u => !memberIds.has(u.id));
  const linkedPlots = plots.filter(p => p.communityEnterpriseId === entity.id);
  const unlinkedPlots = plots.filter(p => !p.communityEnterpriseId);

  function startEdit() {
    setDraft({ ...entity });
    setEditing(true);
    setError('');
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (entity.members.length > 0) return;
    if (!confirm(`ลบกลุ่ม "${entity.name}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await onDelete(entity.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDocumentFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setDraft(d => ({ ...d, documentPhoto: dataUrl }));
  }

  async function addMember() {
    if (!newMemberId) return;
    setBusy(true);
    setError('');
    try {
      await onAddMember(entity.id, newMemberId);
      setNewMemberId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId) {
    setBusy(true);
    setError('');
    try {
      await onRemoveMember(entity.id, userId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function linkPlot() {
    if (!newPlotId) return;
    const plot = plots.find(p => p.id === newPlotId);
    if (!plot) return;
    setBusy(true);
    setError('');
    try {
      await onLinkPlot(plot, entity.id);
      setNewPlotId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlinkPlot(plot) {
    setBusy(true);
    setError('');
    try {
      await onUnlinkPlot(plot);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FIELDS.map(([key, label, type]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
                <input
                  type={type} value={draft[key] || ''}
                  onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                  className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">วัตถุประสงค์/ประเภทกิจการ</label>
            <textarea
              value={draft.purpose || ''} onChange={e => setDraft({ ...draft, purpose: e.target.value })}
              rows={2} className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เอกสารจดทะเบียน (รูป/ไฟล์)</label>
            <input type="file" accept="image/*" onChange={onDocumentFile} className="text-xs" />
            {draft.documentPhoto && <span className="ml-2 text-xs text-emerald-700">แนบไฟล์แล้ว</span>}
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="rounded bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">บันทึก</button>
            <button onClick={() => setEditing(false)} className="rounded border border-stone-300 px-3 py-1.5 text-xs">ยกเลิก</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">{entity.name}</h3>
              <p className="text-xs text-slate-500">
                {[entity.registrationNo, [entity.district, entity.province].filter(Boolean).join(' '), entity.postcode].filter(Boolean).join(' · ') || '-'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {[entity.chairperson && `ประธาน: ${entity.chairperson}`, entity.contactPhone, entity.registeredDate].filter(Boolean).join(' · ')}
              </p>
              {entity.purpose && <p className="mt-1 text-xs text-slate-600">{entity.purpose}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={startEdit} className="rounded border border-stone-300 px-2 py-1 text-xs hover:border-emerald-700">แก้ไข</button>
              {canDelete && (
                <button
                  disabled={busy || entity.members.length > 0} onClick={remove}
                  title={entity.members.length > 0 ? 'ต้องนำสมาชิกออกให้หมดก่อนจึงจะลบได้' : ''}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ลบ
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-bold text-slate-600">สมาชิก ({entity.members.length})</h4>
              <ul className="mb-2 divide-y divide-stone-100 text-xs">
                {entity.members.map(m => (
                  <li key={m.id} className="flex items-center justify-between py-1">
                    <span>{[m.email, m.phone].filter(Boolean).join(' · ')}</span>
                    <button disabled={busy} onClick={() => removeMember(m.id)} className="text-red-600 hover:underline disabled:opacity-50">นำออก</button>
                  </li>
                ))}
                {entity.members.length === 0 && <li className="py-1 text-slate-400">ยังไม่มีสมาชิก</li>}
              </ul>
              <div className="flex gap-2">
                <select value={newMemberId} onChange={e => setNewMemberId(e.target.value)} className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs">
                  <option value="">เลือกผู้ใช้ที่ลงทะเบียนแล้ว...</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{[u.email, u.phone].filter(Boolean).join(' · ')}</option>
                  ))}
                </select>
                <button disabled={busy || !newMemberId} onClick={addMember} className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50">เพิ่ม</button>
              </div>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-bold text-slate-600">แปลงที่ดินในกลุ่ม ({linkedPlots.length})</h4>
              <ul className="mb-2 divide-y divide-stone-100 text-xs">
                {linkedPlots.map(p => (
                  <li key={p.id} className="flex items-center justify-between py-1">
                    <span>{p.name}</span>
                    <button disabled={busy} onClick={() => unlinkPlot(p)} className="text-red-600 hover:underline disabled:opacity-50">นำออก</button>
                  </li>
                ))}
                {linkedPlots.length === 0 && <li className="py-1 text-slate-400">ยังไม่มีแปลง</li>}
              </ul>
              <div className="flex gap-2">
                <select value={newPlotId} onChange={e => setNewPlotId(e.target.value)} className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs">
                  <option value="">เลือกแปลงที่ยังไม่สังกัดกลุ่ม...</option>
                  {unlinkedPlots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button
                  disabled={busy || !newPlotId}
                  onClick={linkPlot}
                  className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  เพิ่ม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
