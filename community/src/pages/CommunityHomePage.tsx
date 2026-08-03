import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import * as store from '../lib/store';
import { Board, Community, Membership } from '../lib/types';
import { PostView } from '../lib/store';
import { formatCount, timeAgo } from '../lib/utils';

export default function CommunityHomePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [community, setCommunity] = useState<Community | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [membership, setMembership] = useState<Membership | undefined>();
  const [members, setMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const activeBoard = params.get('b') || '';

  const refresh = useCallback(async () => {
    if (!slug) return;
    const c = await store.getCommunityBySlug(slug);
    if (!c) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setCommunity(c);
    const [bds, ms, mc] = await Promise.all([
      store.listBoards(c.id),
      user ? store.getMembership(c.id, user.id) : Promise.resolve(undefined),
      store.memberCount(c.id),
    ]);
    setBoards(bds);
    setMembership(ms);
    setMembers(mc);
    const ps = await store.listPosts({
      communityId: c.id,
      boardId: activeBoard || undefined,
    });
    setPosts(ps);
    setLoading(false);
  }, [slug, user, activeBoard]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  if (loading) return <p className="text-center text-slate-400 py-16">불러오는 중…</p>;
  if (notFound || !community)
    return (
      <div className="text-center py-16 text-slate-400">
        존재하지 않는 커뮤니티입니다.
        <div>
          <Link to="/" className="text-indigo-600 font-semibold mt-2 inline-block">
            홈으로
          </Link>
        </div>
      </div>
    );

  const isMember = !!membership;
  const isManager = membership?.role === 'owner' || membership?.role === 'admin';

  const toggleJoin = async () => {
    if (!user) return navigate('/login');
    if (isMember) {
      if (membership?.role === 'owner') return alert('운영자는 탈퇴할 수 없습니다.');
      await store.leaveCommunity(community.id, user.id);
    } else {
      await store.joinCommunity(community.id, user.id);
    }
    refresh();
  };

  const selectBoard = (id: string) => {
    if (id) setParams({ b: id });
    else setParams({});
  };

  return (
    <div>
      {/* 커뮤니티 헤더 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
        <div className="h-24" style={{ background: community.themeColor }} />
        <div className="p-5 -mt-10">
          <div className="flex items-end justify-between gap-3">
            <div
              className="w-16 h-16 rounded-2xl grid place-items-center text-white text-2xl font-black border-4 border-white shadow"
              style={{ background: community.themeColor }}
            >
              {community.name.slice(0, 1)}
            </div>
            <div className="flex gap-2">
              {isManager && (
                <Link
                  to={`/c/${community.slug}/settings`}
                  className="text-sm font-semibold border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50"
                >
                  관리
                </Link>
              )}
              <button
                onClick={toggleJoin}
                className={`text-sm font-bold px-4 py-2 rounded-lg ${
                  isMember
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isMember ? (membership?.role === 'owner' ? '운영자' : '가입됨') : '+ 가입하기'}
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-800">{community.name}</h1>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {community.category}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{community.description}</p>
          <div className="mt-2 text-xs text-slate-400">멤버 {formatCount(members)}명</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
        {/* 게시판 목록 */}
        <aside className="bg-white rounded-2xl border border-slate-200 p-2 h-fit md:sticky md:top-20">
          <button
            onClick={() => selectBoard('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold ${
              !activeBoard ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            전체글
          </button>
          {boards.map((b) => (
            <button
              key={b.id}
              onClick={() => selectBoard(b.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                activeBoard === b.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {b.isNotice && <span className="text-red-400">📢</span>}
              {b.name}
            </button>
          ))}
        </aside>

        {/* 글 목록 */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-700">
              {activeBoard ? boards.find((b) => b.id === activeBoard)?.name : '전체글'}
            </h2>
            {isMember && (
              <Link
                to={`/c/${community.slug}/write${activeBoard ? `?b=${activeBoard}` : ''}`}
                className="text-sm font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
              >
                글쓰기
              </Link>
            )}
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              아직 글이 없어요.
              {isMember && ' 첫 글을 남겨보세요!'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/c/${community.slug}/post/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    {p.pinned && (
                      <span className="text-[11px] font-bold text-red-500 shrink-0">공지</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 shrink-0">{p.boardName}</span>
                        <span className="font-semibold text-slate-800 truncate">{p.title}</span>
                        {p.commentCount > 0 && (
                          <span className="text-xs font-bold text-indigo-500 shrink-0">
                            [{p.commentCount}]
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{p.authorNickname}</span>
                        <span>·</span>
                        <span>{timeAgo(p.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 text-right shrink-0 hidden sm:block">
                      <div>조회 {formatCount(p.views)}</div>
                      <div className="text-rose-500 font-semibold">▲ {p.likedBy.length}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
