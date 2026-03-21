
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChannelProduct, WishlistItem, Review, UserProfile, ChannelOrder, NotificationType } from '@/types';
import { useConfirm } from '@/contexts/ConfirmContext';
import { usePortonePayment } from '@/hooks/usePortonePayment';
import { upsertChannelOrder } from '../channelDb';

interface Props {
  channels: ChannelProduct[];
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  reviews: Review[];
  members: UserProfile[];
  user?: UserProfile;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string) => void;
  onChannelOrderCreated?: (order: ChannelOrder) => void;
}

const ChannelDetail: React.FC<Props> = ({ channels, wishlist, onToggleWishlist, reviews, members, user, addNotif, onChannelOrderCreated }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showConfirm } = useConfirm();
  const { requestPayment } = usePortonePayment();
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyerAccountInput, setBuyerAccountInput] = useState('');
  
  const channel = channels.find(c => c.id === id);

  // 채널 판매 상품군에 해당하는 모든 리뷰를 통합하여 추출 (모든 채널 상세페이지에서 공유)
  const allChannelReviews = useMemo(() => {
    const channelIds = channels.map(c => c.id);
    return reviews.filter(r => channelIds.includes(r.productId));
  }, [reviews, channels]);

  const reviewStats = useMemo(() => {
    const total = allChannelReviews.length;
    const sum = allChannelReviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = total > 0 ? (sum / total).toFixed(1) : "0.0";
    return { total, avg };
  }, [allChannelReviews]);

  if (!channel) {
    return <div className="text-center py-20 font-black">상품을 찾을 수 없습니다.</div>;
  }

  const isWishlisted = wishlist.some(w => w.data.id === channel.id);
  const income = channel.income || 0;
  const expense = channel.expense || 0;
  const description = channel.description || "상세 설명이 등록되지 않았습니다.";
  const attachedImages = channel.attachedImages || [];

  const handleStartConsultation = () => {
    let targetUser: { id: string; nickname: string; profileImage: string };
    if (channel.sellerId) {
      const seller = members.find(m => m.id === channel.sellerId);
      targetUser = {
        id: channel.sellerId,
        nickname: channel.sellerNickname || seller?.nickname || '채널 운영자',
        profileImage: channel.sellerImage || seller?.profileImage || '',
      };
    } else {
      const admin = members.find(m => m.role === 'admin');
      targetUser = admin
        ? { id: admin.id, nickname: admin.nickname, profileImage: admin.profileImage || '' }
        : { id: 'admin', nickname: '채널 운영자', profileImage: '' };
    }
    navigate('/chat', { state: { productRef: channel, targetUser } });
  };

  const handleBuyNow = () => {
    if (isProcessing || !user) return;
    setBuyerAccountInput('');
    setShowBuyModal(true);
  };

  const handleConfirmBuy = async () => {
    if (!buyerAccountInput.trim()) {
      alert('구매할 계정을 입력해주세요.');
      return;
    }
    setShowBuyModal(false);
    setIsProcessing(true);
    try {
      const result = await requestPayment({
        orderName: `[채널구매] ${channel.title}`,
        totalAmount: channel.price,
        productId: channel.id,
        productName: channel.title,
        userId: user!.id,
        userNickname: user!.nickname,
        userEmail: user!.email,
        sellerNickname: channel.sellerNickname,
      });

      if (result.success) {
        const newOrder: ChannelOrder = {
          id: `CO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId: user!.id,
          userNickname: user!.nickname,
          orderTime: new Date().toISOString(),
          productId: channel.id,
          productName: channel.title,
          platform: channel.platform ?? '',
          price: channel.price,
          status: '결제완료',
          paymentId: result.paymentId,
          paymentMethod: result.paymentMethod,
          paymentLog: result.paymentLog,
          receiptUrl: result.receiptUrl,
          buyerAccount: buyerAccountInput.trim(),
        };
        onChannelOrderCreated?.(newOrder);
        try {
          await upsertChannelOrder(newOrder);
        } catch (e) {
          console.error('[ChannelDetail] 주문 DB 저장 실패:', e);
        }
        if (channel.sellerId) {
          addNotif?.(channel.sellerId, 'channel', '💰 채널 판매 알림', `[${channel.title}] 채널이 판매되었습니다.`);
        }
        addNotif?.(user!.id, 'payment', '💳 결제 완료', `[${channel.title}] 채널 구매가 완료되었습니다. 마이페이지에서 확인하세요.`);
        alert('결제가 완료되었습니다!');
        navigate('/mypage', { state: { activeTab: 'buyer', buyerSubTab: 'channel' } });
      } else if (result.error) {
        alert(`결제 실패: ${result.error}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-36 sm:pb-40 lg:pb-24 px-3 sm:px-4 lg:px-8 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="mb-4 sm:mb-6 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors group text-sm sm:text-base">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        뒤로가기
      </button>

      <div className="bg-white rounded-2xl sm:rounded-3xl lg:rounded-[48px] shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 lg:p-14">
        {/* 데스크톱(lg+): 원래 2열 레이아웃 — 썸네일 왼쪽, 본문 오른쪽 */}
        <div className="hidden lg:flex flex-col lg:flex-row gap-8 lg:gap-16">
          <div className="lg:w-[450px] shrink-0">
            <img src={channel.thumbnail} alt={channel.title} className="w-full aspect-square object-cover rounded-2xl md:rounded-[32px] shadow-xl shadow-blue-50 border border-gray-50" />
          </div>
          <div className="flex-1 space-y-6 md:space-y-10 min-w-0">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight italic tracking-tighter">{channel.title}</h1>
                <button onClick={() => onToggleWishlist({ type: 'channel', data: channel })} className={`p-4 border-2 rounded-2xl font-black transition-all shadow-sm shrink-0 active:scale-90 ${isWishlisted ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white border-gray-100 text-gray-400 hover:text-red-500'}`}><svg className="w-6 h-6" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></button>
              </div>
              <div className="flex flex-wrap items-center gap-2 gap-4 mb-6">
                <div className="flex text-yellow-400 text-xl">{Array.from({length: 5}).map((_, i) => (<span key={i}>{i < Math.floor(Number(reviewStats.avg)) ? '★' : '☆'}</span>))}</div>
                <span className="text-2xl font-black text-gray-900">{reviewStats.avg}</span>
                <span className="text-sm font-bold text-gray-400">(누적 거래 만족도: {reviewStats.total}건)</span>
              </div>
              {channel.publicLink && (<a href={channel.publicLink} target="_blank" rel="noreferrer" className="text-blue-600 font-black text-lg flex items-center gap-2 underline decoration-2 underline-offset-4 italic break-all">🔗 채널 정보 직접 확인하기 (클릭)</a>)}
            </div>
            <div className="bg-gray-50/50 rounded-3xl md:rounded-[40px] p-6 md:p-10 grid grid-cols-3 gap-6 md:gap-10 shadow-inner border border-gray-100">
              <div className="flex flex-col items-center gap-2 text-center"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest">구독자수</span><span className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">{channel.subscribers.toLocaleString()}명</span></div>
              <div className="flex flex-col items-center gap-2 text-center border-x border-gray-200"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest">월 평균 수입</span><span className="text-2xl md:text-3xl font-black text-green-600 tracking-tight">${income.toLocaleString()}</span></div>
              <div className="flex flex-col items-center gap-2 text-center"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest">월 평균 지출</span><span className="text-2xl md:text-3xl font-black text-red-400 tracking-tight">${expense.toLocaleString()}</span></div>
            </div>
            <div className="flex flex-row items-center gap-3 pb-6 border-b border-gray-100">
                <div className="text-3xl md:text-4xl font-black text-gray-900 italic tracking-tighter leading-none whitespace-nowrap shrink-0">₩ {channel.price.toLocaleString()}</div>
                <button onClick={handleStartConsultation} className="flex-1 py-3 bg-white border-2 border-gray-900 text-gray-900 rounded-[24px] font-black text-sm hover:bg-gray-50 transition-all shadow-lg active:scale-95 italic uppercase">상담하기</button>
                <button onClick={handleBuyNow} disabled={isProcessing || !user} className={`flex-1 py-3 bg-gray-900 text-white rounded-[24px] font-black text-sm transition-all shadow-2xl shadow-blue-100 italic uppercase ${!isProcessing && user ? 'hover:bg-blue-600 active:scale-95' : 'opacity-60 cursor-not-allowed'}`}>{isProcessing ? '결제 처리 중...' : '구매하기'}</button>
              </div>
          </div>
        </div>

        {/* 데스크톱 전용: 에스크로 보호 카드 (전체 너비) */}
        <div className="hidden lg:block mt-8">
          <div className="bg-[#f4f9ff] p-8 md:p-10 rounded-[36px] border border-[#dce9ff] relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-5"><svg className="w-64 h-64 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg></div>
            <p className="text-[#2b6cb0] text-xl font-black italic tracking-tight uppercase">THEBESTSNS Escrow Protection 가동 중</p>
            <ul className="mt-3 space-y-2 text-[#4a5568] text-[15px] font-bold italic">
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 7일 후, 판매자는 에스크로 대리인에게 주요 소유권을 양도합니다.</li>
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 에스크로 대리인 확인 후 매수인에게 소유권을 양도합니다.</li>
              <li className="flex items-start gap-3"><span className="text-red-500 font-black shrink-0">✓</span> 채널 양도를 받을 계정을 꼭 정확하게 입력해주세요 (오타 및 계정 문제는 플랫폼 책임이 아니기에 환불되지 않습니다)</li>
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 유튜브 정책 상 채널 양도 기간인 7일이 지나야 양도됩니다.</li>
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 채널 인도 후 최소 10일 동안 채널 운영 및 작업을 진행하지 않는것을 권장합니다.</li>
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 채널 인도 후 초반부터 유튜브 정책을 어긋나는 과도한 매크로 작업, 선정적 및 위법성 등은 자제해주시기 바랍니다.</li>
              <li className="flex items-start gap-3"><span className="text-blue-500 font-black shrink-0">✓</span> 채널 인수 이후 해킹 또는 계정 및 채널 문제는 회원의 과실로 판단됩니다.</li>
            </ul>
          </div>
        </div>

        {/* 모바일/태블릿(lg 미만): 컴팩트 1열 + 상단 문의·구매 버튼 */}
        <div className="lg:hidden">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{channel.platform}</span>
                <button onClick={() => onToggleWishlist({ type: 'channel', data: channel })} className={`p-1.5 rounded-lg border transition-all ${isWishlisted ? 'bg-red-50 text-red-500 border-red-100' : 'bg-gray-50 text-gray-400 border-gray-100 hover:text-red-500'}`}><svg className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg></button>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 leading-tight tracking-tight">{channel.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm">
                <div className="flex text-yellow-400">{Array.from({length: 5}).map((_, i) => (<span key={i}>{i < Math.floor(Number(reviewStats.avg)) ? '★' : '☆'}</span>))}</div>
                <span className="font-black text-gray-900">{reviewStats.avg}</span>
                <span className="text-gray-400 text-xs">({reviewStats.total}건)</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 mt-3 whitespace-nowrap">₩ {channel.price.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 py-4 sm:py-6 border-b border-gray-50">
            <div className="text-center"><span className="block text-[10px] font-bold text-gray-400 uppercase">구독자</span><span className="text-lg sm:text-xl font-black text-gray-800">{channel.subscribers.toLocaleString()}명</span></div>
            <div className="text-center border-x border-gray-100"><span className="block text-[10px] font-bold text-gray-400 uppercase">월 수입</span><span className="text-lg sm:text-xl font-black text-green-600">${income.toLocaleString()}</span></div>
            <div className="text-center"><span className="block text-[10px] font-bold text-gray-400 uppercase">월 지출</span><span className="text-lg sm:text-xl font-black text-red-500">${expense.toLocaleString()}</span></div>
          </div>

          <div className="bg-[#f4f9ff] p-4 sm:p-6 rounded-2xl border border-[#dce9ff] mt-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-5"><svg className="w-24 h-24 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg></div>
            <p className="text-[#2b6cb0] text-sm font-black uppercase tracking-tight">THEBESTSNS Escrow Protection 가동 중</p>
            <ul className="mt-2 space-y-1.5 text-[#4a5568] text-xs sm:text-sm font-medium">
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 7일 후 판매자가 에스크로 대리인에게 소유권 양도</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 에스크로 대리인 확인 후 매수인에게 양도</li>
              <li className="flex items-start gap-2"><span className="text-red-500 shrink-0 font-black">✓</span> <span className="font-bold">채널 양도를 받을 계정을 꼭 정확하게 입력해주세요 (오타 및 계정 문제는 플랫폼 책임이 아니기에 환불되지 않습니다)</span></li>
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 유튜브 정책 상 채널 양도 기간인 7일이 지나야 양도됩니다.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 채널 인도 후 최소 10일 동안 채널 운영 및 작업을 진행하지 않는것을 권장합니다.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 채널 인도 후 초반부터 유튜브 정책을 어긋나는 과도한 매크로 작업, 선정적 및 위법성 등은 자제해주시기 바랍니다.</li>
              <li className="flex items-start gap-2"><span className="text-blue-500 shrink-0">✓</span> 채널 인수 이후 해킹 또는 계정 및 채널 문제는 회원의 과실로 판단됩니다.</li>
            </ul>
          </div>
          {channel.publicLink && (<a href={channel.publicLink} target="_blank" rel="noreferrer" className="inline-block mt-4 text-blue-600 font-bold text-sm underline">🔗 채널 정보 직접 확인하기</a>)}
        </div>

        {/* 공통: 상세 정보 / 이미지 / 리뷰 */}
        <div className="mt-8 sm:mt-12 space-y-8 sm:space-y-12">
          <section className="space-y-4 sm:space-y-6 md:space-y-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 italic uppercase tracking-tighter underline underline-offset-8 sm:underline-offset-12 decoration-blue-500">채널 상세 정보 :</h2>
            <div className="text-gray-600 font-bold leading-relaxed whitespace-pre-wrap text-sm sm:text-base md:text-lg bg-gray-50/50 p-4 sm:p-6 md:p-12 rounded-2xl sm:rounded-3xl md:rounded-[56px] border border-gray-100 shadow-inner">
              {description}
            </div>
          </section>

          {attachedImages.length > 0 && (
            <section className="space-y-6 sm:space-y-12">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 italic uppercase tracking-tight flex items-center gap-3 sm:gap-4">
                <span className="w-1.5 sm:w-2 h-6 sm:h-10 bg-blue-600 rounded-full shadow-lg"></span> 상세이미지 :
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-10">
                {attachedImages.map((img, i) => (
                  <div key={i} className="group relative cursor-zoom-in" onClick={() => setSelectedImg(img)}>
                    <div className="rounded-2xl sm:rounded-3xl md:rounded-[40px] overflow-hidden bg-white border border-gray-100 shadow-xl transition-all group-hover:scale-[1.01]">
                      <img src={img} alt={`Attached ${i}`} className="w-full h-auto object-contain" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-6 sm:space-y-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-3 sm:gap-4">
              <span className="w-1.5 sm:w-2 h-6 sm:h-10 bg-orange-500 rounded-full shadow-lg"></span> 실제 구매 고객 만족도
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
              {allChannelReviews.length === 0 ? (
                <div className="col-span-full py-12 sm:py-24 text-center bg-gray-50 rounded-2xl sm:rounded-3xl md:rounded-[56px] border-4 border-dashed border-gray-100">
                  <p className="text-gray-300 font-black italic text-base sm:text-xl uppercase tracking-widest px-4">아직 작성된 리뷰가 없습니다.</p>
                </div>
              ) : allChannelReviews.map(rev => (
                <div key={rev.id} className="space-y-4 sm:space-y-6">
                  <div className="bg-white p-4 sm:p-6 md:p-10 rounded-2xl sm:rounded-3xl md:rounded-[40px] border border-gray-100 flex flex-col gap-3 sm:gap-6 shadow-sm hover:border-blue-200 transition-all group">
                     <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-[20px] overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rev.userId}`} className="w-full h-full object-cover" alt="p" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-base sm:text-lg">@{rev.author}</p>
                            <div className="flex text-yellow-400 text-xs sm:text-sm">{Array.from({length: 5}).map((_, i) => (<span key={i}>{i < rev.rating ? '★' : '☆'}</span>))}</div>
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-300 italic uppercase">{rev.date}</span>
                     </div>
                     <p className="text-sm sm:text-[17px] font-bold text-gray-600 leading-relaxed italic group-hover:text-gray-900 transition-colors">"{rev.content}"</p>
                     <p className="text-[9px] sm:text-[10px] font-black text-blue-400 italic"># {channels.find(c => c.id === rev.productId)?.title || '채널 매매'} 거래 완료 리뷰</p>
                  </div>
                  {rev.reply && (
                    <div className="ml-8 sm:ml-16 bg-blue-50/50 p-4 sm:p-8 rounded-xl sm:rounded-[40px] border border-blue-100 shadow-inner relative animate-in slide-in-from-left-4">
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rev.productId}`} className="w-full h-full object-cover" alt="expert" />
                          </div>
                          <div>
                            <p className="text-[14px] font-black text-blue-900 italic leading-none">Expert Reply <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1 not-italic">✓</span></p>
                            <p className="text-[9px] text-blue-300 font-bold uppercase">{rev.replyDate}</p>
                          </div>
                       </div>
                       <p className="text-[15px] font-black text-blue-800 leading-relaxed italic">"{rev.reply}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 모바일/태블릿 전용: 푸터·네비 위 고정 문의/구매 바 */}
      <div className="lg:hidden fixed bottom-24 left-0 right-0 z-[90] px-3 sm:px-4 py-3 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] safe-area-pb">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 gap-3">
          <button onClick={handleStartConsultation} className="py-4 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-50 active:scale-[0.98] transition-all">
            문의하기
          </button>
          <button onClick={handleBuyNow} disabled={isProcessing || !user} className={`py-4 bg-gray-900 text-white rounded-xl font-bold text-sm transition-all ${!isProcessing && user ? 'hover:bg-blue-600 active:scale-[0.98]' : 'opacity-60 cursor-not-allowed'}`}>
            {isProcessing ? '결제 중...' : '구매하기'}
          </button>
        </div>
      </div>

      {showBuyModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowBuyModal(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 p-6 sm:p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900">채널 구매</h3>
              <button type="button" onClick={() => setShowBuyModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="font-black text-gray-800 truncate">{channel.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1">₩ {channel.price.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-700">구매할 계정 입력 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={buyerAccountInput}
                onChange={e => setBuyerAccountInput(e.target.value)}
                placeholder="이전받을 계정 아이디를 입력하세요"
                className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-gray-800 outline-none focus:ring-4 focus:ring-blue-100 border border-gray-200"
                autoFocus
              />
              <p className="text-red-500 text-sm font-bold">※ 구매 즉시 계정 이전 작업이 진행되므로 환불이 불가합니다</p>
            </div>
            <button
              onClick={handleConfirmBuy}
              disabled={!buyerAccountInput.trim()}
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              결제하기
            </button>
          </div>
        </div>
      )}

      {selectedImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-pointer animate-in fade-in" onClick={() => setSelectedImg(null)}>
          <img src={selectedImg} className="max-w-full max-h-full rounded-xl sm:rounded-[32px] shadow-2xl object-contain animate-in zoom-in-95" alt="Full view" />
          <div className="absolute top-6 right-6 sm:top-10 sm:right-10 text-white font-black text-xl sm:text-2xl">✕</div>
        </div>
      )}

      {showActionModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200" onClick={() => setShowActionModal(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 p-6 sm:p-8 space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900">문의 · 구매</h3>
              <button type="button" onClick={() => setShowActionModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-video">
              <img src={channel.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
            <p className="text-xl font-black text-gray-900 whitespace-nowrap">₩ {channel.price.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setShowActionModal(false); handleStartConsultation(); }} className="py-4 bg-white border-2 border-gray-900 text-gray-900 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all">
                상담하기
              </button>
              <button onClick={() => { setShowActionModal(false); handleBuyNow(); }} disabled={isProcessing || !user} className={`py-4 bg-gray-900 text-white rounded-xl font-bold text-sm transition-all ${!isProcessing && user ? 'hover:bg-blue-600' : 'opacity-60 cursor-not-allowed'}`}>
                {isProcessing ? '결제 중...' : '구매하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelDetail;
