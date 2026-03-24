
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { WishlistItem, ChannelProduct, EbookProduct, StoreType } from '@/types';

interface Props {
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  channels: ChannelProduct[];
  ebooks: EbookProduct[];
}

type FilterTab = 'all' | 'channel' | StoreType;

const FILTER_TABS: { id: FilterTab; label: string; icon: string; color: string }[] = [
  { id: 'all',       label: '전체',       icon: '❤️',  color: 'gray' },
  { id: 'channel',   label: '채널',       icon: '📺',  color: 'blue' },
  { id: 'marketing', label: '마케팅',     icon: '📢',  color: 'rose' },
  { id: 'lecture',   label: '강의',       icon: '🎓',  color: 'indigo' },
  { id: 'consulting',label: '컨설팅',     icon: '🤝',  color: 'green' },
  { id: 'template',  label: '자료·템플릿', icon: '📁',  color: 'purple' },
  { id: 'ebook',     label: '전자책',     icon: '📖',  color: 'orange' },
];

const TAB_ACTIVE_CLASSES: Record<string, string> = {
  gray:   'border-gray-400 bg-white shadow-xl scale-[1.02] text-gray-800',
  blue:   'border-blue-500 bg-white shadow-xl shadow-blue-50 scale-[1.02] text-blue-700',
  rose:   'border-rose-500 bg-white shadow-xl shadow-rose-50 scale-[1.02] text-rose-700',
  indigo: 'border-indigo-500 bg-white shadow-xl shadow-indigo-50 scale-[1.02] text-indigo-700',
  green:  'border-green-500 bg-white shadow-xl shadow-green-50 scale-[1.02] text-green-700',
  purple: 'border-purple-500 bg-white shadow-xl shadow-purple-50 scale-[1.02] text-purple-700',
  orange: 'border-orange-500 bg-white shadow-xl shadow-orange-50 scale-[1.02] text-orange-700',
};

const WishlistPage: React.FC<Props> = ({ wishlist, onToggleWishlist, channels, ebooks }) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // 메인 데이터에서 최신 상태를 찾아 덮어씌움
  const syncWishlist = useMemo(() => {
    return wishlist.map(item => {
      if (item.type === 'channel') {
        const latest = channels.find(c => c.id === item.data.id);
        return { ...item, data: latest || item.data };
      } else {
        const latest = ebooks.find(e => e.id === item.data.id);
        return { ...item, data: latest || item.data };
      }
    });
  }, [wishlist, channels, ebooks]);

  // 탭별 필터링
  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return syncWishlist;
    if (activeTab === 'channel') return syncWishlist.filter(i => i.type === 'channel');
    return syncWishlist.filter(i => i.type === 'ebook' && (i.data as EbookProduct).storeType === activeTab);
  }, [syncWishlist, activeTab]);

  // 탭별 카운트
  const countFor = (tab: FilterTab) => {
    if (tab === 'all') return syncWishlist.length;
    if (tab === 'channel') return syncWishlist.filter(i => i.type === 'channel').length;
    return syncWishlist.filter(i => i.type === 'ebook' && (i.data as EbookProduct).storeType === tab).length;
  };

  const renderMobileItem = (item: WishlistItem) => {
    const isSoldOut = 'isSoldOut' in item.data ? item.data.isSoldOut : false;
    const isPaused = 'isPaused' in item.data ? item.data.isPaused : false;
    const isDisabled = isSoldOut || isPaused;

    return (
      <div key={item.data.id} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-gray-200 transition-all flex items-stretch min-h-[90px] sm:min-h-[110px]">
        <Link
          to={isDisabled ? '#' : `/${item.type}s/${item.data.id}`}
          onClick={(e) => isDisabled && e.preventDefault()}
          className={`flex flex-1 min-w-0 items-center gap-3 sm:gap-4 p-3 sm:p-4 ${isDisabled ? 'cursor-default' : ''}`}
        >
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
            <img src={item.data.thumbnail} className="w-full h-full object-cover" alt="" />
            {isDisabled && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-[9px] font-black">{isSoldOut ? '완료' : '중지'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{item.data.category}</span>
            </div>
            <h3 className="font-bold text-gray-900 line-clamp-2 text-sm sm:text-[15px] leading-snug">{item.data.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>{'subscribers' in item.data ? `구독 ${item.data.subscribers.toLocaleString()}명` : item.data.author}</span>
              <span className="font-bold text-blue-600">₩{'subscribers' in item.data ? `${(item.data.price / 10000).toFixed(0)}만` : item.data.price.toLocaleString()}</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center pr-3 sm:pr-4 flex-shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); onToggleWishlist(item); }}
            className="p-2.5 rounded-full bg-red-500 text-white transition-all active:scale-90"
            aria-label="찜 해제"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          </button>
        </div>
      </div>
    );
  };

  const renderGridItem = (item: WishlistItem) => {
    const isSoldOut = 'isSoldOut' in item.data ? item.data.isSoldOut : false;
    const isPaused = 'isPaused' in item.data ? item.data.isPaused : false;
    const isDisabled = isSoldOut || isPaused;

    return (
      <div key={item.data.id} className="bg-white rounded-[24px] overflow-hidden shadow-sm group border border-gray-100 transition-all hover:-translate-y-2 hover:shadow-xl relative">
        <Link
          to={isDisabled ? '#' : `/${item.type}s/${item.data.id}`}
          onClick={(e) => isDisabled && e.preventDefault()}
          className={`block ${isDisabled ? 'cursor-default' : ''}`}
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={item.data.thumbnail} className={`w-full h-full object-cover transition-transform duration-700 ${!isDisabled && 'group-hover:scale-110'}`} />
            {isDisabled && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                <span className="text-white text-sm font-black italic tracking-widest border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl">
                  {isSoldOut ? '판매완료' : '판매일시중지'}
                </span>
              </div>
            )}
          </div>
          <div className="p-5 md:p-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-full uppercase tracking-widest italic">{item.data.category}</span>
              <span className="text-[9px] font-bold text-gray-300">{item.type === 'channel' ? '채널' : '스토어'}</span>
            </div>
            <h3 className={`font-black text-gray-900 mb-5 h-10 line-clamp-2 leading-tight transition-colors text-[15px] ${!isDisabled && 'group-hover:text-blue-600'}`}>{item.data.title}</h3>
            <div className="flex justify-between items-end border-t border-gray-50 pt-4">
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">{item.type === 'channel' ? 'Subscribers' : 'Expert'}</span>
                <span className="text-[12px] font-black text-gray-700">{'subscribers' in item.data ? `${item.data.subscribers.toLocaleString()}명` : item.data.author}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-1 italic">Price</span>
                <span className="text-xl font-black text-blue-600 italic tracking-tighter">₩{'subscribers' in item.data ? `${(item.data.price / 10000).toFixed(0)}만` : item.data.price.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); onToggleWishlist(item); }}
          className="absolute top-3 right-3 p-2 rounded-full bg-red-500 text-white shadow-md active:scale-90 z-20"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 px-3 sm:px-4 md:px-6 xl:px-0">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3 italic">
          <span className="w-1.5 h-6 sm:h-8 bg-red-500 rounded-full"></span>나의 찜 보관함
        </h2>
        <span className="bg-white border border-gray-100 px-3 py-1.5 sm:px-5 sm:py-2 rounded-full text-xs sm:text-sm font-black text-gray-400 shadow-sm">총 {wishlist.length}개</span>
      </div>

      {/* 카테고리 탭 */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3 mb-6 sm:mb-10">
        {FILTER_TABS.map(tab => {
          const cnt = countFor(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center p-2.5 sm:p-4 rounded-[16px] sm:rounded-[24px] transition-all duration-300 border-2 overflow-hidden ${
                isActive
                  ? TAB_ACTIVE_CLASSES[tab.color]
                  : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
              }`}
            >
              <span className="text-lg sm:text-2xl mb-0.5 sm:mb-1">{tab.icon}</span>
              <span className="text-[10px] sm:text-[13px] font-black leading-tight text-center">{tab.label}</span>
              {cnt > 0 && (
                <span className={`absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      {wishlist.length === 0 ? (
        <div className="bg-white rounded-[32px] sm:rounded-[48px] border border-dashed border-gray-200 py-20 sm:py-32 flex flex-col items-center text-center px-4">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-50 rounded-full flex items-center justify-center text-3xl sm:text-5xl mb-4 sm:mb-6 opacity-20 transform rotate-12">❤️</div>
          <h3 className="text-base sm:text-xl font-black text-gray-300 mb-2">찜한 상품이 없습니다.</h3>
          <p className="text-xs sm:text-sm font-bold text-gray-300">채널판매와 N잡 스토어 페이지에서 하트를 눌러보세요!</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 py-16 sm:py-24 flex flex-col items-center text-center px-4">
          <p className="text-gray-300 font-bold text-sm">이 카테고리에 찜한 상품이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 모바일/태블릿: 목록형 */}
          <div className="lg:hidden space-y-2 sm:space-y-3">
            {filteredItems.map(renderMobileItem)}
          </div>

          {/* 데스크톱: 그리드형 */}
          <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-6 xl:gap-8">
            {filteredItems.map(renderGridItem)}
          </div>
        </>
      )}
    </div>
  );
};

export default WishlistPage;
