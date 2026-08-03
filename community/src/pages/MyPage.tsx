import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import * as store from '../lib/store';
import { CommunityStat } from '../lib/store';
import { Community } from '../lib/types';
import Avatar from '../components/Avatar';
import CommunityCard from '../components/CommunityCard';

export default function MyPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState<CommunityStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cs = await store.listMyCommunities(user.id);
      const stats = await store.listCommunitiesWithStats();
      const byId = new Map(stats.map((s) => [s.id, s]));
      setMine(cs.map((c: Community) => byId.get(c.id)!).filter(Boolean));
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-3">로그인이 필요합니다.</p>
        <button
          onClick={() => navigate('/login')}
          className="bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-lg"
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4 mb-6">
        <Avatar nickname={user.nickname} color={user.avatarColor} size={56} />
        <div className="flex-1">
          <div className="text-lg font-black text-slate-800">{user.nickname}</div>
          <div className="text-sm text-slate-400">{user.email}</div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-sm text-slate-500 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 font-semibold"
        >
          로그아웃
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-800">내 커뮤니티</h2>
        <Link to="/create" className="text-sm font-bold text-indigo-600">
          + 새 커뮤니티
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-10">불러오는 중…</p>
      ) : mine.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
          아직 가입한 커뮤니티가 없어요.
          <div>
            <Link to="/" className="text-indigo-600 font-semibold mt-2 inline-block">
              커뮤니티 둘러보기 →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mine.map((c) => (
            <CommunityCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
