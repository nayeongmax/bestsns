
import React from 'react';
import { NavLink } from 'react-router-dom';

const MobileBottomNav: React.FC = () => {
  const navItems = [
    { label: 'SNS활성화', path: '/sns', icon: '📈' },
    { label: '채널판매', path: '/channels', icon: '📺' },
    { 
      label: 'N잡스토어', 
      path: '/ebooks', 
      icon: '📖', 
      badge: '누구나 판매OK'
    },
    { 
      label: '누구나알바', 
      path: '/part-time', 
      icon: '👷',
      badge: '누구나 지원OK'
    },
    { label: 'AI컨설팅', path: '/ai', icon: '🤖' },
    { label: '자유게시판', path: '/board', icon: '🗨️' },
    { label: '매출관리', path: '/revenue', icon: '📊' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white shadow-[0_-15px_40px_rgba(0,0,0,0.1)] border-t border-gray-100 pb-safe overflow-hidden h-24">
      {/* 가로 슬라이드 핵심: flex-nowrap과 overflow-x-auto, 그리고 충분한 높이(h-24) */}
      <div className="flex flex-nowrap items-end h-full overflow-x-auto no-scrollbar scroll-smooth px-4 pt-8">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center min-w-[85px] h-16 transition-all duration-300 flex-shrink-0 pb-2 ${isActive ? 'text-blue-600 scale-105' : 'text-gray-400'}`
            }
          >
            {({ isActive }) => (
              <>
                {item.badge && (
                  <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-[110] animate-float-badge pointer-events-none">
                    <span className="block whitespace-nowrap bg-[#FF4D4D] text-white text-[11px] px-3 py-1 rounded-full font-black shadow-[0_10px_20px_rgba(255,77,77,0.4)] border border-white/30 leading-none text-center italic tracking-tighter">
                      {item.badge}
                    </span>
                  </div>
                )}
                <span className="text-2xl mb-1">{item.icon}</span>
                <span className="text-[11px] font-black italic tracking-tighter whitespace-nowrap">{item.label}</span>
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 transition-all duration-300 transform ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`} />
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
