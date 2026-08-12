const COLOR_MAP = {
  blue: 'bg-blue-600',
  green: 'bg-emerald-600',
  amber: 'bg-amber-500',
  slate: 'bg-slate-600'
};

export default function InfoBox({ icon, label, value, color = 'blue' }) {
  return (
    <div className={`flex items-center gap-3 rounded ${COLOR_MAP[color] || COLOR_MAP.blue} px-4 py-3 text-white shadow-sm`}>
      <div className="text-2xl leading-none">{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="mt-1 truncate text-xs opacity-90">{label}</div>
      </div>
    </div>
  );
}
