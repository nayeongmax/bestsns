
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile, SMMOrder, EbookProduct, Review, ChannelOrder, StoreOrder } from '../../types';

interface Props {
  user: UserProfile;
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  ebooks: EbookProduct[];
  onAddReview: (review: Review) => void;
}

type BuyerSubTab = 'sns' | 'channel' | 'store';

interface OrderItem {
  id: string;
  type: 'sns' | 'channel' | 'store';
  orderTime: string;
  productName: string;
  thumbnail: string;
  productId: string;
  sellerName: string;
  price: number;
  quantity: number;
  totalPrice: number;
  status: string;
  link?: string;
  initialCount?: number;
  remains?: number;
  storeType?: string; 
  downloadUrl?: string; 
}

const BuyerDashboard: React.FC<Props> = ({ user, smmOrders, channelOrders, storeOrders, ebooks, onAddReview }) => {
  const [activeTab, setActiveTab] = useState<BuyerSubTab>('sns');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 리뷰 모달 상태
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');

  // 구매 확정 및 리뷰 완료 목록
  const [confirmedList, setConfirmedList] = useState<string[]>(() => {
    const saved = localStorage.getItem('confirmed_ids_v4');
    return saved ? JSON.parse(saved) : [];
  });
  const [reviewedList, setReviewedList] = useState<string[]>(() => {
    const saved = localStorage.getItem('reviewed_ids_v4');
    return saved ? JSON.parse(saved) : [];
  });

  // --- 90일 다운로드 제한 및 다운로드 시간 표시용 상태 ---
  const [downloadStarts, setDownloadStarts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('download_start_times_v1');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('confirmed_ids_v4', JSON.stringify(confirmedList));
    localStorage.setItem('reviewed_ids_v4', JSON.stringify(reviewedList));
    localStorage.setItem('download_start_times_v1', JSON.stringify(downloadStarts));
  }, [confirmedList, reviewedList, downloadStarts]);

  // 데이터 통합 (실제 주문만 표시)
  const buyerOrders: OrderItem[] = useMemo(() => {
    const snsItems: OrderItem[] = smmOrders
      .filter(o => o.userId === user.id)
      .map(o => ({
        id: o.id, type: 'sns', orderTime: o.orderTime, productName: o.productName,
        thumbnail: '', productId: 'sns', sellerName: 'THEBESTSNS',
        price: o.sellingPrice, quantity: o.quantity, totalPrice: o.sellingPrice * o.quantity,
        status: o.status, link: o.link, initialCount: o.initialCount, remains: o.remains
      }));

    const channelItems: OrderItem[] = channelOrders
      .filter(o => o.userId === user.id)
      .map(o => ({
        id: o.id, type: 'channel', orderTime: o.orderTime, productName: o.productName,
        thumbnail: '', productId: o.productId, sellerName: o.platform || '채널',
        price: o.price, quantity: 1, totalPrice: o.price, status: o.status
      }));

    const storeItems: OrderItem[] = storeOrders
      .filter(o => o.userId === user.id)
      .map(o => ({
        id: o.id, type: 'store', orderTime: o.orderTime, productName: o.productName,
        thumbnail: '', productId: o.productId, sellerName: o.sellerNickname || '',
        price: o.price, quantity: 1, totalPrice: o.price, status: o.status, storeType: o.storeType
      }));

    return [...snsItems, ...channelItems, ...storeItems].filter(o => o.type === activeTab);
  }, [smmOrders, channelOrders, storeOrders, user.id, activeTab]);

  const handleConfirmOrder = (order: OrderItem, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setConfirmedList(prev => [...new Set([...prev, order.id])]);
    if (order.type !== 'sns') {
      setTargetOrder(order); setRating(5); setReviewContent(''); setIsReviewModalOpen(true);
    } else { alert('구매 확정이 완료되었습니다.'); }
  };

  const handleOpenReview = (order: OrderItem, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setTargetOrder(order); setRating(5); setReviewContent(''); setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = () => {
    if (!targetOrder || !reviewContent.trim()) return alert('리뷰 내용을 입력해 주세요.');
    const newReview: Review = {
      id: `rev_${Date.now()}`, productId: targetOrder.productId, userId: user.id, author: user.nickname,
      rating, content: reviewContent, date: new Date().toISOString().split('T')[0].replace(/-/g, '.')
    };
    onAddReview(newReview);
    setReviewedList(prev => [...new Set([...prev, targetOrder.id])]);
    setIsReviewModalOpen(false); setTargetOrder(null);
    alert('소중한 리뷰가 등록되었습니다!');
  };

  const handleDownloadClick = (orderId: string) => {
    if (!downloadStarts[orderId]) {
      const updated = { ...downloadStarts, [orderId]: Date.now() };
      setDownloadStarts(updated);
      alert('다운로드가 시작되었습니다. 지금부터 90일 동안만 다운로드가 가능합니다.');
    }
  };

  const isDownloadExpired = (orderId: string) => {
    const startTime = downloadStarts[orderId];
    if (!startTime) return false;
    const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
    return Date.now() - startTime > ninetyDaysInMs;
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => alert('복사되었습니다.'));
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${mi}:${s}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex gap-2 p-2 bg-gray-100/50 rounded-[32px] w-full shadow-inner">
        {[ 
          { id: 'sns', label: 'SNS 활성화 내역' }, 
          { id: 'channel', label: '채널 구매 내역' }, 
          { id: 'store', label: 'N잡 스토어 내역' } 
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => { setActiveTab(tab.id as any); setExpandedId(null); }} 
            className={`flex-1 py-4 rounded-[24px] text-[15px] font-black transition-all duration-300 ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600 hover:bg-white/30'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sns' ? (
        <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <tbody className="divide-y divide-gray-50">
                {buyerOrders.map(order => (
                  <React.Fragment key={order.id}>
                    <tr onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} className={`transition-all group cursor-pointer ${expandedId === order.id ? 'bg-[#2D3E5E] text-white' : 'hover:bg-gray-50/50 text-gray-700'}`}>
                      <td className="py-5 px-6 w-32 font-black text-[14px] flex items-center gap-2">
                        <span className="opacity-50">≡</span> {order.id}
                      </td>
                      <td className="py-5 px-4 w-[280px] truncate text-[13px] font-bold text-blue-400">
                        {order.link}
                        <button onClick={(e) => copyToClipboard(order.link || '', e)} className="ml-2 bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black">복사하기</button>
                      </td>
                      <td className="py-5 px-4 font-black text-[14px] italic">{order.productName} - {order.price.toLocaleString()}원</td>
                      <td className="py-5 px-4 text-center">
                        <span className={`px-3 py-1 rounded text-[11px] font-black ${expandedId === order.id ? 'bg-white text-[#2D3E5E]' : 'bg-gray-100 text-gray-400'}`}>{order.status}</span>
                      </td>
                      <td className="py-5 px-6 text-right text-[13px] font-bold italic opacity-80">{order.orderTime} <span className="ml-2">{expandedId === order.id ? '▲' : '▼'}</span></td>
                    </tr>
                    {expandedId === order.id && (
                      <tr className="bg-[#F8FAFC] animate-in slide-in-from-top-1">
                        <td colSpan={5} className="p-8 border-b border-gray-100">
                          <div className="max-w-4xl space-y-3 text-[14px] font-bold text-gray-600">
                             <div className="flex items-center gap-2"><span>주문 번호</span> <span className="text-gray-900 font-black">{order.id}</span> <button onClick={(e) => copyToClipboard(order.id, e)} className="text-blue-500">📋</button></div>
                             <div className="flex gap-2"><span>서비스</span> <span className="text-gray-900">{order.productName}</span></div>
                             <div className="flex gap-2"><span>링크</span> <a href={order.link} target="_blank" rel="noreferrer" className="text-blue-500 underline break-all">{order.link}</a></div>
                             <div className="flex gap-2"><span>주문시간</span> <span className="text-gray-900">{order.orderTime}</span></div>
                             <div className="flex gap-2"><span>비용</span> <span className="text-gray-900">{order.totalPrice.toLocaleString()}P</span></div>
                             <div className="flex gap-2"><span>수량</span> <span className="text-gray-900">{order.quantity}</span></div>
                             <div className="flex gap-2"><span>최초수량</span> <span className="text-orange-600">{order.initialCount || 0}</span></div>
                             <div className="flex gap-2"><span>남은 수량</span> <span className="text-gray-900">{order.remains || 0}</span></div>
                             <div className="pt-6 flex justify-end">
                                <button onClick={(e) => handleConfirmOrder(order, e)} className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${confirmedList.includes(order.id) ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-black shadow-lg'}`}>{confirmedList.includes(order.id) ? '확정 완료 ✓' : '구매 확정'}</button>
                             </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {buyerOrders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
              <p className="text-gray-300 font-black italic">내역이 존재하지 않습니다.</p>
            </div>
          ) : (
            buyerOrders.map(order => {
              const expired = isDownloadExpired(order.id);
              const downloadTime = downloadStarts[order.id];
              
              return (
                <div key={order.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-10 hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-8 flex-1 w-full">
                    <div className="w-24 h-24 bg-gray-50 rounded-[28px] flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm shrink-0">
                      {order.thumbnail ? <img src={order.thumbnail} className="w-full h-full object-cover" alt="t" /> : <span className="text-3xl">📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase italic">주문번호: {order.id}</span>
                          <span className="bg-gray-50 text-gray-400 px-2.5 py-0.5 rounded-full text-[9px] font-black italic uppercase">{order.status}</span>
                       </div>
                       <Link to={`/${order.type}s/${order.productId}`} className="text-[19px] font-black text-gray-900 block truncate hover:text-blue-600 transition-colors leading-tight mb-1.5">{order.productName}</Link>
                       
                       <div className="flex items-center gap-3 text-[13px] text-gray-400 font-bold mb-1.5 flex-wrap">
                          <span className="text-gray-900 font-black text-[15px]">₩{order.totalPrice.toLocaleString()}</span>
                          <span className="opacity-30">|</span>
                          <div className="flex items-center gap-1.5">
                             <span className="text-[10px] font-black text-gray-300 uppercase italic">주문:</span>
                             <span>{order.orderTime}</span>
                          </div>
                          {downloadTime && (
                            <>
                              <span className="opacity-30">|</span>
                              <div className="flex items-center gap-1.5 text-blue-500">
                                 <span className="text-[10px] font-black uppercase italic">다운로드:</span>
                                 <span className="font-black italic">{formatDateTime(downloadTime)}</span>
                              </div>
                            </>
                          )}
                       </div>

                       {order.type === 'store' && (
                         <p className="text-[12px] font-bold text-red-500 whitespace-nowrap overflow-hidden text-ellipsis italic">
                           ※ 전자책/자료·템플릿 상품의 경우는 다운로드 시 환불이 불가하며, 7일 후 자동으로 구매가 확정됩니다.
                         </p>
                       )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center lg:items-end gap-3 min-w-[200px] shrink-0">
                    {order.downloadUrl && (
                      <div className="flex flex-col items-center gap-2 w-full">
                         <span className="bg-orange-50 text-orange-600 px-5 py-1.5 rounded-full text-[13px] font-black italic shadow-sm animate-pulse flex items-center gap-1 border border-orange-100">
                           ⚡ 90일 이내 다운로드 가능
                         </span>
                         
                         {expired ? (
                           <div className="w-full px-8 py-4 bg-gray-200 text-gray-400 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 border border-gray-100 cursor-not-allowed">
                             🚫 다운로드 기간 만료
                           </div>
                         ) : (
                           <a 
                             href={order.downloadUrl} 
                             download 
                             onClick={() => handleDownloadClick(order.id)}
                             className="w-full px-8 py-4 bg-[#00B06B] text-white rounded-[20px] font-black text-[14px] shadow-xl hover:bg-black transition-all italic flex items-center justify-center gap-2"
                           >
                             📥 파일 다운로드
                           </a>
                         )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 w-full">
                      {!confirmedList.includes(order.id) ? (
                        <button onClick={(e) => handleConfirmOrder(order, e)} className="flex-1 px-8 py-4 bg-gray-900 text-white rounded-[20px] font-black text-[13px] shadow-lg hover:bg-blue-600 transition-all italic uppercase tracking-tighter">구매 확정</button>
                      ) : (
                        reviewedList.includes(order.id) ? (
                          <button className="flex-1 px-8 py-4 bg-gray-100 text-gray-400 rounded-[20px] font-black text-[13px] italic cursor-default border border-gray-100">리뷰 완료 ✓</button>
                        ) : (
                          <button onClick={(e) => handleOpenReview(order, e)} className="flex-1 px-8 py-4 bg-orange-500 text-white rounded-[20px] font-black text-[13px] shadow-lg hover:bg-black transition-all italic animate-bounce uppercase tracking-tighter">리뷰 쓰기</button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {isReviewModalOpen && targetOrder && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[48px] p-10 md:p-14 shadow-2xl space-y-10 animate-in zoom-in-95">
             <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-gray-900 italic uppercase">Write a Review</h3>
                <p className="text-sm font-bold text-gray-400">서비스는 어떠셨나요? 소중한 의견을 들려주세요.</p>
             </div>

             <div className="bg-gray-50 p-6 rounded-[32px] flex items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">📦</div>
                <div>
                   <p className="text-[11px] font-black text-blue-500 uppercase italic">Ordered Product</p>
                   <p className="text-[16px] font-black text-gray-800 line-clamp-1">{targetOrder.productName}</p>
                </div>
             </div>

             <div className="flex flex-col items-center gap-4">
                <div className="flex gap-3">
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button 
                        key={star} 
                        onClick={() => setRating(star)} 
                        className={`text-4xl transition-all hover:scale-125 ${star <= rating ? 'text-yellow-400 drop-shadow-md' : 'text-gray-200'}`}
                     >
                       ★
                     </button>
                   ))}
                </div>
                <span className="text-lg font-black text-gray-900 italic">{rating} / 5</span>
             </div>

             <textarea 
                value={reviewContent} 
                onChange={(e) => setReviewContent(e.target.value)}
                placeholder="전문가의 서비스 품질, 속도, 친절도 등을 상세하게 작성해 주시면 다른 구매자들에게 큰 도움이 됩니다."
                rows={6}
                className="w-full p-8 bg-gray-50 border-none rounded-[32px] font-bold text-gray-700 outline-none shadow-inner focus:ring-4 focus:ring-blue-50 transition-all resize-none leading-relaxed"
             />

             <div className="flex gap-4">
                <button onClick={() => { setIsReviewModalOpen(false); setTargetOrder(null); }} className="flex-1 py-6 bg-gray-100 text-gray-400 rounded-[24px] font-black text-lg hover:bg-gray-200 transition-all uppercase italic">Cancel</button>
                <button onClick={handleReviewSubmit} className="flex-[2] py-6 bg-blue-600 text-white rounded-[24px] font-black text-lg shadow-xl shadow-blue-100 hover:bg-black transition-all uppercase italic tracking-widest">Submit Review</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerDashboard;
