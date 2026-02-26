
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChannelProduct, WishlistItem } from '@/types';

interface Props {
  channels: ChannelProduct[];
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
}

const ChannelSales: React.FC<Props> = ({ channels, wishlist, onToggleWishlist }) => {
  const [activePlatform, setActivePlatform] = useState('전체');
  const [showOnlyApproved, setShowOnlyApproved] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('전체');
  const [minSubs, setMinSubs] = useState('');
  const [maxSubs, setMaxSubs] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minIncome, setMinIncome] = useState('');
  const [maxIncome, setMaxIncome] = useState('');

  const isWishlisted = (id: string) => wishlist.some(w => w.data.id === id);

  const filteredChannels = channels.filter(ch => {
    const matchesPlatform = activePlatform === '전체' || ch.platform === activePlatform;
    const matchesApproved = showOnlyApproved ? ch.isApproved : true;
    const matchesSearch = ch.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTopic = selectedTopic === '전체' || ch.category === selectedTopic;
    const numSubs = ch.subscribers || 0;
    const numPrice = ch.price || 0;
    const numIncome = ch.income || 0;
    const matchesSubs = (!minSubs || numSubs >= Number(minSubs)) && (!maxSubs || numSubs <= Number(maxSubs));
    const matchesPrice = (!minPrice || numPrice >= Number(minPrice)) && (!maxPrice || numPrice <= Number(maxPrice));
    const matchesIncome = (!minIncome || numIncome >= Number(minIncome)) && (!maxIncome || numIncome <= Number(maxIncome));
    return matchesPlatform && matchesApproved && matchesSearch && matchesTopic && matchesSubs && matchesPrice && matchesIncome;
  });

  const topics = ['전체', '게임', '비즈니스', '뷰티/패션', '음식/맛집', '정보/뉴스', '스포츠', '유머/엔터', '라이프스타일', '기타'];

  return (
    <div className="max-w-6xl mx-auto pb-20 sm:pb-24 px-3 sm:px-4 md:px-6">
      {/* 모바일/태블릿 전용: 헤더 + 간단 필터 + 목록형 */}
      <section className="lg:hidden bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 mb-4 sm:mb-6 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-50">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">채널판매</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">원하는 채널을 검색하고 구매해보세요</p>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex overflow-x-auto gap-2 pb-1 sm:flex-wrap sm:justify-start [&::-webkit-scrollbar]:h-0" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {['전체', 'YouTube', 'TikTok', 'Twitter', 'Instagram', 'Facebook', 'Telegram'].map((p) => (
              <button key={p} onClick={() => setActivePlatform(p)} className={`shrink-0 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-[13px] font-bold transition-all border ${activePlatform === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-gray-200'}`}>{p}</button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="채널명으로 검색" className="flex-1 min-w-0 p-3 sm:p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-medium text-gray-800 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300" />
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="p-3 sm:p-3.5 bg-gray-50 border border-gray-100 rounded-xl font-medium text-gray-600 text-sm outline-none focus:ring-2 focus:ring-blue-200 sm:w-40">
              <option value="전체">주제 선택</option>
              {topics.filter(t => t !== '전체').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowOnlyApproved(!showOnlyApproved)} className={`shrink-0 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm border transition-all ${showOnlyApproved ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {showOnlyApproved && '✓ '}수익창출
            </button>
          </div>
        </div>
      </section>

      {/* 데스크톱 전용: 원래 필터 + 그리드 카드 */}
      <div className="hidden lg:block bg-white p-6 md:p-10 rounded-3xl md:rounded-[40px] shadow-sm mb-8 md:mb-12 border border-gray-100">
        <div className="flex overflow-x-auto gap-2 pb-2 flex-wrap justify-center gap-2">
          {['전체', 'YouTube', 'TikTok', 'Twitter', 'Instagram', 'Facebook', 'Telegram'].map((p) => (
            <button key={p} onClick={() => setActivePlatform(p)} className={`shrink-0 px-6 py-2 rounded-full text-[13px] font-black transition-all border-2 ${activePlatform === p ? 'bg-gray-900 text-white border-gray-900 shadow-md scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}>{p}</button>
          ))}
        </div>
        <div className="max-w-5xl mx-auto space-y-4 mt-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="채널명으로 검색" className="flex-[2] p-4 bg-gray-50 border border-transparent rounded-2xl outline-none font-bold text-gray-700 text-[15px] focus:bg-white focus:border-blue-500 transition-all shadow-inner" />
            <select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="flex-1 p-4 bg-gray-50 border border-transparent rounded-2xl outline-none font-bold text-gray-500 cursor-pointer shadow-inner text-[15px] focus:bg-white">
              <option value="전체">주제 선택</option>
              {topics.filter(t => t !== '전체').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowOnlyApproved(!showOnlyApproved)} className={`flex-1 p-4 rounded-2xl font-black text-[15px] transition-all border flex items-center justify-center gap-2 shadow-sm ${showOnlyApproved ? 'bg-gray-900 text-white border-gray-900 scale-105' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
              {showOnlyApproved && <span className="text-blue-400">✓</span>} 수익창출
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-4 border-t border-gray-50">
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Subs</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minSubs} onChange={(e) => setMinSubs(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxSubs} onChange={(e) => setMaxSubs(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
            <div className="flex items-center gap-3"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Price</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
            <div className="flex items-center gap-3 sm:col-span-2 md:col-span-1"><span className="text-[11px] font-black text-gray-400 shrink-0 w-12 uppercase italic tracking-widest">Inc.</span><div className="flex-1 flex items-center gap-2 min-w-0"><input type="number" placeholder="부터" value={minIncome} onChange={(e) => setMinIncome(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /><span className="text-gray-300 shrink-0">~</span><input type="number" placeholder="까지" value={maxIncome} onChange={(e) => setMaxIncome(e.target.value)} className="w-full p-3 bg-gray-50 border border-transparent rounded-xl outline-none font-bold text-gray-700 text-xs focus:bg-white focus:border-gray-200 shadow-inner" /></div></div>
          </div>
        </div>
      </div>

      {/* 모바일/태블릿: 목록형 */}
      <div className="lg:hidden space-y-2 sm:space-y-3 max-h-[calc(100vh-16rem)] sm:max-h-[75vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {filteredChannels.length === 0 ? (
          <div className="py-16 sm:py-24 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold text-sm sm:text-base">조건에 맞는 채널이 없습니다.</p>
          </div>
        ) : filteredChannels.map((ch) => (
          <div key={ch.id} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-gray-200 transition-all flex items-stretch min-h-[100px] sm:min-h-[120px]">
            <Link
              to={ch.isSoldOut ? '#' : `/channels/${ch.id}`}
              onClick={(e) => ch.isSoldOut && e.preventDefault()}
              className={`flex flex-1 min-w-0 items-center gap-3 sm:gap-4 p-3 sm:p-4 ${ch.isSoldOut ? 'cursor-default' : ''}`}
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                <img src={ch.thumbnail} className={`w-full h-full object-cover ${!ch.isSoldOut && 'group-hover:opacity-95'}`} alt="" />
                {ch.isSoldOut && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-[10px] font-black uppercase">완료</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{ch.platform}</span>
                  {ch.isApproved && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">승인</span>}
                  {ch.isHot && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">HOT</span>}
                </div>
                <h3 className={`font-bold text-gray-900 mt-0.5 line-clamp-2 text-sm sm:text-base leading-snug ${!ch.isSoldOut && 'hover:text-blue-600'}`}>{ch.title}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>구독 {ch.subscribers.toLocaleString()}명</span>
                  <span className="font-bold text-blue-600">₩{(ch.price / 10000).toLocaleString()}만</span>
                </div>
              </div>
            </Link>
            <div className="flex items-center pr-3 sm:pr-4 py-3 flex-shrink-0">
              <button
                onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'channel', data: ch }); }}
                className={`p-2.5 rounded-full transition-all ${isWishlisted(ch.id) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:text-red-500'}`}
                aria-label="찜하기"
              >
                <svg className="w-4 h-4" fill={isWishlisted(ch.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 그리드 카드 */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8 px-1 sm:px-2">
        {filteredChannels.length === 0 ? (
          <div className="col-span-full py-24 md:py-32 text-center bg-white rounded-3xl md:rounded-[40px] border-2 border-dashed border-gray-100">
            <p className="text-gray-300 font-black italic text-lg px-4">조건에 맞는 채널이 없습니다.</p>
          </div>
        ) : filteredChannels.map((ch) => (
          <div key={ch.id} className="bg-white rounded-2xl md:rounded-[24px] overflow-hidden shadow-sm group border border-gray-100 relative transition-all hover:-translate-y-2 hover:shadow-xl">
            <Link
              to={ch.isSoldOut ? '#' : `/channels/${ch.id}`}
              onClick={(e) => ch.isSoldOut && e.preventDefault()}
              className={`block ${ch.isSoldOut ? 'cursor-default' : ''}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <img src={ch.thumbnail} className={`w-full h-full object-cover transition-transform duration-700 ${!ch.isSoldOut && 'group-hover:scale-110'}`} alt={ch.title} />
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {ch.isApproved && (
                    <span className="bg-[#FFD600] text-gray-900 text-[11px] font-black px-2.5 py-0.5 rounded-lg italic uppercase tracking-tighter flex items-center justify-center shadow-md">승인채널</span>
                  )}
                  {ch.isHot && (
                    <span className="bg-[#FF4D4D] text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg italic uppercase tracking-widest flex items-center justify-center shadow-md">HOT</span>
                  )}
                </div>
                {ch.isSoldOut && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-10">
                    <span className="text-white text-sm font-black italic tracking-widest border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl uppercase">판매완료</span>
                  </div>
                )}
              </div>
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase tracking-widest italic">{ch.platform}</span>
                  <span className="text-[9px] font-bold text-gray-300">#CH.{ch.id.slice(-4).toUpperCase()}</span>
                </div>
                <h3 className={`font-black text-gray-900 mb-6 h-10 line-clamp-2 leading-tight transition-colors text-[15px] ${!ch.isSoldOut && 'group-hover:text-blue-600'}`}>{ch.title}</h3>
                <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                  <div className="flex flex-col"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">Subscribers</span><span className="text-[12px] font-black text-gray-700">{ch.subscribers.toLocaleString()}명</span></div>
                  <div className="flex flex-col items-end"><span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">Price</span><span className="text-xl font-black text-blue-600 italic tracking-tighter">₩{(ch.price / 10000).toLocaleString()}만</span></div>
                </div>
              </div>
            </Link>
            <button onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'channel', data: ch }); }} className={`absolute top-4 right-4 p-2.5 rounded-full transition-all shadow-md active:scale-90 z-20 ${isWishlisted(ch.id) ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-100' : 'bg-white/80 backdrop-blur-md text-gray-400 hover:text-red-500'}`}><svg className="w-4 h-4" fill={isWishlisted(ch.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChannelSales;
