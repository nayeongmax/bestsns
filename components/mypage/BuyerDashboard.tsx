
import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile, SMMOrder, EbookProduct, Review, ChannelOrder, StoreOrder } from '../../types';
import { getPartTimeJobRequests, setPartTimeJobRequests, getPartTimeTasks, processAutoApprovals } from '@/constants';
import type { PartTimeTask } from '../../types';

interface Props {
  user: UserProfile;
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  ebooks: EbookProduct[];
  onAddReview: (review: Review) => void;
  initialSubTab?: 'sns' | 'channel' | 'store' | 'alba';
}

type BuyerSubTab = 'sns' | 'channel' | 'store' | 'alba';

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

const BuyerDashboard: React.FC<Props> = ({ user, smmOrders, channelOrders, storeOrders, ebooks, onAddReview, initialSubTab }) => {
  const [activeTab, setActiveTab] = useState<BuyerSubTab>(initialSubTab || 'sns');
  const [jobRequests, setJobRequests] = useState(() => getPartTimeJobRequests());
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [pgModal, setPgModal] = useState<{ jrId: string; amount: number; title: string } | null>(null);
  const [workConfirmModal, setWorkConfirmModal] = useState<PartTimeTask | null>(null);

  useEffect(() => {
    if (activeTab === 'alba') processAutoApprovals();
    setJobRequests(getPartTimeJobRequests());
    setTasks(getPartTimeTasks());
  }, [activeTab]);

  const myJobRequests = useMemo(() =>
    jobRequests.filter((jr) => jr.applicantUserId === user.id),
    [jobRequests, user.id]
  );
  const myApprovedRequests = useMemo(() =>
    myJobRequests.filter((jr) => jr.status === 'pending' && !jr.paid),
    [myJobRequests]
  );
  const myRejectedRequests = useMemo(() =>
    myJobRequests.filter((jr) => jr.status === 'not_selected'),
    [myJobRequests]
  );
  const myPendingReviewRequests = useMemo(() =>
    myJobRequests.filter((jr) => jr.status === 'pending_review'),
    [myJobRequests]
  );
  const myPaidRequests = useMemo(() =>
    myJobRequests.filter((jr) => jr.paid),
    [myJobRequests]
  );

  const myTasksAsApplicant = useMemo(() =>
    tasks.filter((t) => t.applicantUserId === user.id),
    [tasks, user.id]
  );

  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) =>
    (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();
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

    const base = [...snsItems, ...channelItems, ...storeItems];
    return activeTab === 'alba' ? base : base.filter(o => o.type === activeTab);
  }, [smmOrders, channelOrders, storeOrders, user.id, activeTab]);

  const handlePayJobRequest = (jr: { id: string; adAmount: number; fee: number; title: string }) => {
    const total = jr.adAmount + jr.fee;
    setPgModal({ jrId: jr.id, amount: total, title: jr.title });
  };

  const confirmPgPayment = () => {
    if (!pgModal) return;
    const next = jobRequests.map((r) =>
      r.id === pgModal.jrId ? { ...r, paid: true } : r
    );
    setPartTimeJobRequests(next);
    setJobRequests(next);
    setPgModal(null);
    alert('결제가 완료되었습니다. 운영자가 곧 연락드리겠습니다.');
  };

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
          { id: 'store', label: 'N잡 스토어 내역' },
          { id: 'alba', label: '알바의뢰' }
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

      {activeTab === 'alba' ? (
        <div className="space-y-8">
          {myPendingReviewRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">검토 대기</h4>
              {myPendingReviewRequests.map((jr) => (
                <div key={jr.id} className="bg-amber-50/50 p-6 rounded-[32px] shadow-sm border border-amber-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                    <p className="text-gray-500 mt-2 line-clamp-2">{jr.workContent}</p>
                    <span className="inline-block mt-3 px-3 py-1 rounded-lg bg-amber-200 text-amber-800 text-xs font-black">운영자 검토 중</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link to="/part-time/request" state={{ editJobRequest: jr, fromAlba: true }} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">
                      수정하기
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('정말 삭제하시겠습니까?')) return;
                        const next = jobRequests.filter((r) => r.id !== jr.id);
                        setPartTimeJobRequests(next);
                        setJobRequests(next);
                        alert('삭제되었습니다.');
                      }}
                      className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {myRejectedRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">거절 · 수정 필요</h4>
              {myRejectedRequests.map((jr) => (
                <div key={jr.id} className="bg-red-50/50 p-6 rounded-[32px] shadow-sm border border-red-100 flex flex-col gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                    <p className="text-gray-500 mt-2 line-clamp-2">{jr.workContent}</p>
                    {jr.rejectReason && (
                      <div className="mt-3 p-3 rounded-xl bg-white border border-red-100">
                        <p className="text-xs font-black text-red-600 uppercase">거절 사유</p>
                        <p className="text-gray-800 font-bold mt-1">{jr.rejectReason}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link to="/part-time/request" state={{ editJobRequest: jr, fromAlba: true }} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">
                      수정하기
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm('정말 삭제하시겠습니까?')) return;
                        const next = jobRequests.filter((r) => r.id !== jr.id);
                        setPartTimeJobRequests(next);
                        setJobRequests(next);
                        alert('삭제되었습니다.');
                      }}
                      className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {myApprovedRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">승인 완료 · 결제 대기</h4>
              {myApprovedRequests.map((jr) => (
                <div key={jr.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-10">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                    <p className="text-gray-500 mt-2 line-clamp-2">{jr.workContent}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      <span className="font-bold text-gray-700">{jr.unitPrice != null && jr.quantity != null ? `단가 ${jr.unitPrice.toLocaleString()}원 × ${jr.quantity}개` : `광고금액: ${jr.adAmount.toLocaleString()}원`}</span>
                      <span className="font-bold text-gray-700">수수료: {jr.fee.toLocaleString()}원</span>
                      <span className="font-black text-emerald-600">총 결제: {(jr.adAmount + jr.fee).toLocaleString()}원</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePayJobRequest(jr)}
                    className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shrink-0"
                  >
                    결제하기
                  </button>
                </div>
              ))}
            </div>
          )}

          {myTasksAsApplicant.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">의뢰 진행 현황</h4>
              {myTasksAsApplicant.map((t) => {
                const selectedCount = t.applicants.filter((a) => a.selected).length;
                const selectedWithLink = t.applicants.filter((a) => a.selected && hasWorkLink(a));
                const hasDelivery = selectedWithLink.some((a) => a.deliveryAt);
                const allPaid = selectedWithLink.length > 0 && selectedWithLink.every((a) => t.paidUserIds?.includes(a.userId));
                const canShowConfirm = selectedWithLink.length > 0;
                const statusLabel = t.applicants.length === 0 ? '모집중' : selectedCount === 0 ? '모집중' : selectedWithLink.length === 0 ? '선정완료' : allPaid ? '대금지급 완료' : hasDelivery ? '3일 이내 자동확정' : '검수중';
                return (
                  <div key={t.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-gray-900 text-lg">{t.title}</h4>
                        <p className="text-gray-500 mt-2 line-clamp-2">{t.description}</p>
                        <p className="text-sm text-gray-500 mt-2">작업기간: {t.workPeriod?.start ?? '-'} ~ {t.workPeriod?.end ?? '-'}</p>
                        <span className={`inline-block mt-3 px-3 py-1 rounded-lg text-xs font-black ${
                          statusLabel === '모집중' ? 'bg-gray-200 text-gray-700' :
                          statusLabel === '선정완료' ? 'bg-blue-100 text-blue-700' :
                          statusLabel === '검수중' ? 'bg-amber-100 text-amber-700' :
                          statusLabel === '3일 이내 자동확정' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>{statusLabel}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {canShowConfirm && (
                          <button
                            onClick={() => setWorkConfirmModal(t)}
                            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all"
                          >
                            결과물 확인
                          </button>
                        )}
                        <button
                          onClick={() => setWorkConfirmModal(t)}
                          className="px-6 py-3 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-700 transition-all"
                        >
                          작업확정서
                        </button>
                        <Link
                          to="/chat"
                          state={{ targetUser: { id: 'admin', nickname: '플랫폼 운영자', profileImage: '' } } as any}
                          className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-black hover:bg-gray-100 transition-all"
                        >
                          문의요청
                        </Link>
                      </div>
                    </div>
                    {canShowConfirm && selectedWithLink.length > 0 && (
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-black text-gray-500 uppercase mb-2">작업 링크</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedWithLink.flatMap((a) => (a.workLinks ?? (a.workLink ? [a.workLink] : []))).filter(Boolean).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-sm hover:underline break-all">{url}</a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {myJobRequests.length === 0 && myTasksAsApplicant.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
              <p className="text-gray-300 font-black italic">알바의뢰 내역이 없습니다.</p>
              <Link to="/part-time/request" className="inline-block mt-4 text-emerald-600 font-black hover:underline">작업의뢰 신청하러 가기 →</Link>
            </div>
          )}
        </div>
      ) : activeTab === 'sns' ? (
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

      {workConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[48px] p-10 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-gray-900">📂 프로젝트 작업확정서</h3>
              <button onClick={() => setWorkConfirmModal(null)} className="text-gray-400 hover:text-gray-800 text-2xl font-bold">×</button>
            </div>
            <p className="text-xs text-gray-500">본 문서의 내용은 이용약관에 의거하여 결제 시점부터 법적 효력이 발생합니다.</p>
            <div className="space-y-6 text-sm">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">1. 계약 기본 정보</p>
                <p className="font-bold text-gray-800">프로젝트: {workConfirmModal.title}</p>
                <p className="text-gray-600 mt-1">재위탁 수행자: {workConfirmModal.applicants.filter((a) => a.selected).map((a) => a.nickname).join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">2. 업무 범위 및 단가</p>
                <p className="font-bold text-gray-800">과업 내용: {workConfirmModal.description}</p>
                <p className="text-gray-600 mt-1">최종 납기: {workConfirmModal.workPeriod?.end ?? '-'}</p>
                <p className="text-emerald-600 font-black mt-1">총 계약 금액: ₩{workConfirmModal.reward.toLocaleString()} (VAT 포함)</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">3. 취소 및 환불 규정</p>
                <p className="text-gray-700 leading-relaxed">용역 제공 개시 전: 전액 취소 및 환불 가능.<br />용역 제공 개시 후: 가분적 용역은 미수행 범위 환불 가능, 불가분적 용역은 원칙 환불 불가.</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">4. 검수 및 A/S 규정</p>
                <p className="text-gray-700 leading-relaxed">A/S 요청 기한: 결과물 전달일로부터 3일 이내. 해당 기간 내 이의없으면 자동 승인 및 대금 지급.</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">5. 강력 법적 조치</p>
                <p className="text-gray-700 leading-relaxed">직거래 시도 시 거래액 10배 위약벌 청구 및 영구 제명. 게시글/대화 기록 임의 삭제 불가.</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-2">작업 링크 (결과물)</p>
                <div className="space-y-2 mt-2">
                  {workConfirmModal.applicants
                    .filter((a) => a.selected && hasWorkLink(a))
                    .flatMap((a) => (a.workLinks ?? (a.workLink ? [a.workLink] : [])))
                    .filter(Boolean)
                    .map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 font-bold hover:underline break-all">{link}</a>
                    ))}
                  {!workConfirmModal.applicants.some((a) => a.selected && hasWorkLink(a)) && <p className="text-gray-400">제출 대기 중</p>}
                </div>
              </div>
            </div>
            <button onClick={() => setWorkConfirmModal(null)} className="w-full py-4 rounded-xl bg-gray-900 text-white font-black">확인</button>
          </div>
        </div>
      )}

      {pgModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[48px] p-10 shadow-2xl space-y-8 text-center">
            <h3 className="text-2xl font-black text-gray-900">PG 결제</h3>
            <div>
              <p className="text-gray-500 font-bold">{pgModal.title}</p>
              <p className="text-3xl font-black text-emerald-600 mt-2">{(pgModal.amount).toLocaleString()} P</p>
              <p className="text-xs text-gray-400 mt-1">(실제 PG 연동 시 결제창으로 이동합니다)</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setPgModal(null)} className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-700 font-black">
                취소
              </button>
              <button onClick={confirmPgPayment} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">
                결제 완료
              </button>
            </div>
          </div>
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
