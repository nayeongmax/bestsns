
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, EbookProduct, ChannelProduct, StoreOrder, Review, SMMOrder, ChannelOrder } from '../../types';

interface Props {
  user: UserProfile;
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
  user, ebooks, setEbooks, channels, storeOrders, smmOrders = [], channelOrders = [], 
  onApplySeller, reviews, onUpdateReview 
}) => {
  const navigate = useNavigate();
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

  // --- 오늘 날짜 기준 샘플 데이터 생성 ---
  const getRecentDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const sampleStoreOrders: StoreOrder[] = useMemo(() => [
    { id: 'SAMP-2026-001', userId: 'user1', userNickname: '성공한CEO', sellerNickname: user.nickname, orderTime: getRecentDate(4), confirmedAt: getRecentDate(3), productId: 'p1', productName: '인스타그램 바이럴 마케팅 풀패키지', tierName: 'MASTER', price: 1200000, storeType: 'marketing', status: '구매확정', reviewId: 'rev_sample_1' },
    { id: 'SAMP-2026-002', userId: 'user2', userNickname: '꿈꾸는청년', sellerNickname: user.nickname, orderTime: getRecentDate(2), productId: 'p2', productName: '수익형 유튜브 채널 구축 가이드', tierName: 'STANDARD', price: 150000, storeType: 'ebook', status: '결제완료' },
    { id: 'SAMP-2026-003', userId: 'user3', userNickname: '엔잡러A', sellerNickname: user.nickname, orderTime: getRecentDate(1), confirmedAt: getRecentDate(0), productId: 'p3', productName: '네이버 블로그 상위노출 컨설팅', tierName: 'LITE', price: 300000, storeType: 'consulting', status: '구매확정' },
    { id: 'SAMP-2026-004', userId: 'user4', userNickname: '스타트업B', sellerNickname: user.nickname, orderTime: getRecentDate(10), confirmedAt: getRecentDate(8), productId: 'p4', productName: '틱톡 숏폼 제작 대행 10회', tierName: 'MASTER', price: 2500000, storeType: 'marketing', status: '구매확정' },
    { id: 'W-SAMP-2026-001', userId: 'user5', userNickname: '성장하는중', sellerNickname: user.nickname, orderTime: getRecentDate(15), confirmedAt: getRecentDate(14), productId: 'p5', productName: '검색 엔진 최적화(SEO) 기초 세트', tierName: 'BASIC', price: 500000, storeType: 'marketing', status: '구매확정' },
  ], [user.nickname]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const orders = storeOrders.length > 0 ? storeOrders : sampleStoreOrders;
    orders.forEach(o => months.add(o.orderTime.substring(0, 7).replace('.', '-')));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [storeOrders, sampleStoreOrders]);

  const filteredStoreOrders = useMemo(() => {
    const actualOrders = storeOrders.filter(o => o.sellerNickname === user.nickname);
    let combined = actualOrders.length > 0 ? [...actualOrders] : [...sampleStoreOrders];
    
    if (monthFilter !== '전체') {
      combined = combined.filter(o => o.orderTime.startsWith(monthFilter.replace('-', '.')));
    }
    if (orderFilter === 'trading') combined = combined.filter(o => o.status !== '구매확정' && o.status !== '취소');
    else if (orderFilter === 'done') combined = combined.filter(o => o.status === '구매확정');
    
    return combined.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [storeOrders, user.nickname, orderFilter, monthFilter, sampleStoreOrders]);

  // 내 판매 상품 필터링 (승인 대기 중 포함)
  const myProducts = useMemo(() => {
    return ebooks.filter(e => e.authorId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ebooks, user.id]);

  const stats = useMemo(() => {
    const myProductCount = myProducts.length;
    const myProductIds = myProducts.map(e => e.id);
    
    const myReviews = reviews.filter(r => myProductIds.includes(r.productId));
    const hasSampleReview = filteredStoreOrders.some(o => o.reviewId === 'rev_sample_1');
    const totalReviewScore = myReviews.reduce((acc, curr) => acc + curr.rating, 0) + (hasSampleReview ? 5 : 0);
    const totalReviewCount = myReviews.length + (hasSampleReview ? 1 : 0);
    const avgRating = totalReviewCount > 0 ? (totalReviewScore / totalReviewCount).toFixed(1) : "0.0";

    const actualOrders = storeOrders.filter(o => o.sellerNickname === user.nickname && o.status === '구매확정');
    const displayOrders = actualOrders.length > 0 ? actualOrders : sampleStoreOrders.filter(o => o.status === '구매확정');
    const annualRevenue = displayOrders.reduce((acc, curr) => acc + curr.price, 0);
    const activeOrders = filteredStoreOrders.filter(o => o.status !== '구매확정').length;

    return { annualRevenue, activeOrders, productCount: myProductCount, avgRating };
  }, [filteredStoreOrders, myProducts, storeOrders, user.nickname, sampleStoreOrders, reviews]);

  const handleReviewManage = (order: StoreOrder) => {
    if (!order.reviewId) return;
    const review = reviews.find(r => r.id === order.reviewId);
    if (order.reviewId === 'rev_sample_1') {
      setSelectedReview({ id: 'rev_sample_1', productId: 'p1', userId: 'user1', author: '성공한CEO', rating: 5, content: '마케팅 진행 후 조회수가 비약적으로 상승했습니다. 정말 감사합니다!', date: '2026.03.02', reply: '좋은 후기 감사합니다!' });
      setReplyInput('좋은 후기 감사합니다!');
      setIsReplyEditing(false);
      return;
    }
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
            alert('전문가 정보에서 수익화할 내용을 작성하고, 운영자 승인을 받아야 합니다.');
            onApplySeller();
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div onClick={() => navigate('/profit-mgmt')} className="bg-gray-900 p-8 rounded-[40px] shadow-xl text-white relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all">
          <p className="text-[11px] font-black text-orange-400 uppercase tracking-widest italic mb-2 relative z-10">누적 수익금 (구매확정 기준)</p>
          <h4 className="text-4xl font-black italic tracking-tighter relative z-10">₩{stats.annualRevenue.toLocaleString()}</h4>
          <div className="absolute top-0 right-0 p-8 opacity-10"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path></svg></div>
        </div>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-2"><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic">진행 중인 주문</p><h4 className="text-3xl font-black text-gray-900 italic tracking-tighter">{stats.activeOrders} <span className="text-sm font-bold text-gray-300">건</span></h4></div>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-2"><p className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic">내 등록 상품</p><h4 className="text-3xl font-black text-gray-900 italic tracking-tighter">{stats.productCount} <span className="text-sm font-bold text-gray-300">개</span></h4></div>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 space-y-2">
           <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest italic">전문가 만족도</p>
           <div className="flex items-center gap-2">
              <h4 className="text-3xl font-black text-gray-900 italic tracking-tighter">{stats.avgRating}</h4>
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
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-5 rounded-[24px] text-[16px] font-black transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400 hover:text-gray-900'}`}>{tab.label}</button>
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

            <div className="flex flex-col md:flex-row justify-between items-center px-4 gap-4">
              <div className="flex bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm gap-1">
                 <button onClick={() => setActiveOrderCategory('sns')} className={`px-6 py-2 rounded-xl text-[12px] font-black transition-all ${activeOrderCategory === 'sns' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>SNS 판매</button>
                 <button onClick={() => setActiveOrderCategory('channel')} className={`px-6 py-2 rounded-xl text-[12px] font-black transition-all ${activeOrderCategory === 'channel' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>채널 판매</button>
                 <button onClick={() => setActiveOrderCategory('store')} className={`px-6 py-2 rounded-xl text-[12px] font-black transition-all ${activeOrderCategory === 'store' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'}`}>스토어 판매</button>
              </div>
              <div className="flex gap-2">
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-6 py-2.5 rounded-xl text-[13px] font-black bg-white border border-gray-100 outline-none shadow-sm cursor-pointer">
                  <option>전체</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
                {['all', 'trading', 'done'].map((f) => (
                  <button key={f} onClick={() => setOrderFilter(f as any)} className={`px-6 py-2.5 rounded-xl text-[13px] font-black transition-all border ${orderFilter === f ? 'bg-gray-900 text-white border-gray-900 shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}>{f === 'all' ? '전체 내역' : f === 'trading' ? '거래 중' : '거래 완료'}</button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-[12px] font-black text-gray-400 uppercase border-b border-gray-100 italic">
                  <tr>
                    <th className="px-10 py-8 w-[35%]">주문 상품 / 구매자</th>
                    <th className="px-10 py-8 text-center">주문 / 확정 일시</th>
                    <th className="px-10 py-8 text-right">금액</th>
                    <th className="px-10 py-8 text-center">상태</th>
                    <th className="px-10 py-8 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStoreOrders.length === 0 ? (
                    <tr><td colSpan={5} className="py-40 text-center text-gray-300 font-black italic text-xl">조회된 판매 내역이 없습니다.</td></tr>
                  ) : filteredStoreOrders.map(order => (
                    <tr key={order.id} className="hover:bg-blue-50/10 transition-colors group">
                      <td className="px-10 py-10">
                        <div className="flex items-center gap-8">
                           <img src={`https://picsum.photos/seed/${order.productId}/200/200`} className="w-16 h-16 bg-gray-100 rounded-2xl object-cover shadow-sm" alt="p" />
                           <div className="min-w-0">
                             <p className="text-[12px] font-black text-blue-600 uppercase italic mb-1 tracking-tighter">#{order.id}</p>
                             <p className="text-[17px] font-black text-gray-900 truncate mb-1 italic tracking-tight">{order.productName}</p>
                             <span className="text-[11px] text-gray-400 font-bold uppercase italic">구매자: @{order.userNickname}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-10 text-center">
                         <div className="space-y-1">
                            <p className="text-[12px] font-bold text-gray-400 italic">주문: {order.orderTime}</p>
                            {order.confirmedAt && <p className="text-[12px] font-black text-blue-500 italic">확정: {order.confirmedAt}</p>}
                         </div>
                      </td>
                      <td className="px-10 py-10 text-right"><p className="text-2xl font-black text-gray-900 italic tracking-tighter mb-1">₩{order.price.toLocaleString()}</p><p className="text-[10px] text-gray-300 font-bold uppercase">{order.tierName}</p></td>
                      <td className="px-10 py-10 text-center">
                        <span className={`px-6 py-2 rounded-full text-[11px] font-black italic shadow-sm transition-all ${
                          order.status === '구매확정' 
                          ? 'bg-[#00B06B] text-white shadow-lg shadow-green-100' 
                          : order.status === '작업중' ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-10 py-10 text-center">
                         <div className="flex flex-col gap-2 items-center">
                            <button onClick={() => setShowTaxModal(order)} className="px-5 py-2 bg-orange-50 text-orange-600 rounded-xl font-black text-[11px] hover:bg-black hover:text-white transition-all shadow-sm italic">세금계산서</button>
                            {order.reviewId && <button onClick={() => handleReviewManage(order)} className="px-5 py-2 bg-black text-white rounded-xl font-black text-[11px] shadow-lg hover:bg-blue-600 transition-all italic">리뷰관리</button>}
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'my-products' && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex justify-between items-center px-4">
              <div>
                <h3 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-12">내 서비스 인벤토리</h3>
                <p className="text-[12px] font-bold text-gray-400 mt-4 uppercase tracking-[0.3em]">등록된 상품 내역 ({myProducts.length}개)</p>
              </div>
              <button 
                onClick={() => navigate('/ebooks/register')}
                className="bg-blue-600 text-white px-10 py-5 rounded-[28px] font-black text-lg shadow-2xl hover:bg-black transition-all italic uppercase tracking-widest active:scale-95"
              >
                + 신규 서비스 등록 🚀
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black italic uppercase shadow-md ${status.color} border border-white/20`}>
                          {status.label}
                        </span>
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
                          <button 
                            onClick={() => navigate('/ebooks/register', { state: { ebook: eb } })}
                            className="py-3.5 bg-gray-900 text-white rounded-2xl font-black text-[11px] hover:bg-blue-600 transition-all shadow-sm italic uppercase tracking-tighter"
                          >
                            수정하기
                          </button>
                          <button 
                            onClick={() => setEbooks(prev => prev.map(item => item.id === eb.id ? { ...item, isPaused: !item.isPaused } : item))}
                            className={`py-3.5 rounded-2xl font-black text-[11px] text-white shadow-sm transition-all italic uppercase tracking-tighter ${eb.isPaused ? 'bg-green-500' : 'bg-orange-500'}`}
                          >
                            {eb.isPaused ? '판매재개' : '일시정지'}
                          </button>
                        </div>
                        <button 
                          onClick={() => { if(window.confirm('정말 삭제하시겠습니까? 등록된 모든 주문 및 리뷰 데이터에 영향을 줄 수 있습니다.')) setEbooks(prev => prev.filter(item => item.id !== eb.id)) }}
                          className="w-full py-2.5 text-gray-300 hover:text-red-500 text-[10px] font-black uppercase italic transition-colors"
                        >
                          상품 영구 삭제 ✕
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="max-w-4xl mx-auto py-10 text-center animate-in fade-in duration-700">
            <div className="bg-white rounded-[60px] p-12 md:p-20 shadow-2xl border border-gray-100 space-y-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600"></div>
              
              <div className="w-32 h-32 bg-gray-50 rounded-[40px] flex items-center justify-center text-6xl mx-auto shadow-inner border border-gray-100 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                🚧
              </div>

              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 italic tracking-tighter uppercase">
                  광고<span className="text-blue-600">/노출</span> 신청
                </h2>
                <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full"></div>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-black text-gray-800">
                  광고 및 상단 노출 서비스 오픈 준비중
                </h3>
                <p className="text-lg md:text-xl font-bold text-gray-400 italic leading-relaxed">
                  전문가님의 상품을 더 많은 고객에게 노출시키기 위한<br/>
                  최적의 광고 시스템 고도화 작업이 진행 중입니다.
                </p>
              </div>

              <div className="bg-blue-50/50 p-8 rounded-[32px] border border-blue-100">
                 <p className="text-blue-600 font-black text-xl italic animate-pulse">
                   " 빠른 시일내에 돌아오겠습니다 "
                 </p>
              </div>

              <button 
                onClick={() => setActiveTab('orders')}
                className="bg-gray-900 text-white px-14 py-6 rounded-[30px] font-black text-xl hover:bg-blue-600 transition-all shadow-xl active:scale-95 italic uppercase tracking-widest"
              >
                판매현황으로 돌아가기
              </button>
            </div>
            <p className="mt-12 text-[11px] font-bold text-gray-300 uppercase tracking-[0.4em] italic">
              THEBESTSNS ADVERTISING & EXPOSURE PLATFORM
            </p>
          </div>
        )}
      </main>

      {/* 모달: 세금계산서 정보 */}
      {showTaxModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-xl rounded-[56px] p-12 shadow-2xl space-y-8 animate-in zoom-in-95 border-8 border-orange-50">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="text-2xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-orange-500 underline-offset-8 px-2">Tax Invoice Details</h4>
                 <button onClick={() => setShowTaxModal(null)} className="text-gray-300 hover:text-gray-900 font-black text-2xl">✕</button>
              </div>

              <div className="border border-gray-200 rounded-[24px] overflow-hidden shadow-sm bg-white">
                 <table className="w-full text-sm text-left border-collapse">
                    <tbody className="divide-y divide-gray-200">
                       <tr>
                          <td className="w-1/3 bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">회사명(법인명)</td>
                          <td className="px-6 py-4 font-bold text-gray-900">{(showTaxModal.id === 'SAMP-2026-001' ? '(주)렌트앤카' : user.nickname)}</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">사업자 등록번호</td>
                          <td className="px-6 py-4 font-bold text-gray-900">1888601676</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">대표자명</td>
                          <td className="px-6 py-4 font-bold text-gray-900">최진한, 박기혁</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">사업장 주소</td>
                          <td className="px-6 py-4 font-bold text-gray-900">공항대로 227 마곡센트럴타워 409호</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">업태</td>
                          <td className="px-6 py-4 font-bold text-gray-900">서비스업</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">종목</td>
                          <td className="px-6 py-4 font-bold text-gray-900">장기렌터카 중개업</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">세금계산서 이메일</td>
                          <td className="px-6 py-4 font-bold text-gray-900">hbchu@rentncar.net</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">담당자명</td>
                          <td className="px-6 py-4 font-bold text-gray-900">추형빈</td>
                       </tr>
                       <tr>
                          <td className="bg-gray-50 px-6 py-4 font-black text-gray-700 italic border-r">담당자 연락처</td>
                          <td className="px-6 py-4 font-bold text-gray-900">01046137845</td>
                       </tr>
                       <tr className="bg-orange-50/30">
                          <td className="bg-orange-50 px-6 py-4 font-black text-orange-700 italic border-r">신청 금액</td>
                          <td className="px-6 py-4 font-black text-blue-600 text-lg">₩{showTaxModal.price.toLocaleString()}원 (VAT 포함)</td>
                       </tr>
                    </tbody>
                 </table>
              </div>

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
      )}

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
