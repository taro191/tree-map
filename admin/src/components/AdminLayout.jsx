import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'แดชบอร์ด', icon: '📊' },
  { to: '/plots', label: 'แปลงต้นไม้', icon: '📍' },
  { to: '/trees', label: 'ต้นไม้', icon: '🌳' },
  { to: '/users', label: 'ผู้ใช้งาน', icon: '👥', adminOnly: true },
  { to: '/community-enterprises', label: 'วิสาหกิจชุมชน', icon: '🏢' }
];

const ROLE_BADGE = {
  admin: { label: 'admin ระบบ', className: 'bg-emerald-600' },
  enterprise_admin: { label: 'admin วิสาหกิจชุมชน', className: 'bg-amber-500' }
};

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const badge = ROLE_BADGE[user?.role];
  const identity = [user?.name, user?.email, user?.phone].filter(Boolean).join(' · ');
  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin');

  return (
    <div className="min-h-screen bg-gray-100">
      <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col bg-slate-900 text-slate-200 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-800 px-4">
          <span className="text-xl">🌳</span>
          {!collapsed && <span className="truncate text-sm font-bold text-white">แผนที่ต้นไม้</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`mx-2 mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="shrink-0 border-t border-slate-800 p-3">
            <div className="truncate text-xs text-slate-300">{identity}</div>
            {badge && (
              <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold text-white ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
        )}
      </aside>

      <div className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="rounded p-2 text-lg text-slate-500 hover:bg-gray-100"
            aria-label="พับ/ขยายเมนู"
          >
            ☰
          </button>
          <button
            onClick={logout}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
          >
            ออกจากระบบ
          </button>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
