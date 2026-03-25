
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EbookProduct, UserProfile, WishlistItem, StoreType, GradeConfig, getUserGrade } from '@/types';
import { EBOOK_CATEGORIES, MARKETING_CATEGORIES } from '@/constants';

interface Props {
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  user: UserProfile;
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  members?: UserProfile[];
  gradeConfigs?: GradeConfig[];
}

type StoreTypeFilter = StoreType | 'all';

const STORE_TABS: { id: StoreTypeFilter; label: string; icon: string; color: string }[] = [
  { id: 'all', label: '전체', icon: '📂', color: 'gray' },
  { id: 'marketing', label: '마케팅', icon: '📢', color: 'rose' },
  { id: 'lecture', label: '강의', icon: '🎓', color: 'blue' },
  { id: 'consulting', label: '컨설팅', icon: '🤝', color: 'green' },
  { id: 'template', label: '자료·템플릿', icon: '📁', color: 'purple' },
  { id: 'ebook', label: '전자책', icon: '📖', color: 'orange' },
];

const EbookSales: React.FC<Props> = ({ ebooks, setEbooks, user, wishlist, onToggleWishlist, members = [], gradeConfigs = [] }) => {
  const [activeStoreType, setActiveStoreType] = useState<StoreTypeFilter>('all');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [activeSubCategory, setActiveSubCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();

  const safeEbooks = Array.isArray(ebooks) ? ebooks : [];
  const filteredEbooks = useMemo(() => {
    return safeEbooks.filter(e => {
      if (!e || typeof e !== 'object') return false;
      const matchType = activeStoreType === 'all' || (e.storeType || 'ebook') === activeStoreType;
      const matchCategory = activeCategory === '전체' || (e.category || '') === activeCategory;
      const matchSubCategory = activeSubCategory === '전체' || (e.subCategory || '') === activeSubCategory;
      const title = (e.title ?? '').toString();
      const author = (e.author ?? '').toString();
      const matchSearch = !searchQuery.trim() || title.toLowerCase().includes(searchQuery.toLowerCase()) || author.toLowerCase().includes(searchQuery.toLowerCase());
      const isApproved = e.status === 'approved';
      return matchType && matchCategory && matchSubCategory && matchSearch && isApproved;
    });
  }, [safeEbooks, activeStoreType, activeCategory, activeSubCategory, searchQuery]);

  const isWishlisted = (id: string) => wishlist.some(w => w.data.id === id);

  const handleRegisterClick = () => {
    if (user.role === 'admin' || user.sellerStatus === 'approved') {
      const typeForRegister = activeStoreType === 'all' ? 'marketing' : activeStoreType;
      navigate('/ebooks/register', { state: { selectedStoreType: typeForRegister } });
    } else {
      alert('판매자 등록 후 판매가능합니다.\n빠르게 승인해드릴테니 수익화해보세요!');
      navigate('/mypage', { state: { activeTab: 'seller' } });
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* 초거대 대분류 탭 섹션 - 6개 탭 한 줄 배치 */}
      <div className="mb-4 sm:mb-8 md:mb-12">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4">
          {STORE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveStoreType(tab.id);
                setActiveCategory('전체');
                setActiveSubCategory('전체');
              }}
              className={`relative flex flex-col items-center justify-center p-2.5 sm:p-5 md:p-6 rounded-[16px] md:rounded-[32px] transition-all duration-300 border-2 overflow-hidden group ${
                activeStoreType === tab.id
                ? tab.id === 'all'
                  ? 'bg-white border-gray-400 shadow-2xl shadow-gray-100 scale-[1.02]'
                  : `bg-white border-${tab.color}-500 shadow-2xl shadow-${tab.color}-100 scale-[1.02]`
                : 'bg-white border-transparent grayscale hover:grayscale-0 hover:border-gray-100 hover:bg-gray-50 opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`text-2xl sm:text-3xl md:text-4xl mb-1.5 sm:mb-3 transition-transform duration-500 ${activeStoreType === tab.id ? 'scale-110 rotate-3' : 'group-hover:scale-110'}`}>
                {tab.icon}
              </div>
              <span className={`text-xs sm:text-base md:text-lg font-black italic tracking-tighter ${activeStoreType === tab.id ? (tab.id === 'all' ? 'text-gray-700' : `text-${tab.color}-600`) : 'text-gray-400'}`}>
                {tab.label}
              </span>
              {activeStoreType === tab.id && (
                <div className={`absolute bottom-0 left-0 right-0 h-2 ${tab.id === 'all' ? 'bg-gray-400' : `bg-${tab.color}-500`}`}></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 필터 바: 검색창 + 상품등록 버튼 한 줄, 전체~전자책 공통 */}
      <div className="bg-white p-3 sm:p-6 md:p-10 rounded-[20px] md:rounded-[48px] shadow-sm mb-4 sm:mb-8 md:mb-12 relative border border-gray-100 space-y-3 sm:space-y-6">
        {/* 검색창 + 상품 등록 버튼 한 줄 */}
        <div className="flex flex-nowrap items-center gap-2 sm:gap-3 md:gap-4">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeStoreType === 'all' ? '상품 제목이나 전문가를 검색해보세요' : `${STORE_TABS.find(t => t.id === activeStoreType)?.label} 제목이나 전문가를 검색해보세요`}
              className="w-full pl-9 sm:pl-12 md:pl-16 pr-3 sm:pr-6 py-2.5 sm:py-4 md:py-5 bg-gray-50 rounded-[14px] md:rounded-[32px] border-none focus:ring-4 focus:ring-blue-50 text-sm sm:text-base md:text-lg font-bold outline-none transition-all shadow-inner"
            />
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-300 absolute left-3 sm:left-6 md:left-8 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <button
            onClick={handleRegisterClick}
            className="shrink-0 bg-blue-600 text-white px-3 sm:px-6 md:px-8 py-2 sm:py-3.5 md:py-4 rounded-xl sm:rounded-2xl font-black text-[11px] sm:text-[13px] flex items-center justify-center gap-1.5 sm:gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 active:scale-95 whitespace-nowrap"
          >
            <span className="text-xl">+</span> {activeStoreType === 'all' ? '상품 등록' : STORE_TABS.find(t => t.id === activeStoreType)?.label + ' 등록'}
          </button>
        </div>

        {/* 카테고리 필터: 전체가 아닐 때만 */}
        {activeStoreType !== 'all' && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
            {activeStoreType === 'marketing' ? (
              Object.keys(MARKETING_CATEGORIES).map(cat => (
                <button 
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setActiveSubCategory('전체'); }}
                  className={`px-5 py-3 rounded-xl text-[11px] font-black transition-all border-2 shrink-0 whitespace-nowrap ${
                    activeCategory === cat 
                    ? 'bg-rose-500 border-rose-500 text-white shadow-lg' 
                    : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))
            ) : (
              EBOOK_CATEGORIES.map(cat => (
                <button 
                  key={cat} 
                  onClick={() => { setActiveCategory(cat); setActiveSubCategory('전체'); }}
                  className={`px-5 py-3 rounded-xl text-[11px] font-black transition-all border-2 shrink-0 whitespace-nowrap ${
                    activeCategory === cat 
                    ? 'bg-gray-900 border-gray-900 text-white shadow-lg' 
                    : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))
            )}
          </div>
        )}

        {activeStoreType === 'marketing' && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-50 overflow-x-auto no-scrollbar">
            {MARKETING_CATEGORIES[activeCategory as keyof typeof MARKETING_CATEGORIES]?.map(sub => (
              <button 
                key={sub} 
                onClick={() => setActiveSubCategory(sub)}
                className={`px-6 py-2.5 rounded-2xl text-[12px] font-bold transition-all whitespace-nowrap shrink-0 ${
                  activeSubCategory === sub 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 모바일/태블릿: 목록형 (채널판매 스타일) */}
      <div className="lg:hidden space-y-2 sm:space-y-3">
        {filteredEbooks.length === 0 ? (
          <div className="py-16 sm:py-24 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
            <span className="text-4xl mb-4 block grayscale">📭</span>
            <p className="text-gray-400 font-bold text-sm sm:text-base">조건에 맞는 상품이 없습니다.</p>
          </div>
        ) : filteredEbooks.map((ebook, idx) => (
          <div key={ebook.id || `ebook-${idx}`} className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:border-gray-200 transition-all flex items-stretch min-h-[100px] sm:min-h-[120px]">
            <Link
              to={ebook.isPaused ? '#' : `/ebooks/${ebook.id}`}
              onClick={(e) => ebook.isPaused && e.preventDefault()}
              className={`flex flex-1 min-w-0 items-center gap-3 sm:gap-4 p-3 sm:p-4 ${ebook.isPaused ? 'cursor-default' : ''}`}
            >
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                <img src={ebook.thumbnail || ''} className="w-full h-full object-cover" alt="" />
                {ebook.isPaused && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white text-[9px] font-black uppercase">PAUSED</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{STORE_TABS.find(t => t.id === (ebook.storeType || 'ebook'))?.label || '전자책'}</span>
                  {ebook.isPrime && <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded uppercase">PRIME</span>}
                  {ebook.isHot && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">HOT</span>}
                  {ebook.isNew && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">NEW</span>}
                </div>
                <h3 className={`font-bold text-gray-900 mt-0.5 line-clamp-2 text-sm sm:text-base leading-snug ${!ebook.isPaused && 'hover:text-blue-600'}`}>{ebook.title}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                  <span>{ebook.author}</span>
                  <span className="font-bold text-blue-600">₩{(Number(ebook.price) || 0).toLocaleString()}</span>
                </div>
              </div>
            </Link>
            <div className="flex items-center pr-3 sm:pr-4 py-3 flex-shrink-0">
              <button
                onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'ebook', data: ebook }); }}
                className={`p-2.5 rounded-full transition-all ${isWishlisted(ebook.id) ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:text-red-500'}`}
                aria-label="찜하기"
              >
                <svg className="w-4 h-4" fill={isWishlisted(ebook.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱: 그리드 카드 */}
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-6 px-2">
        {filteredEbooks.length === 0 ? (
          <div className="col-span-full py-40 text-center bg-white rounded-[60px] border border-dashed border-gray-100">
            <span className="text-6xl mb-6 block grayscale">📭</span>
            <p className="text-gray-300 font-black text-xl italic uppercase tracking-widest">No Products Found</p>
          </div>
        ) : (
          filteredEbooks.map((ebook, idx) => (
            <div key={ebook.id || `ebook-${idx}`} className="bg-white rounded-[24px] overflow-hidden shadow-sm group border border-gray-100 relative transition-all hover:-translate-y-1">
              <Link
                to={ebook.isPaused ? '#' : `/ebooks/${ebook.id}`}
                onClick={(e) => ebook.isPaused && e.preventDefault()}
                className={`block ${ebook.isPaused ? 'cursor-default' : ''}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                  <img src={ebook.thumbnail || ''} alt="" className={`w-full h-full object-cover transition-transform duration-700 ${!ebook.isPaused && 'group-hover:scale-105'}`} />
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    {ebook.isPrime && (
                      <span className="bg-[#FFD600] text-gray-900 text-[12px] font-black px-2.5 py-0.5 rounded-lg italic uppercase flex items-center justify-center">PRIME</span>
                    )}
                    {ebook.isHot && (
                      <span className="bg-[#FF4D4D] text-white text-[12px] font-black px-2.5 py-0.5 rounded-lg italic uppercase flex items-center justify-center">HOT</span>
                    )}
                    {ebook.isNew && (
                      <span className="bg-[#3B82F6] text-white text-[12px] font-black px-2.5 py-0.5 rounded-lg italic uppercase flex items-center justify-center">NEW</span>
                    )}
                  </div>
                  {ebook.isPaused && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-10">
                      <span className="text-white text-sm font-black italic tracking-widest border-2 border-white px-3 py-0.5 rotate-[-12deg] shadow-2xl uppercase">PAUSED</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex gap-1 mb-2 min-w-0">
                    <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">{STORE_TABS.find(t => t.id === (ebook.storeType || 'ebook'))?.label || '전자책'}</span>
                  </div>
                  <h3 className={`font-black text-gray-900 mb-3 transition-colors line-clamp-1 text-[14px] italic tracking-tight truncate ${!ebook.isPaused && 'group-hover:text-blue-600'}`} title={ebook.title}>
                    {ebook.title}
                  </h3>
                  <div className="flex justify-between items-end gap-3 border-t border-gray-50 pt-3 min-w-0">
                    <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                      <span className="text-[8px] text-gray-300 font-black uppercase tracking-widest">Expert</span>
                      <span className="text-[11px] font-black text-gray-600 italic break-words">{ebook.author}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      {(() => { const u = members.find(m => m.id === ebook.authorId || m.nickname === ebook.author); const g = getUserGrade(u, gradeConfigs); return g ? (
                        <span className={`inline-flex items-center shrink-0 whitespace-nowrap ${g.color} text-white text-[10px] font-black px-2.5 py-1 rounded-lg italic uppercase tracking-wider border border-white/40 bg-gradient-to-b from-white/30 to-transparent`} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,0.1)' }}>
                          {g.name}
                        </span>
                      ) : null; })()}
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-gray-300 font-black uppercase tracking-widest italic">Price</span>
                        <span className="text-lg font-black text-gray-900 italic tracking-tighter whitespace-nowrap">₩{(Number(ebook.price) || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); onToggleWishlist({ type: 'ebook', data: ebook }); }}
                className={`absolute top-3 right-3 p-1.5 rounded-full transition-all shadow-md active:scale-90 z-20 ${
                  isWishlisted(ebook.id)
                  ? 'bg-red-500 text-white'
                  : 'bg-white/80 backdrop-blur-md text-gray-400 hover:text-red-500'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill={isWishlisted(ebook.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                </svg>
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default EbookSales;
