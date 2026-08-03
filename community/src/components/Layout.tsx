import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import Avatar from './Avatar';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-black text-lg shrink-0">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white grid place-items-center">
              C
            </span>
            <span className="hidden sm:block text-slate-800">커뮤니티</span>
          </Link>

          <form onSubmit={onSearch} className="flex-1 max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="커뮤니티 검색"
              className="w-full bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 ring-indigo-300"
            />
          </form>

          <Link
            to="/create"
            className="hidden sm:inline-block text-sm font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700"
          >
            + 커뮤니티 개설
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/me" className="flex items-center gap-2">
                <Avatar nickname={user.nickname} color={user.avatarColor} size={30} />
                <span className="hidden md:block text-sm font-semibold text-slate-700">
                  {user.nickname}
                </span>
              </Link>
              <button
                onClick={logout}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-sm font-bold text-indigo-600 px-3 py-2 rounded-lg hover:bg-indigo-50"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {!isSupabaseConfigured() && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-1.5 px-4">
          데모 모드로 실행 중입니다 · 데이터는 이 브라우저에만 저장됩니다 · 데모 계정: admin@demo.com
          / 1234
        </div>
      )}

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        누구나 만드는 오픈 커뮤니티 플랫폼 · 데모
      </footer>
    </div>
  );
}
