import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import * as store from '../lib/store';
import { CATEGORIES } from '../lib/types';

export default function CreateCommunityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 mb-3">커뮤니티를 만들려면 로그인이 필요합니다.</p>
        <button
          onClick={() => navigate('/login')}
          className="bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-lg"
        >
          로그인하러 가기
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('커뮤니티 이름은 2자 이상 입력해주세요.');
    setBusy(true);
    try {
      const c = await store.createCommunity({
        name,
        description,
        category,
        ownerId: user.id,
        isPublic,
      });
      navigate(`/c/${c.slug}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-black text-slate-800 mb-1">커뮤니티 개설</h1>
      <p className="text-sm text-slate-500 mb-6">
        관심사에 맞는 커뮤니티를 만들어보세요. 개설하면 자동으로 운영자가 되고, 공지·자유게시판이
        기본으로 생성됩니다.
      </p>
      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5">커뮤니티 이름 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 오늘의 유머"
            maxLength={30}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5">소개</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 커뮤니티인지 소개해주세요."
            rows={3}
            maxLength={200}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 ring-indigo-300 resize-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4"
          />
          누구나 검색/열람 가능한 공개 커뮤니티
        </label>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? '개설 중…' : '커뮤니티 개설하기'}
        </button>
      </form>
    </div>
  );
}
