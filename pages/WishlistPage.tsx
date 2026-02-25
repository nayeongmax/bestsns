
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { WishlistItem, ChannelProduct, EbookProduct, StoreType } from '@/types';

interface Props {
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  channels: ChannelProduct[];
  ebooks: EbookProduct[];
}

const WishlistPage: React.FC<Props> = ({ wishlist, onToggleWishlist, channels, ebooks }) => {
  // 메인 데이터(channels, ebooks)에서 최신 상태를 찾아 찜 목록에 덮어씌움 (실시간 동기화)
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

  // 카테고리별 분류
  const channelWishlist = syncWishlist.filter(item => item.type === 'channel');
  
  const getEbookByType = (type: StoreType) => 
    syncWishlist.filter(item => item.type === 'ebook' && (item.data as EbookProduct).storeType === type);

  const categories = [
    { label: '찜한 마케팅', items: getEbookByType('marketing'), color: 'bg-rose-500' },
    { label: '찜한 강의', items: getEbookByType('lecture'), color: 'bg-blue-600' },
    { label: '찜한 컨설팅', items: getEbookByType('consulting'), color: 'bg-green-600' },
    { label: '찜한 자료·템플릿', items: getEbookByType('template'), color: 'bg-purple-600' },
    { label: '찜한 전자책', items: getEbookByType('ebook'), color: 'bg-gray-900' },
  ];

  const renderItem = (item: WishlistItem) => {
    const isSoldOut = 'isSoldOut' in item.data ? item.data.isSoldOut : false;
    const isPaused = 'isPaused' in item.data ? item.data.isPaused : false;
    const isDisabled = isSoldOut || isPaused;

    return (
      <div key={item.data.id} className="bg-white rounded-[32px] overflow-hidden shadow-md group border border-gray-100 transition-all hover:-translate-y-2 relative">
        <Link 
          to={isDisabled ? '#' : `/${item.type}s/${item.data.id}`} 
          onClick={(e) => isDisabled && e.preventDefault()}
          className={`block ${isDisabled ? 'cursor-default' : ''}`}
        >
          <div className="relative aspect-[4/3] overflow-hidden">
            <img src={item.data.thumbnail} className={`w-full h-full object-cover transition-transform ${!isDisabled && 'group-hover:scale-105'}`} />
            {isDisabled && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                <span className="text-white text-lg font-black italic tracking-widest border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl">
                  {isSoldOut ? '판매완료' : '판매일시중지'}
                </span>
              </div>
            )}
          </div>
          <div className="p-6 sm:p-6 xl:p-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] sm:text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase tracking-wider">{item.data.category}</span>
            </div>
            <h3 className={`font-black text-gray-900 mb-4 xl:mb-6 h-10 line-clamp-2 leading-tight transition-colors ${!isDisabled && 'group-hover:text-blue-600'}`}>{item.data.title}</h3>
            <div className="flex justify-between items-end border-t border-gray-50 pt-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-300 font-bold uppercase">{item.type === 'channel' ? '구독자' : '전문가'}</span>
                <span className="text-sm font-black text-gray-700">{'subscribers' in item.data ? `${item.data.subscribers.toLocaleString()}명` : item.data.author}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-300 font-bold uppercase">가격</span>
                <span className="text-xl font-black text-gray-900 italic tracking-tighter">
                  ₩{'subscribers' in item.data ? `${(item.data.price / 10000).toLocaleString()}만` : item.data.price.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </Link>
        <button onClick={(e) => { e.preventDefault(); onToggleWishlist(item); }} className="absolute top-4 right-4 p-2.5 rounded-full bg-red-500 text-white shadow-md active:scale-90 z-20"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></button>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 px-4 md:px-6 xl:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 xl:mb-12">
        <h2 className="text-2xl sm:text-3xl xl:text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3 italic">나의 찜 보관함</h2>
        <span className="bg-white border border-gray-100 px-4 py-2.5 sm:px-6 sm:py-2 rounded-full text-sm font-black text-gray-400 shadow-sm">총 {wishlist.length}개 상품</span>
      </div>
      
      {wishlist.length === 0 ? (
        <div className="bg-white rounded-[48px] border border-dashed border-gray-200 py-24 sm:py-32 xl:py-32 flex flex-col items-center text-center px-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 xl:w-24 xl:h-24 bg-gray-50 rounded-full flex items-center justify-center text-4xl sm:text-5xl xl:text-5xl mb-6 xl:mb-8 opacity-20 transform rotate-12">❤️</div>
          <h3 className="text-lg sm:text-xl xl:text-xl font-black text-gray-300 mb-2">찜한 상품이 없습니다.</h3>
          <p className="text-sm font-bold text-gray-300">채널판매와 N잡 스토어 페이지에서 하트를 눌러보세요!</p>
        </div>
      ) : (
        <div className="space-y-16 xl:space-y-24">
          {/* 찜한 채널 섹션 */}
          {channelWishlist.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6 xl:mb-8">
                <div className="w-2 h-6 sm:h-8 xl:h-8 bg-gray-900 rounded-full"></div>
                <h3 className="text-xl sm:text-2xl xl:text-2xl font-black text-gray-900 italic">찜한 채널 ({channelWishlist.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
                {channelWishlist.map(renderItem)}
              </div>
            </section>
          )}

          {/* N잡 스토어 유형별 섹션 */}
          {categories.map((cat) => cat.items.length > 0 && (
            <section key={cat.label}>
              <div className="flex items-center gap-3 mb-6 xl:mb-8">
                <div className={`w-2 h-6 sm:h-8 xl:h-8 ${cat.color} rounded-full`}></div>
                <h3 className="text-xl sm:text-2xl xl:text-2xl font-black text-gray-900 italic">{cat.label} ({cat.items.length})</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
                {cat.items.map(renderItem)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
