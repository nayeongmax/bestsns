import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { label: '마케팅주문', path: '/sns', icon: '📈' },
  { label: '채널판매', path: '/channels', icon: '📺' },
  { label: 'N잡스토어', path: '/ebooks', icon: '📖', badge: '판매OK' },
  { label: '누구나알바', path: '/part-time', icon: '👷', badge: '지원OK' },
  { label: 'AI컨설팅', path: '/ai', icon: '🤖' },
  { label: '자유게시판', path: '/board', icon: '🗨️' },
];

const MobileBottomNav: React.FC = () => {
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === '/channels'
      ? pathname === '/channels' || pathname.startsWith('/channels/')
      : pathname === path || (path !== '/' && pathname.startsWith(path + '/'));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center flex-shrink-0 min-w-[72px] py-2 px-1 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              {item.badge && (
                <span className="absolute top-0.5 right-1 text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black leading-none whitespace-nowrap">
                  {item.badge}
                </span>
              )}
              <span className="text-[22px] leading-none mb-0.5">{item.icon}</span>
              <span className={`text-[10px] font-black tracking-tight whitespace-nowrap ${active ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-blue-600" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
