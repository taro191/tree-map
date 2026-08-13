import { useRef, useState } from 'react';
import Card from './Card';
import { loadThaiZipIndex } from '../thaiZip';

const FIELDS = [
  ['name', 'ชื่อกลุ่ม', 'text'],
  ['registrationNo', 'เลขทะเบียน', 'text'],
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

export default function CommunityEnterpriseCard({ entity, users, plots, purposes = [], canDelete = true, onSave, onDelete, onAddMember, onRemoveMember, onLinkPlot, onUnlinkPlot, onApprovePlot }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [newPlotId, setNewPlotId] = useState('');
  const [addressStatus, setAddressStatus] = useState('');
  const [addressMatches, setAddressMatches] = useState(null);
  const postcodeRequestRef = useRef(0);

  const purposesById = new Map(purposes.map(p => [p.id, p.name]));
  const memberIds = new Set(entity.members.map(m => m.id));
  const availableUsers = users.filter(u => !memberIds.has(u.id));
  const pendingPlots = plots.filter(p => p.communityEnterpriseId === entity.id && p.communityEnterpriseStatus === 'pending');
  const linkedPlots = plots.filter(p => p.communityEnterpriseId === entity.id && p.communityEnterpriseStatus === 'approved');
  // เลือกแปลงมาผูกเองได้เฉพาะที่วัตถุประสงค์ตรงกับกลุ่ม (ทั้งคู่ไม่ระบุ ถือว่าตรงกันด้วย เพื่อไม่ตัดแปลง/กลุ่มเก่าที่ยังไม่มีวัตถุประสงค์ออก)
  const unlinkedPlots = plots.filter(p => !p.communityEnterpriseId && (p.purposeId || null) === (entity.purposeId || null));

  function startEdit() {
    setDraft({ ...entity });
    setEditing(true);
    setError('');
    setAddressStatus('');
    setAddressMatches(null);
  }

  async function handlePostcodeChange(value) {
    setDraft(d => ({ ...d, postcode: value }));
    setAddressMatches(null);
    const pc = value.trim();
    const requestId = ++postcodeRequestRef.current;
    if (!/^\d{5}$/.test(pc)) { setAddressStatus(''); return; }
    setAddressStatus('กำลังค้นหาที่อยู่...');
    try {
      const idx = await loadThaiZipIndex();
      if (postcodeRequestRef.current !== requestId) return; // ผู้ใช้พิมพ์ต่อระหว่างรอโหลด
      const matches = idx.get(pc) || [];
      if (matches.length === 0) {
        setAddressStatus('ไม่พบข้อมูลที่อยู่จากรหัสไปรษณีย์นี้ กรุณากรอกอำเภอ/จังหวัดเอง');
      } else if (matches.length === 1) {
        setDraft(d => ({ ...d, district: matches[0].districtBare, province: matches[0].province }));
        setAddressStatus(`พบที่อยู่: ${matches[0].districtDisplay} ${matches[0].province}`);
      } else {
        setAddressStatus(`พบ ${matches.length} ที่อยู่ที่ตรงกับรหัสนี้ กรุณาเลือก:`);
        setAddressMatches(matches);
      }
    } catch (err) {
      if (postcodeRequestRef.current !== requestId) return;
      setAddressStatus('โหลดข้อมูลที่อยู่ไม่สำเร็จ (ต้องใช้อินเทอร์เน็ต) กรุณากรอกที่อยู่เอง');
    }
  }

  function selectAddressMatch(i) {
    const m = addressMatches && addressMatches[i];
    if (!m) return;
    setDraft(d => ({ ...d, district: m.districtBare, province: m.province }));
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

  async function approvePlot(plot) {
    setBusy(true);
    setError('');
    try {
      await onApprovePlot(entity.id, plot.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={entity.name}
      headerRight={
        !editing && (
          <div className="flex shrink-0 gap-2">
            <button onClick={startEdit} className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-600 hover:text-emerald-700">แก้ไข</button>
            {canDelete && (
              <button
                disabled={busy || entity.members.length > 0} onClick={remove}
                title={entity.members.length > 0 ? 'ต้องนำสมาชิกออกให้หมดก่อนจึงจะลบได้' : ''}
                className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ลบ
              </button>
            )}
          </div>
        )
      }
    >
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
            <label className="mb-1 block text-xs font-semibold text-slate-500">ที่ตั้ง</label>
            <input
              value={draft.postcode || ''} onChange={e => handlePostcodeChange(e.target.value)}
              onFocus={() => loadThaiZipIndex().catch(() => {})}
              placeholder="กรอกรหัสไปรษณีย์ (5 หลัก) เพื่อค้นหาที่อยู่" inputMode="numeric" maxLength={5}
              className="mb-1 w-full rounded border border-stone-300 px-2 py-1 text-xs"
            />
            {addressStatus && <div className="mb-1 text-[11px] text-slate-500">{addressStatus}</div>}
            {addressMatches && (
              <select
                defaultValue="" onChange={e => selectAddressMatch(Number(e.target.value))}
                className="mb-1 w-full rounded border border-stone-300 px-2 py-1 text-xs"
              >
                <option value="" disabled>-- เลือกที่อยู่ --</option>
                {addressMatches.map((m, i) => (
                  <option key={i} value={i}>{m.districtDisplay} {m.province}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <input
                value={draft.district || ''} onChange={e => setDraft({ ...draft, district: e.target.value })}
                placeholder="อำเภอ" className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
              />
              <input
                value={draft.province || ''} onChange={e => setDraft({ ...draft, province: e.target.value })}
                placeholder="จังหวัด" className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">วัตถุประสงค์หลัก</label>
            <select
              value={draft.purposeId || ''} onChange={e => setDraft({ ...draft, purposeId: e.target.value || null })}
              className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
            >
              <option value="">ยังไม่กำหนดวัตถุประสงค์</option>
              {purposes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">รายละเอียดวัตถุประสงค์</label>
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
          <p className="text-xs text-slate-500">
            {[entity.registrationNo, [entity.district, entity.province].filter(Boolean).join(' '), entity.postcode].filter(Boolean).join(' · ') || '-'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {[entity.chairperson && `ประธาน: ${entity.chairperson}`, entity.contactPhone, entity.registeredDate].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            🎯 {entity.purposeId && purposesById.has(entity.purposeId) ? purposesById.get(entity.purposeId) : 'ยังไม่กำหนดวัตถุประสงค์'}
          </p>
          {entity.purpose && <p className="mt-1 text-xs text-slate-600">{entity.purpose}</p>}

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
              {pendingPlots.length > 0 && (
                <>
                  <h4 className="mb-1 text-xs font-bold text-amber-700">🕐 รออนุมัติเข้าร่วม ({pendingPlots.length})</h4>
                  <ul className="mb-3 divide-y divide-stone-100 text-xs">
                    {pendingPlots.map(p => (
                      <li key={p.id} className="flex items-center justify-between py-1">
                        <span>{p.name}</span>
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => approvePlot(p)} className="font-semibold text-emerald-700 hover:underline disabled:opacity-50">อนุมัติ</button>
                          <button disabled={busy} onClick={() => unlinkPlot(p)} className="text-red-600 hover:underline disabled:opacity-50">ปฏิเสธ</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
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
                  <option value="">เลือกแปลงที่ยังไม่สังกัดกลุ่ม (วัตถุประสงค์ตรงกัน)...</option>
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
    </Card>
  );
}
