
import React, { useState, useMemo } from 'react';
import { EbookProduct, SiteNotification, StoreOrder, UserProfile, NotificationType, StoreType } from '@/types';
import { useNavigate } from 'react-router-dom';
import { deleteStoreProduct } from '../../storeDb';

interface Props {
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<SiteNotification[]>>;
  storeOrders: StoreOrder[];
  members: UserProfile[];
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

type StoreAdminTab = 'inventory' | 'approval' | 'orders';

const StoreAdmin: React.FC<Props> = ({ ebooks, setEbooks, storeOrders, members, addNotif }) => {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<StoreAdminTab>('inventory');
  
  // 상태 관리
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('전체');
  const [reviewingEbook, setReviewingEbook] = useState<EbookProduct | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [zoomImg, setZoomImg] = useState<string | null>(null);

  // --- 필터링 로직 ---
  const filteredInventory = useMemo(() => {
    return ebooks.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.author.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === '전체' || e.storeType === typeFilter;
      return matchSearch && matchType;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ebooks, searchQuery, typeFilter]);

  const pendingProducts = useMemo(() => 
    ebooks.filter(e => e.status === 'pending' || e.status === 'revision'), 
  [ebooks]);

  // --- 핸들러 함수 ---
  
  const handleApprove = (eb: EbookProduct) => {
    // 승인 시에는 스냅샷 및 반려사유 초기화
    setEbooks(prev => prev.map(item => item.id === eb.id ? { 
      ...item, 
      status: 'approved', 
      isPaused: false, 
      snapshot: undefined, 
      rejectionReason: undefined 
    } : item));
    addNotif(eb.authorId, 'approval', '✅ 서비스 등록 승인 완료', `축하합니다! [${eb.title}] 서비스가 승인되어 판매가 시작되었습니다.`);
    alert('승인 처리가 완료되었습니다.');
    setReviewingEbook(null);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return alert('반려 또는 보완 요청 사유를 입력하세요.');
    if (!reviewingEbook) return;

    // 반려 시점의 모든 데이터를 snapshot으로 저장 (나중에 재심사 시 비교용)
    const { snapshot: _, ...currentDataWithoutSnapshot } = reviewingEbook;
    
    setEbooks(prev => prev.map(eb => eb.id === reviewingEbook.id ? { 
      ...eb, 
      status: 'revision', 
      rejectionReason,
      snapshot: currentDataWithoutSnapshot // 현재 시점의 데이터를 스냅샷으로 봉인
    } : eb));
    
    addNotif(reviewingEbook.authorId, 'revision', '⚠️ 서비스 보완 요청', `[${reviewingEbook.title}] 상품에 대해 수정 보완 요청이 발생했습니다. 사유를 확인해 주세요.`, rejectionReason);
    
    setShowRejectModal(false);
    setReviewingEbook(null);
    setRejectionReason('');
    alert('반려 처리가 완료되었습니다.');
  };

  const toggleBadge = (id: string, field: 'isHot' | 'isPrime' | 'isNew') => {
    setEbooks(prev => prev.map(e => e.id === id ? { ...e, [field]: !e[field] } : e));
  };

  const togglePause = (id: string) => {
    setEbooks(prev => prev.map(e => e.id === id ? { ...e, isPaused: !e.isPaused } : e));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 상품을 영구 삭제하시겠습니까?')) return;
    try {
      await deleteStoreProduct(id);
      setEbooks(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
      alert('삭제에 실패했습니다.');
    }
  };

  // --- 파일 다운로드 헬퍼 ---
  const downloadSourceFile = (dataUri: string | undefined, fileName: string) => {
    if (!dataUri) return alert("판매자가 업로드한 원본 파일이 존재하지 않습니다.");
    try {
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("파일 다운로드 중 오류가 발생했습니다.");
    }
  };

  // --- 변경 사항 감지(Diff) 헬퍼 ---
  const isChanged = (field: keyof EbookProduct, currentVal: any) => {
    if (!reviewingEbook?.snapshot) return false;
    const oldVal = reviewingEbook.snapshot[field];
    
    // 배열 비교 (tiers, faqs, attachedImages)
    if (Array.isArray(currentVal)) {
      return JSON.stringify(currentVal) !== JSON.stringify(oldVal);
    }
    
    return currentVal !== oldVal;
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-32">
      {/* 서브 탭 메뉴 */}
      <div className="bg-white p-2 rounded-[28px] flex gap-2 w-fit border border-gray-100 shadow-sm mx-4">
        {[
          { id: 'inventory', label: '📦 인벤토리 마스터', icon: '💎' },
          { id: 'approval', label: `📝 심사 대기함 (${pendingProducts.length})`, icon: '⚖️' },
          { id: 'orders', label: '🛒 전체 판매 기록', icon: '📊' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveSubTab(tab.id as StoreAdminTab)} 
            className={`px-8 py-3.5 rounded-[22px] text-[13px] font-black transition-all flex items-center gap-2 ${activeSubTab === tab.id ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'inventory' && (
        <div className="space-y-8 px-4">
          <div className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-4 flex-1">
                <select 
                  value={typeFilter} 
                  onChange={e => setTypeFilter(e.target.value)}
                  className="px-6 py-4 bg-gray-50 rounded-full font-black text-xs outline-none border border-transparent focus:border-purple-200"
                >
                  <option value="전체">전체 유형</option>
                  <option value="marketing">마케팅</option>
                  <option value="ebook">전자책</option>
                  <option value="lecture">강의</option>
                  <option value="consulting">컨설팅</option>
                  <option value="template">자료·템플릿</option>
                </select>
                <div className="relative flex-1 max-w-md">
                   <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="상품명 또는 전문가 닉네임 검색..." 
                    className="w-full pl-12 pr-6 py-4 bg-gray-50 rounded-full font-bold text-sm shadow-inner outline-none" 
                   />
                   <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                </div>
             </div>
             <div className="bg-purple-50 text-purple-600 px-8 py-4 rounded-[24px] text-center shrink-0 border border-purple-100">
                <span className="text-[10px] font-black uppercase italic block mb-1">Total Active Products</span>
                <span className="text-3xl font-black italic tracking-tighter">{filteredInventory.length} <span className="text-sm not-italic font-bold">개</span></span>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
             {filteredInventory.map(eb => (
               <div key={eb.id} className={`bg-white rounded-[40px] overflow-hidden shadow-sm border-2 transition-all group relative ${eb.isPaused ? 'grayscale opacity-50 bg-gray-50 border-gray-200' : 'border-gray-100 hover:border-purple-200'}`}>
                  <div className="relative aspect-video overflow-hidden bg-gray-100">
                     <img src={eb.thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="t" />
                     {eb.isPaused && (
                       <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white font-black italic border-2 border-white px-4 py-1 rotate-[-12deg] uppercase">판매중지됨</span>
                       </div>
                     )}
                     <div className="absolute top-3 right-3 flex flex-col gap-2">
                        <button onClick={() => toggleBadge(eb.id, 'isPrime')} className={`px-2 py-1 rounded-lg text-[9px] font-black shadow-md transition-all ${eb.isPrime ? 'bg-yellow-400 text-black' : 'bg-black/30 text-white hover:bg-black/60'}`}>PRIME</button>
                        <button onClick={() => toggleBadge(eb.id, 'isHot')} className={`px-2 py-1 rounded-lg text-[9px] font-black shadow-md transition-all ${eb.isHot ? 'bg-rose-500 text-white' : 'bg-black/30 text-white hover:bg-black/60'}`}>HOT</button>
                        <button onClick={() => toggleBadge(eb.id, 'isNew')} className={`px-2 py-1 rounded-lg text-[9px] font-black shadow-md transition-all ${eb.isNew ? 'bg-blue-600 text-white' : 'bg-black/30 text-white hover:bg-black/60'}`}>NEW</button>
                     </div>
                  </div>
                  <div className="p-8 space-y-6">
                     <div className="space-y-1">
                        <p className="text-[10px] font-black text-purple-500 uppercase italic tracking-widest">{eb.storeType}</p>
                        <h4 className="text-lg font-black text-gray-900 truncate leading-tight italic">{eb.title}</h4>
                        <p className="text-[12px] font-bold text-gray-400 italic">By {eb.author} (@{eb.authorId})</p>
                     </div>
                     
                     <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                        <div className="space-y-1">
                           <span className="text-[10px] font-black text-gray-300 uppercase italic">Start Price</span>
                           <p className="text-xl font-black text-gray-900 italic tracking-tighter">₩{eb.price.toLocaleString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black italic uppercase ${eb.status === 'approved' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                           {eb.status}
                        </span>
                     </div>

                     <div className="grid grid-cols-2 gap-2 pt-2">
                        <button 
                          onClick={() => navigate('/ebooks/register', { state: { ebook: eb } })} 
                          className="py-3 bg-gray-900 text-white rounded-2xl font-black text-[11px] hover:bg-purple-600 transition-all shadow-sm italic uppercase tracking-tighter"
                        >
                          수정하기
                        </button>
                        <button 
                          onClick={() => togglePause(eb.id)} 
                          className={`py-3 rounded-2xl font-black text-[11px] text-white shadow-sm transition-all italic uppercase tracking-tighter ${eb.isPaused ? 'bg-green-500' : 'bg-rose-500'}`}
                        >
                          {eb.isPaused ? '판매 재개' : '판매 중지'}
                        </button>
                     </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(eb.id)}
                    className="absolute -top-2 -left-2 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
                  >
                    ✕
                  </button>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeSubTab === 'approval' && (
        <div className="space-y-6 px-4">
           {pendingProducts.length === 0 ? (
             <div className="bg-white p-40 rounded-[60px] text-center border-2 border-dashed border-gray-100 shadow-sm">
                <p className="text-gray-300 font-black italic text-2xl uppercase tracking-widest opacity-50">심사 대기 건이 없습니다</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-6">
                {pendingProducts.map(eb => (
                  <div key={eb.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-8 group hover:border-purple-200 transition-all">
                     <div className="flex items-center gap-8 flex-1">
                        <div className="relative">
                          <img src={eb.thumbnail} className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-xl" alt="p" />
                          <div className="absolute -top-3 -right-3 flex flex-col gap-1 items-end">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black text-white shadow-md border-2 border-white ${eb.status === 'revision' ? 'bg-orange-500' : 'bg-blue-600'}`}>
                              {eb.status === 'revision' ? 'REVISION' : 'NEW'}
                            </span>
                            {eb.snapshot && (
                              <span className="bg-rose-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-sm border border-white animate-bounce">재심사 요청 건</span>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                           <div className="flex items-center gap-3 mb-1">
                              <span className="bg-purple-50 text-purple-600 text-[10px] font-black px-2.5 py-0.5 rounded italic uppercase tracking-widest">{eb.storeType}</span>
                              <span className="text-[11px] text-gray-300 font-bold italic">신청일: {eb.createdAt.split('T')[0]}</span>
                           </div>
                           <h4 className="text-2xl font-black text-gray-900 italic truncate mb-1">{eb.title}</h4>
                           <p className="text-[13px] font-bold text-gray-400">판매자: <span className="text-gray-700">{eb.author} (@{eb.authorId})</span></p>
                        </div>
                     </div>
                     <button 
                      onClick={() => setReviewingEbook(eb)}
                      className="px-12 py-5 bg-purple-600 text-white rounded-[24px] font-black text-[15px] shadow-xl hover:bg-black transition-all italic uppercase tracking-widest"
                     >
                       상세 검수 및 승인하기
                     </button>
                  </div>
                ))}
             </div>
           )}
        </div>
      )}

      {activeSubTab === 'orders' && (
        <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden mx-4">
           <div className="p-10 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase underline decoration-purple-200 underline-offset-8">Store Sales History</h3>
              <div className="bg-gray-50 px-6 py-2 rounded-full text-[11px] font-black text-gray-400 uppercase italic tracking-widest">
                전체 거래 데이터: {storeOrders.length}건
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-[#0f172a] text-white text-[11px] font-black uppercase tracking-widest italic">
                    <tr>
                       <th className="px-10 py-6">주문일시 / ID</th>
                       <th className="px-10 py-6">구매자 정보</th>
                       <th className="px-10 py-6">판매자 정보</th>
                       <th className="px-10 py-6">상품 및 옵션</th>
                       <th className="px-10 py-6 text-right">결제금액</th>
                       <th className="px-10 py-6 text-center">진행상태</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {storeOrders.length === 0 ? (
                      <tr><td colSpan={6} className="py-40 text-center text-gray-300 italic font-black text-lg">기록된 판매 내역이 없습니다.</td></tr>
                    ) : storeOrders.sort((a,b) => b.orderTime.localeCompare(a.orderTime)).map(o => (
                      <tr key={o.id} className="hover:bg-purple-50/20 transition-all font-bold text-[14px]">
                        <td className="px-10 py-6">
                           <p className="text-gray-800">{o.orderTime}</p>
                           <p className="text-[11px] text-purple-500 mt-1">#{o.id}</p>
                        </td>
                        <td className="px-10 py-6">
                           <p className="text-gray-900">@{o.userId}</p>
                           <p className="text-[11px] text-gray-400 font-bold uppercase">{o.userNickname}</p>
                        </td>
                        <td className="px-10 py-6 text-purple-600 font-black italic">{o.sellerNickname}</td>
                        <td className="px-10 py-6 min-w-[200px]">
                           <p className="text-gray-900 truncate max-w-[220px]">{o.productName}</p>
                           <p className="text-[10px] text-gray-400 uppercase italic tracking-tighter mt-1">{o.tierName}</p>
                        </td>
                        <td className="px-10 py-6 text-right font-black text-gray-900 italic text-lg">₩{o.price.toLocaleString()}</td>
                        <td className="px-10 py-6 text-center">
                           <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic shadow-sm uppercase ${o.status === '구매확정' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                             {o.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* --- 통합 검수 상세 모달 --- */}
      {reviewingEbook && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-6xl rounded-[64px] shadow-2xl overflow-hidden flex flex-col h-[90vh] border-8 border-purple-500/10">
              {/* 모달 헤더 */}
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-[#0f172a] text-white shrink-0">
                 <div className="flex items-center gap-8">
                    <div className={`relative ${isChanged('thumbnail', reviewingEbook.thumbnail) ? 'ring-4 ring-red-500 ring-offset-4 ring-offset-[#0f172a] rounded-[32px]' : ''}`}>
                      <img 
                        src={reviewingEbook.thumbnail} 
                        className="w-20 h-20 rounded-[32px] border-4 border-white/20 object-cover cursor-zoom-in" 
                        alt="p" 
                        onClick={() => setZoomImg(reviewingEbook.thumbnail)}
                      />
                      {isChanged('thumbnail', reviewingEbook.thumbnail) && (
                        <span className="absolute -top-2 -left-2 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">CHANGED</span>
                      )}
                    </div>
                    <div>
                       <div className="flex items-center gap-3">
                          <h3 className={`text-3xl font-black italic tracking-tighter leading-none mb-1 ${isChanged('title', reviewingEbook.title) ? 'text-red-500 underline decoration-red-500 decoration-4 underline-offset-8' : ''}`}>
                             상품 심사: {reviewingEbook.title}
                          </h3>
                          {reviewingEbook.snapshot && (
                            <span className="bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full italic shadow-xl animate-pulse">RE-SUBMISSION (재심사 건)</span>
                          )}
                       </div>
                       <p className="text-[11px] text-purple-400 font-bold uppercase tracking-[0.3em] italic">Requested At: {reviewingEbook.createdAt}</p>
                    </div>
                 </div>
                 <button onClick={() => setReviewingEbook(null)} className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-3xl font-black transition-all">✕ 심사 취소</button>
              </div>

              {/* 이전 반려 사유 알림창 (재심사 시 노출) */}
              {reviewingEbook.rejectionReason && (
                <div className="bg-orange-50 border-b border-orange-100 p-6 px-16 flex items-center gap-6 shrink-0">
                   <span className="bg-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-md shrink-0">이전 반려 사유</span>
                   <p className="text-[15px] font-bold text-orange-800 italic">"{reviewingEbook.rejectionReason}"</p>
                </div>
              )}

              {/* 모달 바디 */}
              <div className="flex-1 overflow-y-auto p-16 no-scrollbar bg-white space-y-16">
                 {/* 섹션 1: 핵심 정보 및 파일 다운로드 (유형별 차별화) */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                    <div className="space-y-10">
                       <h5 className="text-xl font-black italic border-b-4 border-purple-600 pb-3 uppercase tracking-tighter">1. 서비스 핵심 메타데이터</h5>
                       <div className="space-y-6">
                          <div className={`flex justify-between border-b border-gray-50 py-3 ${isChanged('storeType', reviewingEbook.storeType) ? 'bg-red-50 p-4 rounded-xl' : ''}`}>
                             <span className="text-gray-400 font-bold italic uppercase tracking-widest text-[12px]">판매 유형</span>
                             <span className={`font-black uppercase italic text-lg ${isChanged('storeType', reviewingEbook.storeType) ? 'text-red-600' : 'text-gray-900'}`}>{reviewingEbook.storeType}</span>
                          </div>
                          <div className={`flex justify-between border-b border-gray-50 py-3 ${isChanged('category', reviewingEbook.category) || isChanged('subCategory', reviewingEbook.subCategory) ? 'bg-red-50 p-4 rounded-xl' : ''}`}>
                             <span className="text-gray-400 font-bold italic uppercase tracking-widest text-[12px]">카테고리</span>
                             <span className={`font-black text-lg ${isChanged('category', reviewingEbook.category) || isChanged('subCategory', reviewingEbook.subCategory) ? 'text-red-600' : 'text-gray-900'}`}>{reviewingEbook.category} {reviewingEbook.subCategory && `> ${reviewingEbook.subCategory}`}</span>
                          </div>
                          <div className={`flex justify-between border-b border-gray-100 py-3 ${isChanged('price', reviewingEbook.price) ? 'bg-red-50 p-4 rounded-xl' : ''}`}>
                             <span className="text-gray-400 font-bold italic uppercase tracking-widest text-[12px]">기본 판매가</span>
                             <span className={`font-black text-3xl italic tracking-tighter ${isChanged('price', reviewingEbook.price) ? 'text-red-600' : 'text-gray-900'}`}>₩{reviewingEbook.price.toLocaleString()}</span>
                          </div>
                       </div>
                       
                       {/* 패키지별 상세 스펙 및 파일 다운로드 (전자책/템플릿 전용) */}
                       <div className="space-y-6 pt-6">
                          <div className="flex justify-between items-center">
                            <h6 className="text-[12px] font-black text-purple-400 uppercase italic px-2 tracking-widest">패키지(Tier) 구성 및 업로드 파일</h6>
                            {isChanged('tiers', reviewingEbook.tiers) && <span className="text-[10px] font-black text-red-500 italic">PACKAGE DATA CHANGED ⚠</span>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             {reviewingEbook.tiers?.map((t, idx) => {
                               const oldTier = reviewingEbook.snapshot?.tiers?.[idx];
                               const tierPriceChanged = oldTier && t.price !== oldTier.price;
                               const tierFileChanged = oldTier && t.pdfFile !== oldTier.pdfFile;
                               
                               return (
                                 <div key={idx} className={`p-6 rounded-[32px] border-2 shadow-sm text-center space-y-4 transition-all ${isChanged('tiers', reviewingEbook.tiers) ? 'border-red-200 bg-red-50/20' : 'bg-gray-50 border-gray-100'}`}>
                                    <p className="text-[11px] font-black text-purple-600 uppercase italic tracking-widest">{t.name}</p>
                                    <p className={`font-black text-xl italic tracking-tighter ${tierPriceChanged ? 'text-red-600' : 'text-gray-900'}`}>₩{t.price.toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-400 font-bold italic">{t.pageCount}{reviewingEbook.storeType === 'ebook' ? 'P' : '일'}</p>
                                    
                                    {(reviewingEbook.storeType === 'ebook' || reviewingEbook.storeType === 'template') && t.pdfFile && (
                                      <div className="space-y-2">
                                        <button 
                                          onClick={() => downloadSourceFile(t.pdfFile, `review_${reviewingEbook.title}_${t.name}`)}
                                          className={`w-full py-2 rounded-xl text-[10px] font-black transition-all shadow-md uppercase italic ${tierFileChanged ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-black'}`}
                                        >
                                          📄 원본파일 검수 {tierFileChanged && '(!)'}
                                        </button>
                                        {tierFileChanged && <p className="text-[8px] font-black text-red-500">파일 교체됨</p>}
                                      </div>
                                    )}
                                 </div>
                               );
                             })}
                          </div>
                       </div>
                    </div>

                    <div className="space-y-10">
                       <h5 className="text-xl font-black italic border-b-4 border-orange-500 pb-3 uppercase tracking-tighter">2. 상세 가이드 및 정보</h5>
                       
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <div className="flex justify-between px-2">
                               <p className="text-[11px] font-black text-gray-400 uppercase italic">서비스 상세 설명</p>
                               {isChanged('description', reviewingEbook.description) && <span className="text-[10px] font-black text-red-500 italic">EDITED</span>}
                             </div>
                             <div className={`p-10 rounded-[48px] border h-64 overflow-y-auto text-[15px] font-bold leading-relaxed no-scrollbar shadow-inner italic transition-all ${isChanged('description', reviewingEbook.description) ? 'border-red-400 bg-red-50/10 text-red-800' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                {reviewingEbook.description}
                             </div>
                          </div>

                          {/* 유형별 추가 정보 (목차 vs 제공방법) */}
                          {(reviewingEbook.storeType === 'ebook' || reviewingEbook.storeType === 'template') ? (
                             reviewingEbook.index && (
                                <div className="space-y-2">
                                   <div className="flex justify-between px-2">
                                      <p className="text-[11px] font-black text-blue-500 uppercase italic">전자책/템플릿 목차 구성</p>
                                      {isChanged('index', reviewingEbook.index) && <span className="text-[10px] font-black text-red-500 italic">EDITED</span>}
                                   </div>
                                   <div className={`p-8 rounded-[40px] border h-48 overflow-y-auto text-[14px] font-bold leading-relaxed no-scrollbar shadow-sm italic transition-all ${isChanged('index', reviewingEbook.index) ? 'border-red-400 bg-red-50/10 text-red-800' : 'bg-blue-50/30 border-blue-100 text-blue-900'}`}>
                                      {reviewingEbook.index}
                                   </div>
                                </div>
                             )
                          ) : (
                             reviewingEbook.serviceMethod && (
                                <div className="space-y-2">
                                   <div className="flex justify-between px-2">
                                      <p className="text-[11px] font-black text-orange-500 uppercase italic underline decoration-2 underline-offset-4">서비스 제공 방법 및 절차</p>
                                      {isChanged('serviceMethod', reviewingEbook.serviceMethod) && <span className="text-[10px] font-black text-red-500 italic">EDITED</span>}
                                   </div>
                                   <div className={`p-8 rounded-[40px] border h-48 overflow-y-auto text-[14px] font-bold leading-relaxed no-scrollbar shadow-sm italic transition-all ${isChanged('serviceMethod', reviewingEbook.serviceMethod) ? 'border-red-400 bg-red-50/10 text-red-800' : 'bg-orange-50/30 border-orange-100 text-orange-900'}`}>
                                      {reviewingEbook.serviceMethod}
                                   </div>
                                </div>
                             )
                          )}
                       </div>
                    </div>
                 </div>

                 {/* 섹션 2: 자주 묻는 질문 (FAQ) 검수 */}
                 <div className="space-y-10">
                    <div className="flex items-end gap-6 border-b-4 border-green-500 pb-3">
                       <h5 className="text-xl font-black italic uppercase tracking-tighter">3. 자주 묻는 질문 (FAQ) 구성</h5>
                       {isChanged('faqs', reviewingEbook.faqs) && <span className="text-[11px] font-black text-red-500 italic mb-1">FAQ DATA CHANGED ⚠</span>}
                    </div>
                    {(!reviewingEbook.faqs || reviewingEbook.faqs.length === 0) ? (
                       <p className="text-gray-300 font-bold italic text-center py-10 bg-gray-50 rounded-[32px]">등록된 FAQ가 없습니다.</p>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {reviewingEbook.faqs.map((faq, fidx) => (
                             <div key={fidx} className={`p-8 rounded-[40px] border-2 shadow-sm space-y-4 transition-all ${isChanged('faqs', reviewingEbook.faqs) ? 'border-red-200 bg-red-50/5' : 'bg-white border-gray-100'}`}>
                                <div className="flex items-start gap-4">
                                   <span className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0 text-sm italic">Q</span>
                                   <p className={`font-black text-[16px] ${isChanged('faqs', reviewingEbook.faqs) ? 'text-red-700' : 'text-gray-800'}`}>{faq.question}</p>
                                </div>
                                <div className="flex items-start gap-4 pt-4 border-t border-gray-50">
                                   <span className="bg-gray-200 text-gray-400 w-8 h-8 rounded-full flex items-center justify-center font-black shrink-0 text-sm italic">A</span>
                                   <p className={`font-bold text-[14px] italic ${isChanged('faqs', reviewingEbook.faqs) ? 'text-red-500' : 'text-gray-500'}`}>{faq.answer}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>

                 {/* 섹션 3: 비주얼 미디어 에셋 */}
                 <div className="space-y-10">
                    <div className="flex items-end gap-6 border-b-4 border-indigo-500 pb-3">
                       <h5 className="text-xl font-black italic uppercase tracking-tighter">4. 비주얼 미디어 에셋 (클릭 시 확대)</h5>
                       {isChanged('attachedImages', reviewingEbook.attachedImages) && <span className="text-[11px] font-black text-red-500 italic mb-1">GALLERY ASSETS CHANGED ⚠</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                       <div 
                        className={`relative aspect-square rounded-[40px] overflow-hidden border-8 shadow-2xl group cursor-zoom-in transition-all ${isChanged('thumbnail', reviewingEbook.thumbnail) ? 'border-red-500' : 'border-purple-500'}`}
                        onClick={() => setZoomImg(reviewingEbook.thumbnail)}
                       >
                          <img src={reviewingEbook.thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="t" />
                          <span className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-[9px] font-black px-3 py-1 rounded-full italic uppercase shadow-lg ${isChanged('thumbnail', reviewingEbook.thumbnail) ? 'bg-red-600' : 'bg-purple-600'}`}>
                             {isChanged('thumbnail', reviewingEbook.thumbnail) ? 'CHANGED THUMB' : 'THUMBNAIL'}
                          </span>
                       </div>
                       {reviewingEbook.attachedImages?.map((img, i) => {
                         const oldImgs = reviewingEbook.snapshot?.attachedImages || [];
                         const imgIsNew = !oldImgs.includes(img);
                         
                         return (
                           <div 
                            key={i} 
                            className={`relative aspect-square rounded-[40px] overflow-hidden border shadow-xl group cursor-zoom-in hover:scale-105 transition-all ${imgIsNew ? 'border-red-500 border-4' : 'border-gray-100'}`}
                            onClick={() => setZoomImg(img)}
                           >
                              <img src={img} className="w-full h-full object-cover" alt={`d-${i}`} />
                              <div className={`absolute bottom-4 left-4 text-white text-[8px] font-black px-2 py-0.5 rounded italic ${imgIsNew ? 'bg-red-600' : 'bg-black/50'}`}>
                                 {imgIsNew ? 'NEW ASSET' : `DETAIL #${i+1}`}
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 </div>

                 {/* 반려 모드 입력 섹션 */}
                 {showRejectModal && (
                    <div className="pt-20 border-t-8 border-rose-50 space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                       <div className="flex items-center gap-4">
                          <div className="w-4 h-4 bg-rose-500 rounded-full animate-ping"></div>
                          <h5 className="text-3xl font-black text-rose-500 italic tracking-tighter uppercase underline decoration-rose-200 underline-offset-8">반려 및 보완 요청 사유 입력</h5>
                       </div>
                       <textarea 
                         value={rejectionReason}
                         onChange={e => setRejectionReason(e.target.value)}
                         placeholder="전문가에게 전달될 보완 요청 사항을 상세히 기재하세요. (예: 썸네일 해상도 부족, 상세 설명 보충 필요 등)"
                         rows={5}
                         className="w-full p-10 bg-rose-50/30 border-none rounded-[48px] font-black text-xl text-rose-700 outline-none shadow-inner focus:ring-8 focus:ring-rose-100 transition-all no-scrollbar italic"
                       />
                       <div className="flex gap-4">
                          <button onClick={() => setShowRejectModal(false)} className="flex-1 py-6 bg-gray-100 text-gray-400 rounded-3xl font-black text-xl hover:bg-gray-200 transition-all italic">입력 취소</button>
                          <button onClick={handleReject} className="flex-[2] py-6 bg-rose-600 text-white rounded-3xl font-black text-xl shadow-2xl hover:bg-black transition-all italic uppercase tracking-widest">사유 발송 및 보완 요청 확정 ✉</button>
                       </div>
                    </div>
                 )}
              </div>

              {/* 하단 푸터 액션바 */}
              {!showRejectModal && (
                <div className="p-10 border-t border-gray-100 flex gap-6 bg-gray-50 shrink-0">
                   <button 
                     onClick={() => setShowRejectModal(true)}
                     className="flex-1 py-8 bg-rose-600 text-white rounded-[40px] font-black text-2xl shadow-xl hover:bg-black transition-all italic uppercase tracking-widest active:scale-95"
                   >
                      검토 반려 및 보완요청 ✕
                   </button>
                   <button 
                     onClick={() => handleApprove(reviewingEbook)}
                     className="flex-[2] py-8 bg-[#00B06B] text-white rounded-[40px] font-black text-2xl shadow-2xl hover:bg-black transition-all italic uppercase tracking-[0.3em] active:scale-[0.98]"
                   >
                      검토 완료 및 판매 최종 승인 ✅
                   </button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* --- 이미지 확대 라이트박스 --- */}
      {zoomImg && (
        <div 
          className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-md flex items-center justify-center p-10 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setZoomImg(null)}
        >
           <img src={zoomImg} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain animate-in zoom-in-95" alt="zoom" />
           <div className="absolute top-10 right-10 text-white font-black text-3xl">✕</div>
           <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50 font-bold italic">Click anywhere to close</p>
        </div>
      )}
    </div>
  );
};

export default StoreAdmin;
