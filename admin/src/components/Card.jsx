export default function Card({ title, headerRight, children, noPadding = false, className = '' }) {
  return (
    <div className={`overflow-hidden rounded border border-gray-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          {headerRight}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>{children}</div>
    </div>
  );
}
