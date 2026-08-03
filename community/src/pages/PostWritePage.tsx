import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import * as store from '../lib/store';
import { Board, Community } from '../lib/types';

export default function PostWritePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [community, setCommunity] = useState<Community | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const c = await store.getCommunityBySlug(slug);
      if (!c) return navigate('/');
      setCommunity(c);
      const all = await store.listBoards(c.id);
      // 공지 게시판은 운영자만 글쓰기 가능
      const membership = user ? await store.getMembership(c.id, user.id) : undefined;
      const isManager = membership?.role === 'owner' || membership?.role === 'admin';
      const writable = all.filter((b) => !b.isNotice || isManager);
      setBoards(writable);
      const pref = params.get('b');
      setBoardId(pref && writable.some((b) => b.id === pref) ? pref : writable[0]?.id ?? '');
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!user)
    return (
      <div className="text-center py-20 text-slate-500">
        로그인 후 글을 작성할 수 있습니다.
      </div>
    );
  if (!ready || !community)
    return <p className="text-center text-slate-400 py-16">불러오는 중…</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!boardId) return setError('게시판을 선택해주세요.');
    if (title.trim().length < 1) return setError('제목을 입력해주세요.');
    if (content.trim().length < 1) return setError('내용을 입력해주세요.');
    setBusy(true);
    try {
      // 멤버가 아니면 자동 가입 처리
      const ms = await store.getMembership(community.id, user.id);
      if (!ms) await store.joinCommunity(community.id, user.id);
      const post = await store.createPost({
        communityId: community.id,
        boardId,
        authorId: user.id,
        title,
        content,
      });
      navigate(`/c/${community.slug}/post/${post.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-black text-slate-800 mb-4">글쓰기 · {community.name}</h1>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <select
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 ring-indigo-300 bg-white text-sm font-semibold"
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          maxLength={120}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300 font-semibold"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요."
          rows={12}
          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300 resize-y leading-relaxed"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100"
          >
            취소
          </button>
          <button
            disabled={busy}
            className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? '등록 중…' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
