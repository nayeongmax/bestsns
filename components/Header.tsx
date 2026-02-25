import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, SiteNotification } from '@/types';

interface Props {
  user: UserProfile | null;
  wishlistCount: number;
  notifications: SiteNotification[];
  unreadChatCount: number;
  onLogout: () => void;
  /** 제공 시 메인 화면에서 로그인 버튼 클릭 시 이 콜백 호출 (팝업 로그인) */
  onOpenLoginModal?: () => void;
}

const Header: React.FC<Props> = ({ user, wishlistCount, notifications, unreadChatCount, onLogout, onOpenLoginModal }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 모바일 메뉴 열림 시 body 스크롤 방지
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleNavClick = (to: string, isButton?: boolean) => {
    if (isButton) navigate('/ebooks', { replace: false });
    else navigate(to);
    closeMobileMenu();
  };

  return (
    <>
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm overflow-x-hidden">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-[1550px] min-w-0">
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            {/* 모바일 햄버거 메뉴 (xl 미만에서만 표시) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="xl:hidden p-2 -ml-1 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/" className="text-xl sm:text-2xl font-black flex items-center tracking-tighter shrink-0">
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

          {/* 모바일(xl 미만): 로그인·아이콘은 햄버거 메뉴에서만 / 헤더는 로고+메뉴만 표시해 가로 스크롤 방지 */}
          <div className="hidden xl:flex items-center gap-2 sm:gap-4 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-0.5 sm:gap-1">
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
              <Link to="/admin" className="hidden md:flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-[#0d1117] text-white text-xs sm:text-sm font-black hover:bg-black transition-all italic tracking-tight shrink-0">
                ⚙️ 어드민
              </Link>
            )}
            <div className="w-[1px] h-4 bg-gray-200 mx-0.5 sm:mx-1 hidden md:block"></div>
            
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
                onClick={() => (onOpenLoginModal ? onOpenLoginModal() : navigate('/login'))}
                className="bg-gray-900 text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-[12px] sm:text-[13px] font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 italic tracking-tighter uppercase shrink-0"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 모바일 메뉴 오버레이 & 드로어 (xl 미만) */}
      <div
        className={`xl:hidden fixed inset-0 z-[100] transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={closeMobileMenu}
          aria-label="메뉴 닫기"
        />
        <div
          className={`absolute top-0 left-0 w-full max-w-[300px] h-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 shrink-0">
            <span className="text-lg font-black text-gray-800 tracking-tight">메뉴</span>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="메뉴 닫기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-0">
              {navItems.map((item) => {
                const isEbooks = item.path === '/ebooks';
                const isActive = isEbooks
                  ? pathname === '/ebooks' || pathname.startsWith('/ebooks/')
                  : item.path === '/channels'
                    ? pathname === '/channels' || pathname.startsWith('/channels/')
                    : pathname === item.path || (item.path !== '/channels' && pathname.startsWith(item.path));
                return (
                  <li key={item.path}>
                    {isEbooks ? (
                      <button
                        type="button"
                        onClick={() => handleNavClick('/ebooks', true)}
                        className={`w-full flex items-center gap-3 px-5 py-4 text-left font-black text-[15px] transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge && <span className="ml-auto text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{item.badge}</span>}
                      </button>
                    ) : (
                      <NavLink
                        to={item.path}
                        end={item.path === '/channels' ? false : true}
                        onClick={closeMobileMenu}
                        className={({ isActive: navActive }) =>
                          `flex items-center gap-3 px-5 py-4 font-black text-[15px] transition-colors ${
                            (item.path === '/channels' ? pathname.startsWith('/channels') : navActive) ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                          }`
                        }
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge && <span className="ml-auto text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{item.badge}</span>}
                      </NavLink>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* 모바일 전용: 위시리스트·채팅·알림 (헤더 오른쪽이 메뉴로 이동했으므로) */}
            <div className="xl:hidden flex items-center gap-2 px-5 pt-2 pb-4 border-b border-gray-100">
              <Link to="/wishlist" onClick={closeMobileMenu} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-600 font-black text-sm hover:bg-red-50 hover:text-red-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                {wishlistCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{wishlistCount}</span>}
              </Link>
              <Link to="/chat" onClick={closeMobileMenu} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-600 font-black text-sm hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              </Link>
              <Link to="/notifications" onClick={closeMobileMenu} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-600 font-black text-sm hover:bg-orange-50 hover:text-orange-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadNotifCount > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadNotifCount}</span>}
              </Link>
            </div>
          </nav>
          <div className="border-t border-gray-100 p-4 space-y-2 shrink-0">
            {isAdmin && (
              <Link to="/admin" onClick={closeMobileMenu} className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0d1117] text-white text-sm font-black">
                ⚙️ 어드민패널
              </Link>
            )}
            {user?.id ? (
              <>
                <Link to="/mypage" onClick={closeMobileMenu} className="flex items-center gap-3 px-5 py-3 rounded-xl text-gray-700 font-black text-sm hover:bg-gray-50">
                  <img src={user.profileImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  마이페이지
                </Link>
                <button type="button" onClick={(e) => { handleLogoutClick(e); closeMobileMenu(); }} className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-gray-500 font-black text-sm hover:bg-gray-50">
                  로그아웃
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { closeMobileMenu(); onOpenLoginModal ? onOpenLoginModal() : navigate('/login'); }} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gray-900 text-white font-black text-sm">
                로그인
              </button>
            )}
          </div>
        </div>
      </div>

      {isAdmin && (
        <Link to="/admin" className="fixed bottom-8 right-8 z-[60] bg-[#0d1117] text-white w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center hover:bg-black transition-all hover:scale-110 active:scale-95 group">
          <span className="text-[11px] font-black italic tracking-widest text-center leading-none">ADMIN<br/>PANEL</span>
        </Link>
      )}
    </>
  );
};

export default Header;
