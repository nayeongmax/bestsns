
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, EbookProduct, ChannelProduct, StoreOrder, Review, SMMOrder, ChannelOrder } from '@/types';

const formatKoreanDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return dateStr;
  }
};
import { deleteStoreProduct } from '../../storeDb';
import { useConfirm } from '@/contexts/ConfirmContext';

interface Props {
  user: UserProfile;
  members?: UserProfile[];
  ebooks: EbookProduct[];
  setEbooks: React.Dispatch<React.SetStateAction<EbookProduct[]>>;
  channels: ChannelProduct[];
  storeOrders: StoreOrder[];
  smmOrders?: SMMOrder[];
  channelOrders?: ChannelOrder[];
  onApplySeller: () => void;
  reviews: Review[];
  onUpdateReview: (updated: Review) => void;
}

type SellerTab = 'orders' | 'my-products' | 'ads';
type OrderCategory = 'sns' | 'channel' | 'store';

const SellerDashboard: React.FC<Props> = ({
  user, members = [], ebooks, setEbooks, channels, storeOrders, smmOrders = [], channelOrders = [],
  onApplySeller, reviews, onUpdateReview
}) => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useConfirm();
  const [activeTab, setActiveTab] = useState<SellerTab>('orders');
  const [activeOrderCategory, setActiveOrderCategory] = useState<OrderCategory>('store');
  const [orderFilter, setOrderFilter] = useState<'all' | 'trading' | 'done'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('전체');

  // 모달 상태
  const [showTaxModal, setShowTaxModal] = useState<StoreOrder | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isReplyEditing, setIsReplyEditing] = useState(false);
  const [replyInput, setReplyInput] = useState('');

  const isAdmin = user.role === 'admin';
  const isApproved = user.sellerStatus === 'approved';

  // 어드민이 아닌 판매자는 스토어 판매만 볼 수 있음
  const effectiveOrderCategory = (!isAdmin && activeOrderCategory !== 'store') ? 'store' : activeOrderCategory;

  const actualStoreOrders = useMemo(() => storeOrders.filter(o => o.sellerNickname === user.nickname), [storeOrders, user.nickname]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    if (effectiveOrderCategory === 'sns') {
      smmOrders.forEach(o => months.add(o.orderTime.substring(0, 7)));
    } else if (effectiveOrderCategory === 'channel') {
      channelOrders.forEach(o => months.add(o.orderTime.substring(0, 7)));
    } else {
      actualStoreOrders.forEach(o => months.add(o.orderTime.substring(0, 7).replace('.', '-')));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [effectiveOrderCategory, smmOrders, channelOrders, actualStoreOrders]);

  const filteredStoreOrders = useMemo(() => {
    let combined = [...actualStoreOrders];
    if (monthFilter !== '전체') {
      combined = combined.filter(o => o.orderTime.startsWith(monthFilter.replace('-', '.')));
    }
    if (orderFilter === 'trading') combined = combined.filter(o => o.status !== '구매확정' && o.status !== '취소');
    else if (orderFilter === 'done') combined = combined.filter(o => o.status === '구매확정');
    return combined.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [actualStoreOrders, orderFilter, monthFilter]);

  // 어드민 전용: SNS 주문 필터링
  const filteredSmmOrders = useMemo(() => {
    if (!isAdmin) return [];
    let list = [...smmOrders];
    if (monthFilter !== '전체') {
      list = list.filter(o => o.orderTime.startsWith(monthFilter));
    }
    if (orderFilter === 'trading') list = list.filter(o => o.status !== '완료' && o.status !== '주문취소');
    else if (orderFilter === 'done') list = list.filter(o => o.status === '완료');
    return list.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [isAdmin, smmOrders, orderFilter, monthFilter]);

  // 어드민 전용: 채널 주문 필터링
  const filteredChannelOrders = useMemo(() => {
    if (!isAdmin) return [];
    let list = [...channelOrders];
    if (monthFilter !== '전체') {
      list = list.filter(o => o.orderTime.startsWith(monthFilter));
    }
    if (orderFilter === 'trading') list = list.filter(o => o.status !== '구매확정' && o.status !== '취소' && o.status !== 'refunded');
    else if (orderFilter === 'done') list = list.filter(o => o.status === '구매확정');
    return list.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [isAdmin, channelOrders, orderFilter, monthFilter]);

  // 내 판매 상품 필터링 (승인 대기 중 포함)
  const myProducts = useMemo(() => {
    return ebooks.filter(e => e.authorId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ebooks, user.id]);

  const stats = useMemo(() => {
    const myProductCount = myProducts.length;
    const myProductIds = myProducts.map(e => e.id);
    const myReviews = reviews.filter(r => myProductIds.includes(r.productId));
    const totalReviewScore = myReviews.reduce((acc, curr) => acc + curr.rating, 0);
    const totalReviewCount = myReviews.length;
    const avgRating = totalReviewCount > 0 ? (totalReviewScore / totalReviewCount).toFixed(1) : "0.0";
    const confirmedOrders = actualStoreOrders.filter(o => o.status === '구매확정');
    const annualRevenue = confirmedOrders.reduce((acc, curr) => acc + curr.price, 0);
    const activeOrders = filteredStoreOrders.filter(o => o.status !== '구매확정').length;
    return { annualRevenue, activeOrders, productCount: myProductCount, avgRating };
  }, [filteredStoreOrders, myProducts, actualStoreOrders, reviews]);

  const handleReviewManage = (order: StoreOrder) => {
    if (!order.reviewId) return;
    const review = reviews.find(r => r.id === order.reviewId);
    if (review) {
      setSelectedReview(review);
      setReplyInput(review.reply || '');
      setIsReplyEditing(!review.reply);
    }
  };

  // 상품 상태별 라벨 반환 헬퍼
  const getProductStatusLabel = (eb: EbookProduct) => {
    if (eb.status === 'pending' || eb.status === 'revision') return { label: '승인중', color: 'bg-blue-50 text-blue-500' };
    if (eb.isPaused) return { label: '일시중지', color: 'bg-gray-100 text-gray-400' };
    return { label: '판매중', color: 'bg-[#00B06B]/10 text-[#00B06B]' };
  };

  // 미승인 판매자: 첫 화면 잠금 → 판매자 등록 버튼으로 전문가 정보 작성·승인 유도
  if (!isApproved && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 bg-gradient-to-b from-gray-50 to-white rounded-[48px] border-2 border-dashed border-gray-200 animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-5xl mb-8">🔒</div>
        <h3 className="text-2xl font-black text-gray-900 italic tracking-tighter text-center mb-3">판매자 워크스페이스</h3>
        <p className="text-gray-500 font-bold text-center mb-10 max-w-md">판매자 등록을 완료한 후 이용할 수 있습니다.<br/>전문가 정보를 작성하고 운영자 승인을 받아 주세요.</p>
        <button
          type="button"
          onClick={() => {
            showAlert({
              title: '판매자 등록',
              description: '전문가 정보에서 수익화할 내용을 작성하고, 운영자 승인을 받아야 합니다.',
              onClose: () => onApplySeller(),
            });
          }}
          className="px-14 py-5 bg-blue-600 text-white rounded-[32px] font-black text-lg shadow-xl hover:bg-black transition-all italic uppercase tracking-widest"
        >
          판매자 등록
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        <div onClick={() => navigate('/profit-mgmt')} className="col-span-1 md:col-span-1 bg-gray-900 p-4 sm:p-8 rounded-[20px] sm:rounded-[40px] shadow-xl text-white relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all">
          <p className="text-[9px] sm:text-[10px] font-black text-orange-400 uppercase tracking-widest italic mb-1 relative z-10">누적 수익금 (구매확정 기준)</p>
          <h4 className="text-sm sm:text-4xl font-black italic tracking-tighter relative z-10 truncate">₩{stats.annualRevenue.toLocaleString()}</h4>
          <div className="absolute top-0 right-0 p-6 opacity-10"><svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg></div>
        </div>
        <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[40px] shadow-sm border border-gray-100 space-y-1"><p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest italic">진행 중인 주문</p><h4 className="text-xl sm:text-3xl font-black text-gray-900 italic tracking-tighter">{stats.activeOrders} <span className="text-xs sm:text-sm font-bold text-gray-300">건</span></h4></div>
        <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[40px] shadow-sm border border-gray-100 space-y-1"><p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest italic">내 등록 상품</p><h4 className="text-xl sm:text-3xl font-black text-gray-900 italic tracking-tighter">{stats.productCount} <span className="text-xs sm:text-sm font-bold text-gray-300">개</span></h4></div>
        <div className="bg-white p-4 sm:p-8 rounded-[20px] sm:rounded-[40px] shadow-sm border border-gray-100 space-y-1">
           <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest italic">전문가 만족도</p>
           <div className="flex items-center gap-2">
              <h4 className="text-xl sm:text-3xl font-black text-gray-900 italic tracking-tighter">{stats.avgRating}</h4>
              <div className="flex text-yellow-400 text-sm">
                {Array.from({length: 5}).map((_, i) => (
                  <span key={i}>{i < Math.floor(Number(stats.avgRating)) ? '★' : '☆'}</span>
                ))}
              </div>
           </div>
        </div>
      </div>

      <div className="flex p-2 bg-gray-100/50 rounded-[32px] w-full shadow-inner">
        {[ 
          { id: 'orders', label: '📊 실시간 판매 현황', icon: '📝' }, 
          { id: 'my-products', label: '📦 내 판매 상품 관리', icon: '💎' }, 
          { id: 'ads', label: '🚀 광고/노출 신청', icon: '⚡' } 
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-2.5 sm:py-5 rounded-[18px] sm:rounded-[24px] text-[11px] sm:text-[14px] md:text-[16px] font-black transition-all leading-snug ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400 hover:text-gray-900'}`}>{tab.label}</button>
        ))}
      </div>

      <main>
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[48px] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner">💰</div>
                  <div>
                    <h5 className="font-black text-gray-900 italic tracking-tighter text-lg">수익 및 정산 통합 리포트</h5>
                    <p className="text-[12px] font-bold text-gray-400 italic uppercase">Revenue & Settlement Integration Report</p>
                  </div>
               </div>
               <button onClick={() => navigate('/profit-mgmt')} className="bg-blue-600 text-white px-8 py-3.5 rounded-[20px] font-black text-[13px] shadow-xl hover:bg-black transition-all italic uppercase tracking-widest">수익 분석 및 정산 관리 ↗</button>
            </div>

            <div className="flex flex-col gap-3 px-2 sm:px-4">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm gap-1 shrink-0">
                  {isAdmin && <button onClick={() => setActiveOrderCategory('sns')} className={`px-3 sm:px-5 py-2 rounded-lg text-[12px] font-black transition-all whitespace-nowrap ${effectiveOrderCategory === 'sns' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>SNS 판매</button>}
                  {isAdmin && <button onClick={() => setActiveOrderCategory('channel')} className={`px-3 sm:px-5 py-2 rounded-lg text-[12px] font-black transition-all whitespace-nowrap ${effectiveOrderCategory === 'channel' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>채널 판매</button>}
                  <button onClick={() => setActiveOrderCategory('store')} className={`px-3 sm:px-5 py-2 rounded-lg text-[12px] font-black transition-all whitespace-nowrap ${effectiveOrderCategory === 'store' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>스토어 판매</button>
                </div>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-3 sm:px-5 py-2 rounded-xl text-[12px] font-black bg-white border border-gray-100 outline-none shadow-sm cursor-pointer shrink-0">
                  <option>전체</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
                <div className="flex gap-1 shrink-0">
                  {['all', 'trading', 'done'].map((f) => (
                    <button key={f} onClick={() => setOrderFilter(f as any)} className={`px-3 sm:px-5 py-2 rounded-xl text-[12px] font-black transition-all border whitespace-nowrap ${orderFilter === f ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{f === 'all' ? '전체내역' : f === 'trading' ? '거래중' : '거래완료'}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-gray-50/50 text-[11px] font-black text-gray-400 uppercase border-b border-gray-100 italic">
                  <tr>
                    <th className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 w-[35%] whitespace-nowrap">주문 상품 / 구매자</th>
                    <th className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center whitespace-nowrap">주문 / 확정 일시</th>
                    <th className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-right whitespace-nowrap">금액</th>
                    <th className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center whitespace-nowrap">상태</th>
                    <th className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* SNS 판매 탭 (어드민 전용) */}
                  {effectiveOrderCategory === 'sns' && (
                    filteredSmmOrders.length === 0 ? (
                      <tr><td colSpan={5} className="py-40 text-center text-gray-300 font-black italic text-xl">조회된 SNS 판매 내역이 없습니다.</td></tr>
                    ) : filteredSmmOrders.map(order => {
                      const isCancelled = order.status === '주문취소';
                      return (
                        <tr key={order.id} className={`transition-colors group ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : 'hover:bg-blue-50/10'}`}>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8">
                            <div className="flex items-center gap-3 sm:gap-5">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0">📈</div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-blue-600 uppercase italic mb-0.5 tracking-tighter">#{order.id}</p>
                                <p className="text-[13px] font-black text-gray-900 truncate mb-0.5 italic">[{order.platform}] {order.productName}</p>
                                <span className="text-[11px] text-gray-400 font-bold">구매자: @{order.userNickname}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <p className="text-[11px] font-bold text-gray-400 whitespace-nowrap">주문: {formatKoreanDateTime(order.orderTime)}</p>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-right">
                            <p className="text-base sm:text-lg font-black text-gray-900 italic whitespace-nowrap">₩{order.sellingPrice.toLocaleString()}</p>
                            <p className="text-[10px] text-green-500 font-bold whitespace-nowrap">수익 ₩{order.profit.toLocaleString()}</p>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black italic shadow-sm transition-all whitespace-nowrap ${
                              order.status === '완료' ? 'bg-[#00B06B] text-white shadow-lg shadow-green-100'
                              : order.status === '처리중' ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'
                            }`}>{order.status}</span>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center"><span className="text-[11px] text-gray-300 font-bold italic">-</span></td>
                        </tr>
                      );
                    })
                  )}

                  {/* 채널 판매 탭 (어드민 전용) */}
                  {effectiveOrderCategory === 'channel' && (
                    filteredChannelOrders.length === 0 ? (
                      <tr><td colSpan={5} className="py-40 text-center text-gray-300 font-black italic text-xl">조회된 채널 판매 내역이 없습니다.</td></tr>
                    ) : filteredChannelOrders.map(order => {
                      const isCancelled = order.status === '취소' || order.status === 'refunded';
                      return (
                        <tr key={order.id} className={`transition-colors group ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : 'hover:bg-blue-50/10'}`}>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8">
                            <div className="flex items-center gap-3 sm:gap-5">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0">📺</div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-blue-600 uppercase italic mb-0.5 tracking-tighter">#{order.id}</p>
                                <p className="text-[13px] font-black text-gray-900 truncate mb-0.5 italic">{order.productName}</p>
                                <span className="text-[11px] text-gray-400 font-bold">구매자: @{order.userNickname}</span>
                                {order.buyerAccount && <span className="ml-1 text-[11px] text-blue-500 font-bold">({order.buyerAccount})</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <p className="text-[11px] font-bold text-gray-400 whitespace-nowrap">주문: {formatKoreanDateTime(order.orderTime)}</p>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-right">
                            <p className="text-base sm:text-lg font-black text-gray-900 italic whitespace-nowrap">₩{order.price.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-300 font-bold uppercase">{order.platform}</p>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black italic shadow-sm transition-all whitespace-nowrap ${
                              order.status === '구매확정' ? 'bg-[#00B06B] text-white shadow-lg shadow-green-100'
                              : order.status === '결제완료' ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'
                            }`}>{order.status}</span>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center"><span className="text-[11px] text-gray-300 font-bold italic">-</span></td>
                        </tr>
                      );
                    })
                  )}

                  {/* 스토어 판매 탭 */}
                  {effectiveOrderCategory === 'store' && (
                    filteredStoreOrders.length === 0 ? (
                      <tr><td colSpan={5} className="py-40 text-center text-gray-300 font-black italic text-xl">조회된 판매 내역이 없습니다.</td></tr>
                    ) : filteredStoreOrders.map(order => {
                      const isCancelled = order.status === '취소';
                      const isCashPayment = order.paymentMethod === 'TRANSFER' || order.paymentMethod === 'VIRTUAL_ACCOUNT';
                      const showTaxBtn = !isCancelled && isCashPayment;
                      return (
                        <tr key={order.id} className={`transition-colors group ${isCancelled ? 'opacity-50 grayscale bg-gray-50' : 'hover:bg-blue-50/10'}`}>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8">
                            <div className="flex items-center gap-3 sm:gap-5">
                              <img src={`https://picsum.photos/seed/${order.productId}/200/200`} className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl object-cover shadow-sm shrink-0" alt="p" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-blue-600 uppercase italic mb-0.5 tracking-tighter">#{order.id}</p>
                                <p className="text-[13px] font-black text-gray-900 truncate mb-0.5 italic">{order.productName}</p>
                                <span className="text-[11px] text-gray-400 font-bold">구매자: @{order.userNickname}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-gray-400 whitespace-nowrap">주문: {formatKoreanDateTime(order.orderTime)}</p>
                              {order.confirmedAt && <p className="text-[11px] font-black text-blue-500 whitespace-nowrap">확정: {formatKoreanDateTime(order.confirmedAt)}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-right"><p className="text-base sm:text-lg font-black text-gray-900 italic whitespace-nowrap">₩{order.price.toLocaleString()}</p><p className="text-[10px] text-gray-300 font-bold uppercase">{order.tierName}</p></td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black italic shadow-sm transition-all whitespace-nowrap ${
                              order.status === '구매확정'
                              ? 'bg-[#00B06B] text-white shadow-lg shadow-green-100'
                              : order.status === '작업중' ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 sm:px-8 sm:py-6 md:px-10 md:py-8 text-center">
                            <div className="flex flex-col gap-1.5 items-center">
                              {showTaxBtn && <button onClick={() => setShowTaxModal(order)} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-xl font-black text-[11px] hover:bg-black hover:text-white transition-all shadow-sm whitespace-nowrap">세금계산서</button>}
                              {order.reviewId && <button onClick={() => handleReviewManage(order)} className="px-3 py-1.5 bg-black text-white rounded-xl font-black text-[11px] shadow-lg hover:bg-blue-600 transition-all whitespace-nowrap">리뷰관리</button>}
                              {(() => {
                                const buyer = members.find(m => m.nickname === order.userNickname);
                                if (!buyer || buyer.id === user.id) return null;
                                return (
                                  <button
                                    onClick={() => navigate('/chat', { state: { targetUser: { id: buyer.id, nickname: buyer.nickname, profileImage: buyer.profileImage } } })}
                                    className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-[11px] hover:bg-emerald-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
                                  >
                                    💬 구매자 채팅
                                  </button>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'my-products' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-1">
              <div>
                <h3 className="text-xl sm:text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">내 서비스 인벤토리</h3>
                <p className="text-[11px] font-bold text-gray-400 mt-1 sm:mt-4 uppercase tracking-widest">등록된 상품 내역 ({myProducts.length}개)</p>
              </div>
              <button
                onClick={() => navigate('/ebooks/register')}
                className="bg-blue-600 text-white px-5 py-3 sm:px-10 sm:py-5 rounded-[20px] sm:rounded-[28px] font-black text-sm sm:text-lg shadow-2xl hover:bg-black transition-all italic uppercase tracking-widest active:scale-95 shrink-0 self-start sm:self-auto"
              >
                + 신규 서비스 등록 🚀
              </button>
            </div>

            {/* 모바일: 리스트형 */}
            <div className="lg:hidden space-y-2 sm:space-y-3">
              {myProducts.length === 0 ? (
                <div className="py-20 bg-white rounded-[32px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
                   <span className="text-5xl mb-4 grayscale opacity-30">📦</span>
                   <p className="text-gray-300 font-black italic text-lg uppercase tracking-widest">등록된 서비스가 없습니다.</p>
                </div>
              ) : myProducts.map(eb => {
                const status = getProductStatusLabel(eb);
                return (
                  <div key={eb.id} className={`bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border transition-all flex items-stretch min-h-[96px] ${eb.isPaused ? 'border-gray-200 opacity-70' : 'border-gray-100 hover:border-blue-200'}`}>
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 self-center ml-3 my-3 rounded-xl overflow-hidden bg-gray-100">
                      <img src={eb.thumbnail} className="w-full h-full object-cover" alt="" />
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase shadow-sm ${status.color}`}>{status.label}</span>
                      </div>
                      {eb.isPaused && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-[8px] font-black italic">일시정지</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[9px] font-black text-blue-500 uppercase italic">{eb.storeType}</span>
                          <span className="text-[9px] text-gray-300 font-bold">ID: {eb.id.slice(-6)}</span>
                          {eb.status === 'revision' && <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[8px] font-black italic animate-bounce">보완요청</span>}
                        </div>
                        <h4 className="text-sm font-black text-gray-900 line-clamp-2 leading-snug italic">{eb.title}</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">등록일: {eb.createdAt.split('T')[0]}</p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <p className="text-base font-black text-gray-900 italic tracking-tighter">₩{eb.price.toLocaleString()}</p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => navigate('/ebooks/register', { state: { ebook: eb } })} className="py-1.5 px-3 bg-gray-900 text-white rounded-xl font-black text-[10px] hover:bg-blue-600 transition-all">수정하기</button>
                          <button onClick={() => setEbooks(prev => prev.map(item => item.id === eb.id ? { ...item, isPaused: !item.isPaused } : item))} className={`py-1.5 px-3 rounded-xl font-black text-[10px] text-white transition-all ${eb.isPaused ? 'bg-green-500' : 'bg-orange-500'}`}>{eb.isPaused ? '판매재개' : '일시정지'}</button>
                          <button onClick={() => { showConfirm({ title: '상품 삭제', description: '정말 이 상품을 영구 삭제하시겠습니까?', dangerLine: '등록된 주문·리뷰 데이터에 영향을 줄 수 있으며, 삭제 후에는 복구할 수 없습니다.', confirmLabel: '삭제하기', cancelLabel: '취소', danger: true, onConfirm: async () => { try { await deleteStoreProduct(eb.id); setEbooks(prev => prev.filter(item => item.id !== eb.id)); showAlert({ description: '상품이 삭제되었습니다.' }); } catch (e) { console.error(e); showAlert({ description: '삭제에 실패했습니다. 다시 시도해 주세요.' }); } }, }); }} className="py-1.5 px-2 text-gray-300 hover:text-red-500 text-[11px] font-black transition-colors">✕</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크톱: 카드 그리드 */}
            <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-8">
              {myProducts.length === 0 ? (
                <div className="col-span-full py-40 bg-white rounded-[60px] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center">
                   <span className="text-6xl mb-6 grayscale opacity-30">📦</span>
                   <p className="text-gray-300 font-black italic text-xl uppercase tracking-widest">등록된 서비스가 없습니다.</p>
                </div>
              ) : myProducts.map(eb => {
                const status = getProductStatusLabel(eb);
                return (
                  <div key={eb.id} className={`bg-white rounded-[40px] overflow-hidden shadow-sm border-2 transition-all group relative ${eb.isPaused ? 'grayscale border-gray-200 bg-gray-50' : 'border-gray-100 hover:border-blue-200'}`}>
                    <div className="relative aspect-video overflow-hidden bg-gray-100">
                      <img src={eb.thumbnail} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" alt="t" />
                      <div className="absolute top-4 left-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic uppercase shadow-md ${status.color} border border-white/20`}>{status.label}</span>
                      </div>
                      {eb.isPaused && (
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                            <span className="text-white text-sm font-black italic border-2 border-white px-4 py-1 rotate-[-12deg] shadow-2xl uppercase">일시정지 중</span>
                         </div>
                      )}
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">{eb.storeType}</span>
                          <span className="text-[9px] text-gray-300 font-bold uppercase">ID: {eb.id.slice(-6)}</span>
                        </div>
                        <h4 className="text-lg font-black text-gray-900 truncate leading-tight italic">{eb.title}</h4>
                        <p className="text-[11px] font-bold text-gray-400 italic">등록일: {eb.createdAt.split('T')[0]}</p>
                      </div>
                      <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                        <div className="space-y-1">
                           <span className="text-[9px] font-black text-gray-300 uppercase italic tracking-widest">Base Price</span>
                           <p className="text-2xl font-black text-gray-900 italic tracking-tighter">₩{eb.price.toLocaleString()}</p>
                        </div>
                        {eb.status === 'revision' && (
                           <span className="bg-red-50 text-red-500 px-2.5 py-1 rounded-lg text-[9px] font-black italic shadow-sm animate-bounce">보완요청</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => navigate('/ebooks/register', { state: { ebook: eb } })} className="py-3.5 bg-gray-900 text-white rounded-2xl font-black text-[11px] hover:bg-blue-600 transition-all shadow-sm italic uppercase tracking-tighter">수정하기</button>
                          <button onClick={() => setEbooks(prev => prev.map(item => item.id === eb.id ? { ...item, isPaused: !item.isPaused } : item))} className={`py-3.5 rounded-2xl font-black text-[11px] text-white shadow-sm transition-all italic uppercase tracking-tighter ${eb.isPaused ? 'bg-green-500' : 'bg-orange-500'}`}>{eb.isPaused ? '판매재개' : '일시정지'}</button>
                        </div>
                        <button onClick={() => { showConfirm({ title: '상품 삭제', description: '정말 이 상품을 영구 삭제하시겠습니까?', dangerLine: '등록된 주문·리뷰 데이터에 영향을 줄 수 있으며, 삭제 후에는 복구할 수 없습니다.', confirmLabel: '삭제하기', cancelLabel: '취소', danger: true, onConfirm: async () => { try { await deleteStoreProduct(eb.id); setEbooks(prev => prev.filter(item => item.id !== eb.id)); showAlert({ description: '상품이 삭제되었습니다.' }); } catch (e) { console.error(e); showAlert({ description: '삭제에 실패했습니다. 다시 시도해 주세요.' }); } }, }); }} className="w-full py-2.5 text-gray-300 hover:text-red-500 text-[10px] font-black uppercase italic transition-colors">상품 영구 삭제 ✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="max-w-xl mx-auto py-4 text-center animate-in fade-in duration-700">
            <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-sm border border-gray-100 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600"></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-[24px] flex items-center justify-center text-4xl mx-auto shadow-inner border border-gray-100 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                🚧
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 italic tracking-tighter uppercase">
                  광고<span className="text-blue-600">/노출</span> 신청
                </h2>
                <div className="h-0.5 w-16 bg-blue-600 mx-auto rounded-full"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-gray-800">
                  광고 및 상단 노출 서비스 오픈 준비중
                </h3>
                <p className="text-sm font-bold text-gray-400 italic leading-relaxed">
                  전문가님의 상품을 더 많은 고객에게 노출시키기 위한<br/>
                  최적의 광고 시스템 고도화 작업이 진행 중입니다.
                </p>
              </div>
              <div className="bg-blue-50/50 p-4 rounded-[20px] border border-blue-100">
                <p className="text-blue-600 font-black text-sm sm:text-base italic animate-pulse">
                  " 빠른 시일내에 돌아오겠습니다 "
                </p>
              </div>
              <button
                onClick={() => setActiveTab('orders')}
                className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-sm hover:bg-blue-600 transition-all shadow-lg active:scale-95 italic uppercase tracking-wider"
              >
                판매현황으로 돌아가기
              </button>
            </div>
            <p className="mt-6 text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em] italic">
              BESTSNS ADVERTISING & EXPOSURE PLATFORM
            </p>
          </div>
        )}
      </main>

      {/* 모달: 세금계산서 정보 */}
      {showTaxModal && (() => {
        let taxInfo: Record<string, string> = {};
        if (showTaxModal.buyerTaxInfo) {
          try { taxInfo = JSON.parse(showTaxModal.buyerTaxInfo); } catch { /* ignore */ }
        }
        const rows: [string, string][] = [
          ['회사명(법인명)', taxInfo.companyName || '-'],
          ['사업자 등록번호', taxInfo.businessNumber || '-'],
          ['대표자명', taxInfo.ceoName || '-'],
          ['사업장 주소', taxInfo.address || '-'],
          ['업태', taxInfo.businessType || '-'],
          ['종목', taxInfo.businessCategory || '-'],
          ['세금계산서 이메일', taxInfo.email || '-'],
          ['담당자명', taxInfo.managerName || '-'],
          ['담당자 연락처', taxInfo.managerPhone || '-'],
        ];
        return (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-xl rounded-[56px] p-12 shadow-2xl space-y-8 animate-in zoom-in-95 border-8 border-orange-50">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-orange-500 underline-offset-8 px-2">Tax Invoice Details</h4>
                 <button onClick={() => setShowTaxModal(null)} className="text-gray-300 hover:text-gray-900 font-black text-2xl">✕</button>
              </div>

              {!showTaxModal.buyerTaxInfo ? (
                <div className="py-10 text-center text-gray-400 font-bold">구매자가 입력한 세금계산서 정보가 없습니다.</div>
              ) : (
              <div className="border border-gray-200 rounded-[24px] overflow-hidden shadow-sm bg-white">
                 <table className="w-full text-sm text-left border-collapse">
                    <tbody className="divide-y divide-gray-200">
                       {rows.map(([label, value]) => (
                         <tr key={label}>
                           <td className="w-1/3 bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">{label}</td>
                           <td className="px-6 py-4 font-bold text-gray-900">{value}</td>
                         </tr>
                       ))}
                       <tr className="bg-orange-50/30">
                          <td className="bg-orange-50 px-6 py-4 font-black text-orange-700 italic border-r">신청 금액</td>
                          <td className="px-6 py-4 font-black text-blue-600 text-lg">₩{showTaxModal.price.toLocaleString()}원 (VAT 포함)</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
              )}

              <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 space-y-3">
                 <div className="flex items-center gap-2 text-blue-600 font-black italic text-[13px]">
                    <span>TIP</span>
                    <div className="h-1 flex-1 border-b border-dashed border-blue-200"></div>
                 </div>
                 <ul className="text-[12px] text-blue-700 font-bold space-y-2 opacity-80 leading-relaxed italic">
                    <li>• 의뢰인에게 세금계산서 발행 시, '세금계산서 신청 금액'에 맞게 발행해 주세요.</li>
                    <li>※ 의뢰인의 쿠폰 사용금액은 제외됩니다.</li>
                    <li>• 세금계산서 발행 및 매출 신고에 대한 자세한 내용은 <span className="underline cursor-pointer">FAQ를 참고해 주세요.</span></li>
                 </ul>
              </div>

              <button onClick={() => setShowTaxModal(null)} className="w-full py-6 bg-gray-900 text-white rounded-[24px] font-black text-xl hover:bg-orange-600 transition-all shadow-xl italic uppercase">정보 확인 완료</button>
           </div>
        </div>
        );
      })()}

      {/* 모달: 리뷰 관리 (리뷰관리 버튼 클릭 시 노출) */}
      {selectedReview && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[64px] p-12 shadow-2xl space-y-10 animate-in zoom-in-95 relative border-4 border-orange-50 overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="flex justify-between items-center"><h4 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 px-2">Review Management</h4><button onClick={() => setSelectedReview(null)} className="text-gray-300 hover:text-gray-900 font-black text-2xl transition-colors">✕</button></div>
              <div className="space-y-10">
                 <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 relative shadow-inner">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-4">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedReview.userId}`} className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm" alt="p" />
                          <div><p className="font-black text-gray-900 text-[18px]">@{selectedReview.author}</p><div className="flex text-yellow-400 text-sm">{Array.from({length: 5}).map((_, i) => (
                             <span key={i} className={i < selectedReview.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                          ))}</div></div>
                       </div>
                       <span className="text-[11px] font-bold text-gray-300 italic uppercase bg-white px-3 py-1 rounded-full">{selectedReview.date}</span>
                    </div>
                    <p className="text-[17px] font-bold text-gray-600 leading-relaxed italic">"{selectedReview.content}"</p>
                 </div>
                 <div className="space-y-6">
                    <div className="flex justify-between items-center px-4">
                       <h5 className="text-[13px] font-black text-blue-600 italic uppercase tracking-widest flex items-center gap-2">전문가 공식 답글</h5>
                       {!isReplyEditing && selectedReview.reply && (<button onClick={() => { setIsReplyEditing(true); setReplyInput(selectedReview.reply || ''); }} className="text-[11px] font-black text-gray-400 hover:text-blue-600 italic underline underline-offset-2">답글 수정 ✎</button>)}
                    </div>
                    {isReplyEditing ? (
                       <div className="space-y-4">
                          <textarea value={replyInput} onChange={e => setReplyInput(e.target.value)} placeholder="감사의 메시지를 남겨보세요!" rows={5} className="w-full p-8 bg-white border-4 border-blue-100 rounded-[32px] font-bold text-gray-700 outline-none shadow-inner resize-none focus:border-blue-500 transition-all" />
                          <div className="flex gap-3"><button onClick={() => setIsReplyEditing(false)} className="flex-1 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black italic">취소</button><button onClick={() => { onUpdateReview({...selectedReview, reply: replyInput, replyDate: new Date().toLocaleDateString()}); setSelectedReview({...selectedReview, reply: replyInput}); setIsReplyEditing(false); }} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black italic shadow-lg hover:bg-black transition-all">답글 저장</button></div>
                       </div>
                    ) : (
                       <div className="bg-blue-50/50 p-10 rounded-[48px] border-2 border-blue-100 shadow-inner italic">
                          {selectedReview.reply ? (<p className="text-[16.5px] font-black text-blue-800 leading-relaxed">"{selectedReview.reply}"</p>) : (<p className="text-gray-400 font-bold text-center py-6">등록된 답글이 없습니다.</p>)}
                       </div>
                    )}
                 </div>
              </div>
              {!isReplyEditing && (<button onClick={() => setSelectedReview(null)} className="w-full py-6 bg-gray-900 text-white rounded-[24px] font-black text-lg hover:bg-blue-600 transition-all shadow-xl italic uppercase">닫기</button>)}
           </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
