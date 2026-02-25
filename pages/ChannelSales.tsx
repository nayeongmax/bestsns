
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

  const isWishlisted = (id: string) => wishlist.some(w => w.data.id === id);

  const filteredChannels = channels.filter(ch => {
    const matchesPlatform = activePlatform === '전체' || ch.platform === activePlatform;
    const matchesApproved = showOnlyApproved ? ch.isApproved : true;
    const matchesSearch = ch.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTopic = selectedTopic === '전체' || ch.category === selectedTopic;
    return matchesPlatform && matchesApproved && matchesSearch && matchesTopic;
  });

  const topics = ['전체', '게임', '비즈니스', '뷰티/패션', '음식/맛집', '정보/뉴스', '스포츠', '유머/엔터', '라이프스타일', '기타'];

  return (
    <div className="max-w-6xl mx-auto pb-20 sm:pb-24 px-3 sm:px-4 md:px-6">
      {/* 헤더 섹션: 채널판매 타이틀 + 필터 (크몽 스타일) */}
      <section className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 mb-4 sm:mb-6 overflow-hidden">
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

      {/* 상품 목록: 크몽 스타일 목록형, 한 화면 약 3개 노출 후 스크롤, 세로 중앙 정렬 */}
      <div className="space-y-2 sm:space-y-3 max-h-[calc(100vh-16rem)] sm:max-h-[75vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
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
    </div>
  );
};

export default ChannelSales;
