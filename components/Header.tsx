import React from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, SiteNotification } from '@/types';

interface Props {
  user: UserProfile | null;
  wishlistCount: number;
  notifications: SiteNotification[];
  unreadChatCount: number;
  onLogout: () => void;
}

const Header: React.FC<Props> = ({ user, wishlistCount, notifications, unreadChatCount, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const unreadNotifCount = user 
    ? notifications.filter(n => n.userId === user.id && !n.isRead).length 
    : 0;

  const isAdmin = user?.role === 'admin' || user?.id?.toLowerCase() === 'admin';

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

  const handleLogoutClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onLogout();
  };

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-[1550px]">
          <div className="flex items-center gap-6 flex-shrink-0">
            <Link to="/" className="text-2xl font-black flex items-center tracking-tighter">
              <span className="text-gray-900 uppercase">THEBEST</span>
              <span className="text-blue-600 uppercase">SNS</span>
            </Link>
          </div>

          <nav className="hidden xl:flex items-center gap-1 flex-1 justify-center h-full">
            {navItems.map((item) => {
              const isEbooks = item.path === '/ebooks';
              const isActive = isEbooks
                ? pathname === '/ebooks' || pathname.startsWith('/ebooks/')
                : item.path === '/channels'
                  ? pathname === '/channels' || pathname.startsWith('/channels/')
                  : pathname === item.path;
              if (isEbooks) {
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate('/ebooks', { replace: false });
                    }}
                    className={`relative flex flex-col items-center justify-center px-5 py-2 rounded-full text-[14.5px] font-black transition-all duration-300 h-10 ${
                      isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <div className="absolute top-[48px] left-1/2 -translate-x-1/2 z-[60] animate-float-badge pointer-events-none">
                        <span className="block whitespace-nowrap bg-[#FF4D4D] text-white text-[14px] px-4 py-1.5 rounded-full font-black shadow-[0_10px_20px_rgba(255,77,77,0.5)] border border-white/30 leading-none text-center italic tracking-tighter">
                          {item.badge}
                        </span>
                      </div>
                    )}
                  </button>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/channels' ? false : true}
                  className={({ isActive: navActive }) =>
                    `relative flex flex-col items-center justify-center px-5 py-2 rounded-full text-[14.5px] font-black transition-all duration-300 h-10 ${
                      (item.path === '/channels' ? pathname.startsWith('/channels') : navActive) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                    }`
                  }
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <div className="absolute top-[48px] left-1/2 -translate-x-1/2 z-[60] animate-float-badge pointer-events-none">
                      <span className="block whitespace-nowrap bg-[#FF4D4D] text-white text-[14px] px-4 py-1.5 rounded-full font-black shadow-[0_10px_20px_rgba(255,77,77,0.5)] border border-white/30 leading-none text-center italic tracking-tighter">
                        {item.badge}
                      </span>
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Link to="/wishlist" className="p-2 text-gray-400 hover:text-red-500 transition-colors relative group">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white animate-bounce">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              
              <Link to="/chat" className="p-2 text-gray-400 hover:text-blue-600 transition-colors relative group">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              </Link>

              <Link to="/notifications" className="p-2 text-gray-400 hover:text-orange-500 transition-colors relative group">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </Link>
            </div>
            
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1117] text-white text-sm font-black hover:bg-black transition-all italic tracking-tight shrink-0">
                ⚙️ 어드민패널
              </Link>
            )}
            <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
            
            {user && user.id ? (
              <div className="flex items-center gap-3">
                <Link to="/mypage" className="flex items-center gap-2 group">
                  <img src={user.profileImage} alt="profile" className="w-9 h-9 rounded-full border border-gray-100 object-cover group-hover:ring-2 group-hover:ring-blue-100 transition-all shadow-sm" />
                  <span className="text-sm font-black text-gray-700 hidden sm:block italic tracking-tight">{user.nickname}</span>
                </Link>
                <button 
                  type="button"
                  onClick={handleLogoutClick}
                  className="bg-gray-100 text-gray-400 hover:bg-gray-900 hover:text-white px-3 py-2 rounded-xl text-[10px] font-black transition-all italic uppercase tracking-tighter"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="bg-gray-900 text-white px-6 py-2.5 rounded-xl text-[13px] font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 italic tracking-tighter uppercase"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {isAdmin && (
        <Link to="/admin" className="fixed bottom-8 right-8 z-[60] bg-[#0d1117] text-white w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-black transition-all hover:scale-110 active:scale-95 group">
          <span className="text-[11px] font-black italic tracking-widest text-center leading-none">ADMIN<br/>PANEL</span>
        </Link>
      )}
    </>
  );
};

export default Header;
