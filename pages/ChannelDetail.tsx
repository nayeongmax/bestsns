
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChannelProduct, WishlistItem, Review, UserProfile } from '../types';

interface Props {
  channels: ChannelProduct[];
  wishlist: WishlistItem[];
  onToggleWishlist: (item: WishlistItem) => void;
  reviews: Review[];
  members: UserProfile[];
}

const ChannelDetail: React.FC<Props> = ({ channels, wishlist, onToggleWishlist, reviews, members }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  
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
    if (window.confirm('해당 채널을 즉시 구매하시겠습니까?\n결제 페이지로 이동합니다.')) {
      navigate('/payment/point', { state: { amount: channel.price, product: channel } });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-20 px-4 lg:px-8 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 transition-colors group">
        <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        뒤로가기
      </button>

      <div className="bg-white rounded-[48px] shadow-sm border border-gray-100 p-8 md:p-14">
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="lg:w-[450px] shrink-0">
            <img src={channel.thumbnail} alt={channel.title} className="w-full aspect-square object-cover rounded-[32px] shadow-xl shadow-blue-50 border border-gray-50" />
          </div>

          <div className="flex-1 space-y-10">
            <div>
              <div className="flex justify-between items-start gap-6">
                <h1 className="text-4xl font-black text-gray-900 mb-4 leading-tight italic tracking-tighter">{channel.title}</h1>
                <button onClick={() => onToggleWishlist({ type: 'channel', data: channel })} className={`p-4 border-2 rounded-2xl font-black transition-all shadow-sm shrink-0 active:scale-90 ${isWishlisted ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white border-gray-100 text-gray-400 hover:text-red-500'}`}><svg className="w-6 h-6" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg></button>
              </div>
              <div className="flex items-center gap-4 mb-6">
                 <div className="flex text-yellow-400 text-xl">{Array.from({length: 5}).map((_, i) => (<span key={i}>{i < Math.floor(Number(reviewStats.avg)) ? '★' : '☆'}</span>))}</div>
                 <span className="text-2xl font-black text-gray-900">{reviewStats.avg}</span>
                 <span className="text-sm font-bold text-gray-400 mt-1">(누적 거래 만족도: {reviewStats.total}건)</span>
              </div>
              {channel.publicLink && (<a href={channel.publicLink} target="_blank" rel="noreferrer" className="text-blue-600 font-black text-lg flex items-center gap-2 underline decoration-2 underline-offset-4 italic">🔗 채널 정보 직접 확인하기 (클릭)</a>)}
            </div>

            <div className="bg-gray-50/50 rounded-[40px] p-10 grid grid-cols-1 md:grid-cols-3 gap-10 shadow-inner border border-gray-100">
              <div className="flex flex-col items-center gap-2"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-[0.2em]">구독자수</span><span className="text-3xl font-black text-gray-800 tracking-tight">{channel.subscribers.toLocaleString()}명</span></div>
              <div className="flex flex-col items-center gap-2 border-x border-gray-200"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-[0.2em]">월 평균 수입</span><span className="text-3xl font-black text-green-600 tracking-tight">${income.toLocaleString()}</span></div>
              <div className="flex flex-col items-center gap-2"><span className="text-[12px] font-black text-gray-400 uppercase italic tracking-[0.2em]">월 평균 지출</span><span className="text-3xl font-black text-red-400 tracking-tight">${expense.toLocaleString()}</span></div>
            </div>

            <div className="space-y-8">
              <div className="flex flex-col md:flex-row items-baseline justify-between gap-6 pb-6 border-b border-gray-100">
                <div className="text-6xl font-black text-gray-900 italic tracking-tighter leading-none">₩ {channel.price.toLocaleString()}</div>
                <div className="flex gap-4 w-full md:w-auto">
                   <button onClick={handleStartConsultation} className="flex-1 md:w-48 py-6 bg-white border-2 border-gray-900 text-gray-900 rounded-[24px] font-black text-lg hover:bg-gray-50 transition-all shadow-lg active:scale-95 italic uppercase">상담하기</button>
                   <button onClick={handleBuyNow} className="flex-1 md:w-64 py-6 bg-gray-900 text-white rounded-[24px] font-black text-lg hover:bg-blue-600 transition-all shadow-2xl shadow-blue-100 active:scale-95 italic uppercase">즉시구매</button>
                </div>
              </div>
              
              <div className="bg-[#f4f9ff] p-10 rounded-[36px] border border-[#dce9ff] relative overflow-hidden group shadow-sm">
                <div className="absolute right-[-20px] top-[-20px] opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                  <svg className="w-64 h-64 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
                </div>
                <div className="relative z-10 space-y-6">
                  <p className="text-[#2b6cb0] text-xl font-black italic tracking-tight uppercase">THEBESTSNS Escrow Protection 가동 중</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[#4a5568] text-[15px] font-bold italic">
                      <span className="text-blue-500 font-black">✓</span>
                      <span>7일 후, 판매자는 에스크로 대리인에게 주요 소유권을 양도합니다.</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#4a5568] text-[15px] font-bold italic">
                      <span className="text-blue-500 font-black">✓</span>
                      <span>에스크로 대리인은 모든 사항을 확인하고 다른 관리자들을 해임합니다.</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#4a5568] text-[15px] font-bold italic">
                      <span className="text-blue-500 font-black">✓</span>
                      <span>매도인의 확인 후, 에스크로 대리인은 매수인에게 소유권을 양도합니다.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 space-y-24">
          <section className="space-y-10">
            <h2 className="text-3xl font-black text-gray-900 italic uppercase tracking-tighter underline underline-offset-12 decoration-blue-500">채널 상세 정보 :</h2>
            <div className="text-gray-600 font-bold leading-relaxed whitespace-pre-wrap text-lg bg-gray-50/50 p-12 rounded-[56px] border border-gray-100 shadow-inner">
              {description}
            </div>
          </section>

          {attachedImages.length > 0 && (
            <section className="space-y-12">
              <h2 className="text-3xl font-black text-gray-900 italic uppercase tracking-tight flex items-center gap-4">
                <span className="w-2 h-10 bg-blue-600 rounded-full shadow-lg"></span> 상세이미지 :
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {attachedImages.map((img, i) => (
                  <div key={i} className="group relative cursor-zoom-in" onClick={() => setSelectedImg(img)}>
                    <div className="rounded-[40px] overflow-hidden bg-white border border-gray-100 shadow-xl transition-all group-hover:scale-[1.01]">
                      <img src={img} alt={`Attached ${i}`} className="w-full h-auto object-contain" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-12">
            <h2 className="text-3xl font-black text-gray-900 italic uppercase tracking-tighter flex items-center gap-4">
              <span className="w-2 h-10 bg-orange-500 rounded-full shadow-lg"></span> 실제 구매 고객 만족도
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {allChannelReviews.length === 0 ? (
                <div className="col-span-full py-24 text-center bg-gray-50 rounded-[56px] border-4 border-dashed border-gray-100">
                  <p className="text-gray-300 font-black italic text-xl uppercase tracking-widest">아직 작성된 리뷰가 없습니다.</p>
                </div>
              ) : allChannelReviews.map(rev => (
                <div key={rev.id} className="space-y-6">
                  <div className="bg-white p-10 rounded-[40px] border border-gray-100 flex flex-col gap-6 shadow-sm hover:border-blue-200 transition-all group">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-[20px] overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rev.userId}`} className="w-full h-full object-cover" alt="p" />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 text-lg">@{rev.author}</p>
                            <div className="flex text-yellow-400 text-sm">{Array.from({length: 5}).map((_, i) => (<span key={i}>{i < rev.rating ? '★' : '☆'}</span>))}</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-gray-300 italic uppercase">{rev.date}</span>
                     </div>
                     <p className="text-[17px] font-bold text-gray-600 leading-relaxed italic group-hover:text-gray-900 transition-colors">"{rev.content}"</p>
                     <p className="text-[10px] font-black text-blue-400 italic"># {channels.find(c => c.id === rev.productId)?.title || '채널 매매'} 거래 완료 리뷰</p>
                  </div>
                  {rev.reply && (
                    <div className="ml-16 bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 shadow-inner relative animate-in slide-in-from-left-4">
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

      {selectedImg && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-8 cursor-pointer animate-in fade-in" onClick={() => setSelectedImg(null)}>
          <img src={selectedImg} className="max-w-full max-h-full rounded-[32px] shadow-2xl object-contain animate-in zoom-in-95" alt="Full view" />
          <div className="absolute top-10 right-10 text-white font-black text-2xl">✕</div>
        </div>
      )}
    </div>
  );
};

export default ChannelDetail;
