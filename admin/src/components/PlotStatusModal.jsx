import { useState } from 'react';

const STATUS_LABELS = {
  data_entry: 'ป้อนข้อมูลแปลง',
  tree_survey: 'สำรวจต้นไม้',
  submitted: 'ส่งแปลงตรวจสอบ',
  approved: 'ตรวจสอบผ่าน'
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PlotStatusModal({ plot, onClose, onSave }) {
  const [status, setStatus] = useState(plot.status || 'data_entry');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPhotoFiles(e) {
    const files = [...(e.target.files || [])].slice(0, 4 - photos.length);
    e.target.value = '';
    if (files.length === 0) return;
    const dataUrls = await Promise.all(files.map(fileToDataUrl));
    setPhotos(prev => [...prev, ...dataUrls].slice(0, 4));
  }

  function removePhoto(i) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!note.trim()) { setError('กรุณาระบุเหตุผลประกอบการเปลี่ยนสถานะ'); return; }
    setBusy(true);
    setError('');
    try {
      await onSave(status, note.trim(), photos);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded border border-gray-200 bg-white shadow-lg" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <h3 className="text-sm font-bold text-slate-700">จัดการสถานะแปลง: {plot.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">สถานะปัจจุบัน: {STATUS_LABELS[plot.status] || plot.status}</p>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">สถานะใหม่</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">เหตุผลประกอบ (จำเป็นต้องระบุ)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={3}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder="เช่น ขอบเขตแปลงไม่ตรงกับพิกัดจริง กรุณาแก้ไข"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">แนบรูปภาพประกอบ (ถ้ามี, สูงสุด 4 รูป)</label>
            <input type="file" accept="image/*" multiple onChange={onPhotoFiles} disabled={photos.length >= 4} className="text-xs" />
            {photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="h-16 w-16 rounded object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 p-4">
          <button disabled={busy} onClick={save} className="flex-1 rounded bg-emerald-700 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button onClick={onClose} className="rounded border border-gray-300 px-4 py-2 text-sm">ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
