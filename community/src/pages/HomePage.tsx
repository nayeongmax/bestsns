import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as store from '../lib/store';
import { CommunityStat } from '../lib/store';
import { CATEGORIES } from '../lib/types';
import CommunityCard from '../components/CommunityCard';

type Sort = 'popular' | 'new' | 'active';

export default function HomePage() {
  const [communities, setCommunities] = useState<CommunityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const [category, setCategory] = useState<string>('전체');
  const [sort, setSort] = useState<Sort>('popular');

  const q = params.get('q')?.toLowerCase() ?? '';

  useEffect(() => {
    store.listCommunitiesWithStats().then((c) => {
      setCommunities(c);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let list = communities;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }
    if (category !== '전체') list = list.filter((c) => c.category === category);
    const sorted = [...list];
    if (sort === 'popular') sorted.sort((a, b) => b.members - a.members);
    else if (sort === 'new')
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else sorted.sort((a, b) => b.posts - a.posts);
    return sorted;
  }, [communities, q, category, sort]);

  return (
    <div>
      {!q && (
        <section className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-8 text-white mb-6">
          <h1 className="text-2xl sm:text-3xl font-black leading-tight">
            누구나 커뮤니티를 만들고
            <br />
            함께 소통하는 공간
          </h1>
          <p className="mt-2 text-indigo-100 text-sm">
            관심사 커뮤니티를 개설하고, 게시판을 열고, 자유롭게 글을 나눠보세요.
          </p>
          <Link
            to="/create"
            className="inline-block mt-4 bg-white text-indigo-700 font-bold px-5 py-2.5 rounded-lg hover:bg-indigo-50"
          >
            내 커뮤니티 만들기
          </Link>
        </section>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-800">
          {q ? `"${params.get('q')}" 검색 결과` : '커뮤니티 둘러보기'}
        </h2>
        <div className="flex gap-1 text-sm">
          {(
            [
              ['popular', '인기순'],
              ['active', '활발한'],
              ['new', '최신'],
            ] as [Sort, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-1 rounded-full font-semibold ${
                sort === key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1">
        {['전체', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-semibold border ${
              category === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-16">불러오는 중…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p>조건에 맞는 커뮤니티가 없어요.</p>
          <Link to="/create" className="text-indigo-600 font-semibold mt-2 inline-block">
            첫 커뮤니티를 만들어보세요 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CommunityCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
