
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { EbookProduct, WishlistItem, UserProfile, StoreType, Review, StoreOrder, GradeConfig, getUserGrade, NotificationType } from '@/types';
import { useConfirm } from '@/contexts/ConfirmContext';
import { usePortonePayment } from '@/hooks/usePortonePayment';
import { upsertStoreOrder } from '../storeDb';
import { updateProfile } from '../profileDb';
import { insertPointTransaction } from '../pointDb';

interface Props {
  ebooks: EbookProduct[];
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  user: UserProfile;
  reviews: Review[];
  storeOrders: StoreOrder[];
  members: UserProfile[];
  gradeConfigs?: GradeConfig[];
  addNotif?: (userId: string, type: NotificationType, title: string, message: string) => void;
  onStoreOrderCreated?: (order: StoreOrder) => void;
}

const EbookDetail: React.FC<Props> = ({ ebooks, wishlist, onToggleWishlist, user, reviews, storeOrders, members, gradeConfigs = [], addNotif, onStoreOrderCreated }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showConfirm } = useConfirm();
  const { requestPayment } = usePortonePayment();
  const [activeTierIdx, setSelectedTierIdx] = useState(0);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const autoTriggered = useRef(false);

  const reviewRef = useRef<HTMLDivElement>(null);

  const ebook = ebooks.find(e => e.id === id);

  const expertProfile = useMemo(() => {
    if (!ebook) return null;
    if (ebook.authorId === user.id) return user;
    return members.find(m => m.id === ebook.authorId) || null;
  }, [ebook, user, members]);

  const expertProductIds = useMemo(() => {
    if (!ebook) return [];
    return ebooks.filter(e => e.authorId === ebook.authorId).map(e => e.id);
  }, [ebooks, ebook]);

  const totalTransactions = useMemo(() => {
    if (!ebook) return 0;
    return storeOrders.filter(o => o.sellerNickname === ebook.author && o.status === '구매확정').length;
  }, [storeOrders, ebook]);

  const expertAvgRating = useMemo(() => {
    const expertReviews = reviews.filter(r => expertProductIds.includes(r.productId));
    if (expertReviews.length === 0) return "0.0";
    const sum = expertReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / expertReviews.length).toFixed(1);
  }, [reviews, expertProductIds]);

  const expertTypeInfo = useMemo(() => {
    const app = expertProfile?.sellerApplication;
    if (app?.businessInfo && app?.businessInfo.registrationNo) {
      return { label: '사업판매자', tax: '발행 가능' };
    }
    return { label: '개인판매자', tax: '발행 불가' };
  }, [expertProfile]);

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => r.productId === id);
  }, [reviews, id]);

  const reviewStats = useMemo(() => {
    const total = filteredReviews.length;
    const sum = filteredReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : "0.0";
    return { total, avg, sum };
  }, [filteredReviews]);

  if (!ebook) {
    return <div className="text-center py-20 font-black">상품을 찾을 수 없습니다.</div>;
  }

  const isMine = ebook.authorId === user.id;

  const typeInfo: Record<StoreType, { label: string; color: string }> = {
    'lecture': { label: '강의', color: 'bg-blue-600' },
    'consulting': { label: '컨설팅', color: 'bg-green-600' },
    'template': { label: '자료·템플릿', color: 'bg-purple-600' },
    'ebook': { label: '전자책', color: 'bg-gray-900' },
    'marketing': { label: '마케팅', color: 'bg-rose-500' },
  };

  const currentStoreType = ebook.storeType || 'ebook';
  const { label: typeLabel, color: typeColor } = typeInfo[currentStoreType];

  const displayAuthor = isMine ? user.nickname : ebook.author;
  const displayProfileImg = isMine ? user.profileImage : `https://api.dicebear.com/7.x/avataaars/svg?seed=${ebook.author}`;

  const tiers = ebook.tiers || [{ name: 'LITE', price: ebook.price, description: "기본 서비스 제공", pageCount: 1 }];

  const faqs = ebook.faqs || [
    { question: "구매 후 언제 받아볼 수 있나요?", answer: "결제 완료 즉시 시스템을 통해 안내 받으실 수 있습니다." },
    { question: "환불이 가능한가요?", answer: "서비스 제공 및 다운로드 이후에는 환불이 불가능하오니 신중한 구매 부탁드립니다." }
  ];

  const scrollToReviews = () => reviewRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleBuyNow = () => {
    if (isProcessing) return;
    const selectedTier = tiers[activeTierIdx];
    showConfirm({
      title: '상품 구매',
      description: `${ebook.title} (${selectedTier.name}) 상품을 구매하시겠습니까?\n결제 금액: ₩${selectedTier.price.toLocaleString()}`,
      confirmLabel: '결제하기',
      cancelLabel: '취소',
      danger: false,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const result = await requestPayment({
            orderName: `${ebook.title} [${selectedTier.name}]`,
            totalAmount: selectedTier.price,
            productId: ebook.id,
            productName: `${ebook.title} [${selectedTier.name}]`,
            userId: user.id,
            userNickname: user.nickname,
            userEmail: user.email,
            sellerNickname: ebook.author,
            tierName: selectedTier.name,
            storeType: currentStoreType,
          });

          if (result.success) {
            if (location.state?.fromCreditPurchase) {
              // 크레딧 구매 버튼에서 진입한 경우: 포인트 충전 처리 후 SNS 충전리스트로 이동
              const paymentId = result.paymentId || `PAY_${Date.now()}_${user.id.slice(0, 4)}`;
              const nextPoints = (user.points || 0) + selectedTier.price;
              updateProfile(user.id, { points: nextPoints }).catch(e => console.warn('[EbookDetail] 크레딧 충전 실패:', e));
              insertPointTransaction({
                id: paymentId,
                user_id: user.id,
                type: 'charge',
                description: `마케팅 이용권 구매 (${ebook.title} [${selectedTier.name}])`,
                amount: selectedTier.price,
                created_at: new Date().toISOString(),
                payment_method: result.paymentMethod || 'CARD',
                payment_log: result.paymentLog || '',
              }).catch(e => console.warn('[EbookDetail] 충전 내역 저장 실패:', e));
              addNotif?.(user.id, 'payment', '💳 크레딧 구매 완료', `${selectedTier.price.toLocaleString()}C 크레딧이 구매되었습니다.`);
              alert('크레딧 구매가 완료되었습니다!');
              navigate('/mypage', { state: { activeTab: 'buyer', buyerSubTab: 'sns', snsSubTab: 'charge' } });
            } else {
              const newOrder: StoreOrder = {
                id: result.orderId || `SO_${Date.now()}_${user.id.slice(0, 6)}`,
                userId: user.id,
                userNickname: user.nickname,
                sellerNickname: ebook.author,
                orderTime: new Date().toISOString(),
                productId: ebook.id,
                productName: `${ebook.title} [${selectedTier.name}]`,
                tierName: selectedTier.name,
                price: selectedTier.price,
                storeType: currentStoreType,
                status: '결제완료',
                paymentId: result.paymentId,
                paymentMethod: result.paymentMethod,
                paymentLog: result.paymentLog,
                receiptUrl: result.receiptUrl,
              };
              onStoreOrderCreated?.(newOrder);
              upsertStoreOrder(newOrder).catch(e => console.warn('[EbookDetail] 주문 저장 실패:', e));
              addNotif?.(ebook.authorId, 'ebook', '💰 상품 판매 알림', `[${ebook.title}] 상품이 판매되었습니다.`);
              addNotif?.(user.id, 'payment', '💳 결제 완료', `[${ebook.title}] 구매가 완료되었습니다. 마이페이지에서 확인하세요.`);
              alert('결제가 완료되었습니다!');
              navigate('/mypage', { state: { activeTab: 'buyer', buyerSubTab: 'store' } });
            }
          } else if (result.error) {
            alert(`결제 실패: ${result.error}`);
          }
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // 크레딧 충전페이지에서 넘어온 경우 PG창 자동 오픈
  useEffect(() => {
    if (!location.state?.autoTrigger) return;
    if (autoTriggered.current) return;
    if (!ebook) return;
    // autoTriggered.current는 타이머 실행 직전에 set — 타이머 취소 후 재시도가 가능하도록
    const selectedTier = tiers[activeTierIdx];
    const timer = setTimeout(async () => {
      if (autoTriggered.current) return; // 이중 실행 방지
      autoTriggered.current = true;
      setIsProcessing(true);
      try {
        const result = await requestPayment({
          orderName: `${ebook.title} [${selectedTier.name}]`,
          totalAmount: selectedTier.price,
          productId: ebook.id,
          productName: `${ebook.title} [${selectedTier.name}]`,
          userId: user.id,
          userNickname: user.nickname,
          userEmail: user.email,
          sellerNickname: ebook.author,
          tierName: selectedTier.name,
          storeType: currentStoreType,
        });
        if (result.success) {
          const newOrder: StoreOrder = {
            id: result.orderId || `SO_${Date.now()}_${user.id.slice(0, 6)}`,
            userId: user.id,
            userNickname: user.nickname,
            sellerNickname: ebook.author,
            orderTime: new Date().toISOString(),
            productId: ebook.id,
            productName: `${ebook.title} [${selectedTier.name}]`,
            tierName: selectedTier.name,
            price: selectedTier.price,
            storeType: currentStoreType,
            status: '결제완료',
            paymentId: result.paymentId,
            paymentMethod: result.paymentMethod,
            paymentLog: result.paymentLog,
            receiptUrl: result.receiptUrl,
          };

          if (location.state?.fromCreditPurchase) {
            // 크레딧 구매는 store_order 미생성 — 충전리스트에만 기록
            // 크레딧 구매 버튼에서 진입한 경우: 포인트 충전 처리 후 SNS 충전리스트로 이동
            const paymentId = result.paymentId || `PAY_${Date.now()}_${user.id.slice(0, 4)}`;
            const nextPoints = (user.points || 0) + selectedTier.price;
            updateProfile(user.id, { points: nextPoints }).catch(e => console.warn('[EbookDetail] 크레딧 충전 실패:', e));
            insertPointTransaction({
              id: paymentId,
              user_id: user.id,
              type: 'charge',
              description: `마케팅 이용권 구매 (${ebook.title} [${selectedTier.name}])`,
              amount: selectedTier.price,
              created_at: new Date().toISOString(),
              payment_method: result.paymentMethod || 'CARD',
              payment_log: result.paymentLog || '',
            }).catch(e => console.warn('[EbookDetail] 충전 내역 저장 실패:', e));
            addNotif?.(user.id, 'payment', '💳 크레딧 구매 완료', `${selectedTier.price.toLocaleString()}C 크레딧이 구매되었습니다.`);
            alert('크레딧 구매가 완료되었습니다!');
            navigate('/mypage', { state: { activeTab: 'buyer', buyerSubTab: 'sns', snsSubTab: 'charge' } });
          } else {
            onStoreOrderCreated?.(newOrder);
            upsertStoreOrder(newOrder).catch(e => console.warn('[EbookDetail] 주문 저장 실패:', e));
            addNotif?.(ebook.authorId, 'ebook', '💰 상품 판매 알림', `[${ebook.title}] 상품이 판매되었습니다.`);
            addNotif?.(user.id, 'payment', '💳 결제 완료', `[${ebook.title}] 구매가 완료되었습니다. 마이페이지에서 확인하세요.`);
            alert('결제가 완료되었습니다!');
            navigate('/mypage', { state: { activeTab: 'buyer', buyerSubTab: 'store' } });
          }
        } else if (result.error) {
          if (location.state?.fromCreditPurchase) {
            navigate('/credit/apply');
          } else {
            alert(`결제가 취소되었습니다: ${result.error}`);
          }
        } else if (location.state?.fromCreditPurchase) {
          // success도 error도 아닌 경우(창 닫기 등)도 크레딧 구매 페이지로
          navigate('/credit/apply');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ebook]);

  const openInquiry = () => {
    navigate('/chat', { state: { productRef: ebook, targetUser: { id: ebook.authorId, nickname: ebook.author, profileImage: expertProfile?.profileImage || '' } } });
  };

  const isServiceType = ['marketing', 'lecture', 'consulting'].includes(currentStoreType);

  return (
    <div className="max-w-[1400px] mx-auto pb-36 lg:pb-24 px-4 lg:px-8 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors group">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        뒤로가기
      </button>

      <div className="flex flex-col lg:flex-row gap-16 items-start">
        <div className="flex-1 space-y-16 w-full min-w-0">
          <section>
            <div className="flex gap-2 mb-6">
               <span className={`${typeColor} text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm uppercase italic tracking-widest`}>{typeLabel}</span>
               <span className="bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm border border-green-100 uppercase italic tracking-widest">오리지널</span>
            </div>
            <h1 className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 sm:mb-8 leading-[1.2] italic tracking-tighter line-clamp-2 sm:line-clamp-none">{ebook.title}</h1>
            <div className="flex items-center gap-3 sm:gap-6">
               <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-50 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-100">
                  <div className="flex text-yellow-400">
                    {Array.from({length: 5}).map((_, i) => (
                      <svg key={i} className={`w-6 h-6 fill-current ${i < Math.round(Number(reviewStats.avg)) ? 'text-yellow-400' : 'text-gray-200'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    ))}
                  </div>
                  <span className="text-2xl font-black text-gray-900 leading-none">{reviewStats.avg}</span>
               </div>
               <span onClick={scrollToReviews} className="text-[11px] sm:text-[15px] font-bold text-gray-400 underline underline-offset-4 cursor-pointer hover:text-blue-500 italic whitespace-nowrap">({reviewStats.total}개의 검증된 리뷰 보기)</span>
            </div>
          </section>

          {/* 전문가 요약 정보 */}
          <section className="bg-white border border-gray-100 rounded-[20px] sm:rounded-[28px] p-4 sm:p-5 md:p-6 shadow-sm space-y-3 sm:space-y-4">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-3">
                   <div className="relative shrink-0">
                      <img src={displayProfileImg} className="w-12 h-12 md:w-14 md:h-14 rounded-[16px] object-cover shadow-lg border border-white" alt="expert" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] shadow border border-white">✓</div>
                   </div>
                   <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-black text-lg md:text-xl text-gray-900 italic tracking-tighter">{displayAuthor}</h4>
                        {(() => { const g = getUserGrade(expertProfile, gradeConfigs); return g ? <span className={`${g.color} text-white text-[9px] font-black px-2 py-0.5 rounded-full italic uppercase`}>{g.name}</span> : null; })()}
                      </div>
                   </div>
                </div>
                <button onClick={openInquiry} className="bg-gray-900 text-white px-5 py-2.5 rounded-[20px] font-black text-sm hover:bg-blue-600 transition-all shadow italic uppercase tracking-wider active:scale-95 shrink-0">전문가 문의하기</button>
             </div>
             <div className="bg-gray-50/80 rounded-[12px] sm:rounded-[16px] p-1.5 sm:p-2 grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap gap-1.5 sm:gap-2 shadow-inner border border-gray-100">
                {[
                  { label: '총 거래 건수', value: `${totalTransactions}건`, icon: '📊' },
                  { label: '만족도 점수', value: expertAvgRating, icon: '⭐' },
                  { label: '회원 구분', value: expertTypeInfo.label, icon: '👤' },
                  { label: '세금계산서', value: expertTypeInfo.tax, icon: '🧾' }
                ].map((item, i) => (
                  <div key={i} className="flex-1 min-w-0 bg-white rounded-[10px] sm:rounded-[12px] py-2.5 sm:py-3.5 px-2 flex flex-col items-center justify-center border border-gray-50 group hover:border-blue-200 transition-all">
                    <span className="text-xl sm:text-2xl mb-1 group-hover:scale-105 transition-transform">{item.icon}</span>
                    <p className="text-[9px] sm:text-sm font-black text-gray-400 mb-0.5 sm:mb-1 uppercase tracking-wider italic leading-tight text-center">{item.label}</p>
                    <p className={`font-black text-gray-900 italic tracking-tighter text-center text-sm sm:text-lg leading-tight ${item.label === '회원 구분' ? 'whitespace-nowrap' : ''}`}>{item.value}</p>
                  </div>
                ))}
             </div>
          </section>

          <div className="space-y-6 sm:space-y-12">
            {!isServiceType && ebook.index && (
              <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                  <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                    <span className="w-1.5 h-6 sm:h-8 bg-yellow-400 rounded-full shrink-0" aria-hidden></span>
                    목차
                  </h3>
                </div>
                <div className="px-4 py-4 sm:p-8 text-[15px] sm:text-[17px] text-gray-700 font-medium leading-relaxed sm:leading-[1.85] whitespace-pre-wrap text-left">
                  {ebook.index}
                </div>
              </section>
            )}

            <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                  <span className="w-1.5 h-6 sm:h-8 bg-blue-600 rounded-full shrink-0" aria-hidden></span>
                  서비스 상세설명
                </h3>
              </div>
              <div className="px-4 py-4 sm:p-8 text-[15px] sm:text-[17px] text-gray-700 font-medium leading-relaxed sm:leading-[1.85] whitespace-pre-wrap text-left">
                {ebook.description || "상세 설명이 등록되지 않았습니다."}
              </div>
            </section>

            <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                  <span className="w-1.5 h-6 sm:h-8 bg-teal-500 rounded-full shrink-0" aria-hidden></span>
                  제공 서비스 상세내용
                </h3>
              </div>
              {tiers.length > 1 && (
                <div className="px-4 sm:px-8 pt-3 sm:pt-4 flex border-b border-gray-100 gap-2">
                  {tiers.map((tier, idx) => (
                    <button key={tier.name} type="button" onClick={() => setSelectedTierIdx(idx)} className={`py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-sm font-black transition-all ${activeTierIdx === idx ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {tier.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-4 py-4 sm:p-8 text-[15px] sm:text-[17px] text-gray-700 font-medium leading-relaxed sm:leading-[1.85] whitespace-pre-wrap text-left">
                {tiers[activeTierIdx].description?.trim() || "해당 옵션에 대한 제공 서비스 상세가 등록되지 않았습니다."}
              </div>
            </section>

            {isServiceType && ebook.serviceMethod && (
              <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                  <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                    <span className="w-1.5 h-6 sm:h-8 bg-orange-500 rounded-full shrink-0" aria-hidden></span>
                    서비스 제공방법 및 절차
                  </h3>
                </div>
                <div className="px-4 py-4 sm:p-8 text-[15px] sm:text-[17px] text-gray-700 font-medium leading-relaxed sm:leading-[1.85] whitespace-pre-wrap text-left">
                  {ebook.serviceMethod}
                </div>
              </section>
            )}

            {ebook.attachedImages && ebook.attachedImages.length > 0 && (
              <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                  <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                    <span className="w-1.5 h-6 sm:h-8 bg-indigo-500 rounded-full shrink-0" aria-hidden></span>
                    상세이미지
                  </h3>
                </div>
                <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                  {ebook.attachedImages.map((img, i) => (
                    <img key={i} src={img} className="w-full rounded-xl sm:rounded-2xl shadow-md border border-gray-100" alt={`상세 이미지 ${i + 1}`} />
                  ))}
                </div>
              </section>
            )}

            <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                  <span className="w-1.5 h-6 sm:h-8 bg-amber-400 rounded-full shrink-0" aria-hidden></span>
                  자주 묻는 질문
                </h3>
              </div>
              <div className="p-3 sm:p-6 space-y-2 sm:space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-xl sm:rounded-2xl overflow-hidden bg-gray-50/30 transition-all hover:border-gray-200">
                    <button
                      onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                      className="w-full px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center text-left gap-3 sm:gap-4"
                    >
                      <span className="font-bold text-gray-800 text-sm sm:text-base pr-2">Q. {faq.question}</span>
                      <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 transition-transform ${openFaqIdx === idx ? 'rotate-180 text-blue-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {openFaqIdx === idx && (
                      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0 animate-in slide-in-from-top-2">
                        <p className="text-sm sm:text-[15px] text-gray-600 font-medium leading-relaxed pl-1 text-left">A. {faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section ref={reviewRef} className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50 flex flex-wrap justify-between items-center gap-3 sm:gap-4">
                  <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                      <span className="w-1.5 h-6 sm:h-8 bg-yellow-400 rounded-full shrink-0" aria-hidden></span>
                      실제 구매 고객 만족도
                  </h3>
                  <div className="flex items-center gap-3 sm:gap-4 bg-gray-900 text-white px-4 sm:px-6 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl">
                      <span className="text-2xl sm:text-4xl font-black text-yellow-400">{reviewStats.avg}</span>
                      <div className="space-y-0.5">
                        <div className="flex text-yellow-400">{Array.from({length: 5}).map((_, i) => (<svg key={i} className={`w-4 h-4 sm:w-5 sm:h-5 fill-current ${i < Math.round(Number(reviewStats.avg)) ? 'text-yellow-400' : 'text-gray-600'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>))}</div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{reviewStats.total}개 리뷰</p>
                      </div>
                  </div>
              </div>

              <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {filteredReviews.length === 0 ? (
                      <div className="col-span-full py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                          <p className="text-gray-400 font-bold">아직 작성된 리뷰가 없습니다</p>
                      </div>
                  ) : filteredReviews.map((rev) => (
                      <div key={rev.id} className="space-y-4">
                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                            <div className="flex justify-between items-start gap-4 mb-4">
                               <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 shrink-0"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rev.userId}`} alt="" className="w-full h-full object-cover" /></div>
                                  <div>
                                     <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-gray-900">@{rev.author}</span><span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded">구매자</span></div>
                                     <div className="flex text-yellow-400 mt-1">{Array.from({length: 5}).map((_, j) => (<svg key={j} className={`w-4 h-4 fill-current ${j < rev.rating ? 'text-yellow-400' : 'text-gray-200'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>))}</div>
                                  </div>
                               </div>
                               <span className="text-[11px] font-medium text-gray-400 shrink-0">{rev.date}</span>
                            </div>
                            <p className="text-[15px] text-gray-700 font-medium leading-relaxed">"{rev.content}"</p>
                        </div>
                        {rev.reply && (
                          <div className="ml-6 pl-6 border-l-2 border-blue-200 bg-blue-50/30 py-4 rounded-r-2xl">
                             <div className="flex items-center gap-3 mb-2">
                                <img src={displayProfileImg} className="w-10 h-10 rounded-lg border-2 border-white" alt="" />
                                <div>
                                  <p className="text-sm font-bold text-blue-900">{displayAuthor} <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded">전문가</span></p>
                                  <p className="text-[11px] text-blue-500">{rev.replyDate}</p>
                                </div>
                             </div>
                             <p className="text-[15px] font-medium text-blue-900/90 leading-relaxed">"{rev.reply}"</p>
                          </div>
                        )}
                      </div>
                  ))}
              </div>
            </section>

            <section className="scroll-mt-24 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-base sm:text-xl font-black text-gray-900 flex items-center gap-2 sm:gap-3 tracking-tight">
                  <span className="w-1.5 h-6 sm:h-8 bg-rose-500 rounded-full shrink-0" aria-hidden></span>
                  취소 및 환불 규정
                </h3>
              </div>
              {isServiceType ? (
                <div className="px-4 py-4 sm:p-8 text-sm sm:text-[15px] text-gray-600 font-medium space-y-4 sm:space-y-6 leading-relaxed text-left">
                  <div className="space-y-2">
                    <p className="font-bold text-gray-900 text-base mb-2">기본 정책</p>
                    <p>1. 용역 제공이 개시되기 전: 취소 및 환불 가능</p>
                    <p>2. 용역 제공이 개시된 후</p>
                    <p className="pl-4">• 가분적 용역: 제공이 개시되지 않은 범위에 대한 취소 및 환불 가능</p>
                    <p className="pl-4">• 불가분적 용역: 취소 및 환불 불가</p>
                    <p>3. 제공된 용역이 구매 확정된 경우: 거래 금액을 정산 받은 전문가와 직접 취소 및 환불 협의</p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <p className="font-bold text-gray-900 text-base mb-2">참고 사항</p>
                    <p>• 전문가가 제시한 취소 조건이 기본 규정보다 의뢰인에게 유리한 경우 해당 기준을 따릅니다.</p>
                    <p>• 전문가가 별도로 명시한 사전 준비 사항(상담, 출장, 예약 등)과 이에 대한 취소 조건이 있는 경우 해당 기준을 따릅니다.</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-[15px] text-gray-600 font-medium space-y-6 leading-relaxed text-left">
                  <div className="space-y-2">
                    <p className="font-bold text-gray-900 text-base mb-2">기본 정책</p>
                    <p>1. 디지털 콘텐츠 제공이 개시되기 전: 취소 및 환불 가능</p>
                    <p>2. 디지털 콘텐츠 제공이 개시된 후</p>
                    <p className="pl-4">• 가분적 콘텐츠: 개시되지 않은 범위에 대한 취소 및 환불 가능</p>
                    <p className="pl-4">• 불가분적 콘텐츠: 취소 및 환불 불가</p>
                    <p>3. 제공된 콘텐츠가 구매 확정된 경우: 거래 금액을 정산 받은 전문가와 직접 취소 및 환불 협의</p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <p className="font-bold text-gray-900 text-base mb-2">주의 사항</p>
                    <p className="text-rose-600">• 디지털 콘텐츠의 특성상 다운로드 이후에는 원칙적으로 환불이 불가능하오니 신중한 구매 부탁드립니다.</p>
                    <p>• 콘텐츠를 공급받은 날부터 3개월 이내 또는 그 사실을 안 날 또는 알 수 있었던 날부터 30일 이내에 취소 및 환불이 가능합니다.</p>
                  </div>
                </div>
              )}
            </section>

            <section className="scroll-mt-24 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                  <span className="w-1.5 h-8 bg-green-500 rounded-full shrink-0" aria-hidden></span>
                  상품 정보 안내
                </h3>
              </div>
              <div className="px-2 pb-2">
                 <table className="w-full text-[15px] text-left border-collapse">
                    <tbody className="divide-y divide-gray-100">
                       <tr className="flex flex-col md:table-row">
                          <td className="md:w-1/4 bg-gray-50/80 px-6 py-4 font-bold text-gray-600 text-[13px] uppercase tracking-wide">공급자</td>
                          <td className="px-6 py-4 font-medium text-gray-900 border-b md:border-b-0">{displayAuthor}</td>
                          <td className="md:w-1/4 bg-gray-50/80 px-6 py-4 font-bold text-gray-600 text-[13px] uppercase tracking-wide">이용기간</td>
                          <td className="px-6 py-4 font-medium text-gray-900">상품 상세 참조</td>
                       </tr>
                       <tr className="flex flex-col md:table-row">
                          <td className="bg-gray-50/80 px-6 py-4 font-bold text-gray-600 text-[13px] uppercase tracking-wide">제공방식</td>
                          <td className="px-6 py-4 font-medium text-gray-900 border-b md:border-b-0">
                             <p className="mb-1">파일형태: 마이페이지 자동 발송</p>
                             <p>용역형태: 전문가 개별 협의</p>
                          </td>
                          <td className="bg-gray-50/80 px-6 py-4 font-bold text-gray-600 text-[13px] uppercase tracking-wide">시스템사양</td>
                          <td className="px-6 py-4 font-medium text-gray-900">파일 호환 가능 환경</td>
                       </tr>
                       <tr className="flex flex-col md:table-row">
                          <td className="bg-gray-50/80 px-6 py-4 font-bold text-gray-600 text-[13px] uppercase tracking-wide">고객센터</td>
                          <td className="px-6 py-4 font-medium text-gray-900" colSpan={3}>
                             <p className="font-bold">BESTSNS 고객센터</p>
                             <p className="text-[13px] text-gray-500 mt-1">상담 시간: 평일 10:00 - 18:00 (점심시간 제외)</p>
                          </td>
                       </tr>
                    </tbody>
                 </table>
              </div>
            </section>
          </div>
        </div>

        {/* 모바일 전용: 하단 고정 구매/문의 버튼 바 */}
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-[90] px-3 py-2.5 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-400 truncate">{ebook.title}</p>
              <p className="text-base font-black text-gray-900">₩{tiers[activeTierIdx].price.toLocaleString()}</p>
            </div>
            <button onClick={openInquiry} className="shrink-0 py-2.5 px-4 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-black text-sm active:scale-95 transition-all">
              문의하기
            </button>
            <button onClick={handleBuyNow} disabled={isProcessing} className={`shrink-0 py-2.5 px-5 ${typeColor} text-white rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {isProcessing ? '처리중...' : '구매하기'}
            </button>
          </div>
        </div>

        {/* 데스크톱: 우측 고정 패널 - 제공 서비스 상세 항상 표시 */}
        <div className="hidden lg:block w-full lg:w-[450px] shrink-0 sticky top-24">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 xl:p-8 shadow-lg space-y-6">
            <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-video">
              <img src={ebook.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex border border-gray-100 rounded-2xl p-2 gap-2">
              {tiers.map((tier, idx) => (
                <button key={tier.name} onClick={() => setSelectedTierIdx(idx)} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${activeTierIdx === idx ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
                  {tier.name}
                </button>
              ))}
            </div>
            <div className="space-y-4 pt-4">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-3xl xl:text-4xl font-black text-gray-900 italic tracking-tighter">₩{(tiers[activeTierIdx].price).toLocaleString()}</span>
                <span className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest">(VAT 포함)</span>
              </div>
              <p className="text-[14px] font-black text-gray-400 uppercase italic tracking-[0.3em] flex items-center gap-3">
                <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                {currentStoreType === 'ebook' || currentStoreType === 'template' ? '총 분량' : '작업 기간'}
              </p>
              <p className="text-2xl font-black text-gray-900 italic tracking-tighter">
                {tiers[activeTierIdx].pageCount}{currentStoreType === 'ebook' || currentStoreType === 'template' ? 'p' : '일'}
              </p>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-black text-gray-400 uppercase italic tracking-wider mb-2">제공 서비스 상세</p>
                <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{tiers[activeTierIdx].description?.trim() || "등록된 내용이 없습니다."}</p>
              </div>
            </div>
            <div className="space-y-8 pt-4">
              <button onClick={openInquiry} className="w-full py-4 bg-white border-2 border-gray-900 text-gray-900 rounded-[32px] font-black text-lg hover:bg-gray-50 transition-all shadow-xl italic uppercase tracking-widest active:scale-95">
                문의하기 ✉
              </button>
              <button onClick={isProcessing ? () => setIsProcessing(false) : handleBuyNow} className={`w-full py-8 ${typeColor} text-white rounded-[32px] font-black text-2xl hover:opacity-95 transition-all shadow-2xl uppercase italic tracking-[0.2em] ${!isProcessing ? 'animate-pulse' : 'opacity-70'}`}>
                {isProcessing ? '결제 처리 중... (취소하려면 클릭)' : '즉시 구매하기 🚀'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbookDetail;
