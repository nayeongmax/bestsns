import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Post, Notice, UserProfile, GradeConfig } from '@/types';
import BannerRotator from '@/components/BannerRotator';

/** 데스크톱 레이아웃 고정. 폰/태블릿 대응 시 데스크톱용 스타일은 수정하지 말 것. */
interface Props {
  posts: Post[];
  notices: Notice[];
  members?: UserProfile[];
  gradeConfigs?: GradeConfig[];
}

const CATEGORIES = ['전체', '공지', '유튜브', '수익화', '마케팅', '자유'];
const POSTS_PER_PAGE = 15;

const FreeBoard: React.FC<Props> = ({ posts, notices, members = [], gradeConfigs = [] }) => {
  const [activeCategory, setActiveCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const latestNotice = notices.filter(n => !n.isHidden)[0];

  const { displayPosts, normalPostsStartIdx, totalNormalCount } = useMemo(() => {
    const activePosts = posts.filter(p => !p.isDeleted);
    const filtered = activePosts.filter(p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const allNotices = filtered.filter(p => p.category === '공지').sort((a, b) => Number(b.id) - Number(a.id));
    const topNotice = allNotices.slice(0, 1);
    const otherNotices = allNotices.slice(1);
    const commonPosts = filtered.filter(p => p.category !== '공지');

    const hotPosts = [...commonPosts]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 2)
      .map(p => ({ ...p, isHot: true }));

    const hotIds = new Set(hotPosts.map(p => p.id));
    const normalPosts = [...otherNotices, ...commonPosts.filter(p => !hotIds.has(p.id))]
      .sort((a, b) => Number(b.id) - Number(a.id));

    if (activeCategory !== '전체') {
      const catFiltered = filtered.filter(p => p.category === activeCategory).sort((a, b) => Number(b.id) - Number(a.id));
      return { displayPosts: catFiltered, normalPostsStartIdx: 0, totalNormalCount: catFiltered.length };
    }

    const finalResult = [...topNotice, ...hotPosts, ...normalPosts];
    return { displayPosts: finalResult, normalPostsStartIdx: topNotice.length + hotPosts.length, totalNormalCount: normalPosts.length };
  }, [posts, searchQuery, activeCategory]);

  const totalPages = Math.ceil(displayPosts.length / POSTS_PER_PAGE);
  const currentPosts = displayPosts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-700 px-4 md:px-8">
      {/* 최상단 공지 연동 섹션 */}
      {latestNotice && (
        <div className="bg-[#1e293b] rounded-[32px] p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
            <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="bg-orange-500 px-4 py-1.5 rounded-full font-black text-xs italic tracking-widest uppercase">Official Notice</div>
            <p className="text-lg font-black tracking-tight truncate max-w-2xl">{latestNotice.title}</p>
          </div>
          <button
            onClick={() => navigate('/notices')}
            className="bg-white/10 hover:bg-white text-white hover:text-gray-900 px-8 py-2.5 rounded-2xl font-black text-[13px] transition-all whitespace-nowrap relative z-10"
          >
            전체보기
          </button>
        </div>
      )}

      {/* 광고 배너: 모바일 2열(2행), 데스크톱 3열 */}
      <BannerRotator cols={2} mode="all" location="freeboard" height={130} />

      {/* 상단 헤더 섹션 */}
      <div className="bg-white p-4 sm:p-6 rounded-[32px] shadow-sm border border-gray-100 space-y-3 sm:space-y-6">
        {/* 모바일: 제목+글쓰기 한 줄, 검색 한 줄 / 데스크톱: 기존 레이아웃 */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          {/* 모바일: 제목+글쓰기 한 줄 */}
          <div className="flex items-center justify-between gap-3 md:hidden">
            <h2 className="text-xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 shrink-0">자유게시판</h2>
            <button
              onClick={() => navigate('/board/write')}
              className="bg-[#1e293b] text-white px-4 py-2 rounded-[16px] font-black shadow-xl hover:bg-blue-600 transition-all flex items-center gap-1.5 active:scale-95 italic uppercase tracking-tighter shrink-0 text-xs"
            >
              🖋️ 글쓰기
            </button>
          </div>
          {/* 데스크톱: 자유게시판 제목 (왼쪽) */}
          <h2 className="hidden md:block text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 shrink-0">자유게시판</h2>
          {/* 스페이서 */}
          <div className="hidden md:flex flex-1" />
          {/* 검색창 (모바일: 전체 너비 / 데스크톱: 고정 너비) */}
          <div className="relative group w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="제목이나 작성자로 검색..."
              className="w-full p-3 sm:p-3.5 bg-gray-50 border-none rounded-[16px] sm:rounded-[18px] focus:ring-4 focus:ring-blue-100 outline-none font-bold text-gray-700 transition-all shadow-inner text-sm pr-12"
            />
            <div className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>
          {/* 데스크톱: 글쓰기 버튼 (오른쪽 끝) */}
          <button
            onClick={() => navigate('/board/write')}
            className="hidden md:flex bg-[#1e293b] text-white px-10 py-4 rounded-[20px] font-black shadow-xl hover:bg-blue-600 transition-all items-center gap-2 active:scale-95 italic uppercase tracking-tighter shrink-0 text-sm"
          >
            🖋️ 글쓰기
          </button>
        </div>

        <div className="w-full bg-gray-50 p-1.5 rounded-[24px] flex shadow-inner overflow-x-auto no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setCurrentPage(1); }}
              className={`flex-1 py-2.5 sm:py-3 rounded-[18px] font-black text-[11px] sm:text-[13px] transition-all italic tracking-tight whitespace-nowrap px-2 ${
                activeCategory === cat
                ? 'bg-white text-blue-600 shadow-lg shadow-blue-100/50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 게시글 리스트 */}
      <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100">
        {/* 모바일: 카드형 */}
        <div className="md:hidden divide-y divide-gray-50">
          {currentPosts.length === 0 ? (
            <div className="py-16 text-center text-gray-300 font-black italic">게시글이 존재하지 않습니다.</div>
          ) : currentPosts.map((post, idx) => {
            const absoluteIdx = (currentPage - 1) * POSTS_PER_PAGE + idx;
            const isNotice = activeCategory === '전체' && absoluteIdx === 0 && post.category === '공지';
            const isHot = (post as any).isHot;
            const activeCommentCount = (post.comments || []).filter(c => !c.isDeleted).length;
            let displayNo: string | number = post.id;
            if (activeCategory === '전체') {
              if (isNotice) displayNo = '공지';
              else if (isHot) displayNo = 'HOT';
              else displayNo = totalNormalCount - (absoluteIdx - normalPostsStartIdx);
            } else displayNo = totalNormalCount - absoluteIdx;
            return (
              <Link key={post.id} to={`/board/${post.id}`} className={`flex items-start gap-2.5 px-4 py-3 hover:bg-blue-50/20 transition-all ${isNotice ? 'bg-red-50/10' : isHot ? 'bg-orange-50/10' : ''}`}>
                <div className="shrink-0 w-8 pt-0.5 text-center">
                  {isNotice ? <span className="text-[9px] font-black text-red-500 uppercase block">공지</span> : isHot ? <span className="text-[9px] font-black text-orange-500 block">HOT</span> : <span className="text-[11px] text-gray-400">{displayNo}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {!isNotice && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${isHot ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>{post.category}</span>}
                    {activeCommentCount > 0 && <span className="text-[9px] font-black text-blue-400">[{activeCommentCount}]</span>}
                    {post.images && post.images.length > 0 && <span className="text-xs">🖼️</span>}
                  </div>
                  <p className={`text-sm font-black leading-snug line-clamp-2 ${isNotice ? 'text-red-600' : 'text-gray-800'}`}>{post.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-bold flex-wrap">
                    <span>{post.author}</span>
                    <span>·</span>
                    <span>{post.date}</span>
                    <span>·</span>
                    <span>👁 {post.views.toLocaleString()}</span>
                    {post.likes > 0 && <><span>·</span><span className="text-green-500">♥ {post.likes}</span></>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 데스크톱: 테이블형 */}
        <table className="hidden md:table w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-4 py-4 text-center w-20 font-black text-gray-900 text-[14px]">번호</th>
              <th className="px-4 py-4 font-black text-gray-900 text-[14px]">제목</th>
              <th className="px-4 py-4 text-center w-36 font-black text-gray-900 text-[14px]">작성자</th>
              <th className="px-4 py-4 text-center w-40 font-black text-gray-900 text-[14px]">작성일자</th>
              <th className="px-4 py-4 text-center w-28 font-black text-gray-900 text-[14px]">조회수</th>
              <th className="px-4 py-4 text-center w-28 font-black text-gray-900 text-[14px]">좋아요</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {currentPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center text-gray-300 font-black italic text-lg">게시글이 존재하지 않습니다.</td>
              </tr>
            ) : (
              currentPosts.map((post, idx) => {
                const absoluteIdx = (currentPage - 1) * POSTS_PER_PAGE + idx;
                const isNotice = activeCategory === '전체' && absoluteIdx === 0 && post.category === '공지';
                const isHot = (post as any).isHot;
                const activeCommentCount = (post.comments || []).filter(c => !c.isDeleted).length;
                let displayNo: string | number = post.id;
                if (activeCategory === '전체') {
                  if (isNotice) displayNo = "공지";
                  else if (isHot) displayNo = "HOT";
                  else displayNo = totalNormalCount - (absoluteIdx - normalPostsStartIdx);
                } else displayNo = totalNormalCount - absoluteIdx;
                return (
                  <tr key={post.id} className={`hover:bg-blue-50/20 transition-all cursor-pointer group ${isNotice ? 'bg-red-50/10' : isHot ? 'bg-orange-50/10' : ''}`}>
                    <td className="px-4 py-4 text-[13px] font-black text-gray-400 text-center italic">
                      {isNotice ? <span className="text-red-500 font-black uppercase tracking-tighter text-[11px]">공지</span> : isHot ? <span className="text-orange-500 font-black italic text-[11px]">HOT</span> : displayNo}
                    </td>
                    <td className="px-4 py-4">
                      <Link to={`/board/${post.id}`} className="block">
                        <div className="flex items-center gap-3">
                          {!isNotice && <span className={`text-[10px] font-black px-2 py-0.5 rounded italic shadow-sm uppercase shrink-0 ${isHot ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>{post.category}</span>}
                          <span className={`text-[15px] font-black transition-colors tracking-tight truncate ${isNotice ? 'text-red-600' : 'text-gray-800 group-hover:text-blue-600'}`}>{post.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {post.images && post.images.length > 0 && <span className="text-sm">🖼️</span>}
                            {activeCommentCount > 0 && <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg shadow-inner ${isHot ? 'bg-orange-50 text-orange-400' : 'bg-blue-50 text-blue-400'}`}>[{activeCommentCount}]</span>}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-[14px] font-black text-gray-600 italic truncate block max-w-[140px] mx-auto" title={post.author}>{post.author}</span>
                    </td>
                    <td className="px-4 py-4 text-center text-[13px] font-bold text-gray-400 italic whitespace-nowrap uppercase tracking-tighter">{post.date}</td>
                    <td className="px-4 py-4 text-center text-[14px] font-bold text-gray-400 italic whitespace-nowrap">{post.views.toLocaleString()}</td>
                    <td className={`px-4 py-4 text-center text-[16px] font-black italic tracking-tighter whitespace-nowrap ${post.likes > 0 ? 'text-green-500' : 'text-gray-300'}`}>{post.likes}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-6">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm">◀</button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-xl font-black text-[14px] transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 scale-105' : 'bg-white text-gray-400 hover:bg-gray-50 border border-gray-100'}`}>{i + 1}</button>
          ))}
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-blue-600 shadow-sm">▶</button>
        </div>
      )}
    </div>
  );
};

export default FreeBoard;
