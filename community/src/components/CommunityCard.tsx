import { Link } from 'react-router-dom';
import { CommunityStat } from '../lib/store';
import { formatCount } from '../lib/utils';

export default function CommunityCard({ c }: { c: CommunityStat }) {
  return (
    <Link
      to={`/c/${c.slug}`}
      className="block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="h-16" style={{ background: c.themeColor }} />
      <div className="p-4 -mt-8">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center text-white text-xl font-black border-2 border-white shadow"
          style={{ background: c.themeColor }}
        >
          {c.name.slice(0, 1)}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
          <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
            {c.category}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2 h-10">{c.description}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          <span>멤버 {formatCount(c.members)}</span>
          <span>·</span>
          <span>글 {formatCount(c.posts)}</span>
        </div>
      </div>
    </Link>
  );
}
