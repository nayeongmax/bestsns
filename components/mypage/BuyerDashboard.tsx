import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfile, SMMOrder, EbookProduct, Review, ChannelOrder, StoreOrder } from '@/types';
import { fetchOrderBuyerFlags, upsertOrderBuyerFlag, upsertStoreOrder, type OrderBuyerFlag } from '../../storeDb';
import { upsertChannelOrder } from '../../channelDb';
import { fetchPointTransactions, type PointTransaction } from '../../pointDb';

interface Props {
  user: UserProfile;
  smmOrders: SMMOrder[];
  channelOrders: ChannelOrder[];
  storeOrders: StoreOrder[];
  setStoreOrders?: React.Dispatch<React.SetStateAction<StoreOrder[]>>;
  setChannelOrders?: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
  ebooks: EbookProduct[];
  onAddReview: (review: Review) => void;
  initialSubTab?: 'sns' | 'channel' | 'store';
}

type BuyerSubTab = 'sns' | 'channel' | 'store';
type SnsSubTab = 'orders' | 'charge' | 'usage';

type PointChargeItem = PointTransaction;

interface PointUsageItem {
  id: string;
  description: string;
  amount: number;
  date: string;
}

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

const BuyerDashboard: React.FC<Props> = ({ user, smmOrders, channelOrders, storeOrders, setStoreOrders, setChannelOrders, ebooks, onAddReview, initialSubTab }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BuyerSubTab>(() => initialSubTab ?? 'sns');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [snsSubTab, setSnsSubTab] = useState<SnsSubTab>('orders');

  // 리뷰 모달 상태
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [targetOrder, setTargetOrder] = useState<OrderItem | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');

  // 구매 확정/리뷰/다운로드 시작 — DB (order_buyer_flags) 연동
  const [flags, setFlags] = useState<OrderBuyerFlag[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    fetchOrderBuyerFlags(user.id).then(setFlags).catch((e) => console.warn('order_buyer_flags 로드:', e));
  }, [user?.id]);

  const confirmedList = useMemo(() => flags.filter((f) => f.confirmedAt).map((f) => f.orderId), [flags]);
  const reviewedList = useMemo(() => flags.filter((f) => f.reviewedAt).map((f) => f.orderId), [flags]);
  const downloadStarts = useMemo(
    () =>
      flags.reduce<Record<string, number>>((acc, f) => {
        if (f.downloadStartedAt) acc[f.orderId] = new Date(f.downloadStartedAt).getTime();
        return acc;
      }, {}),
    [flags]
  );

  // 환불 처리 로컬 상태 (환불된 주문 id 추적)
  const [refundedOrderIds, setRefundedOrderIds] = useState<Set<string>>(new Set());
  const [refundLoading, setRefundLoading] = useState<string | null>(null);

  // 포인트 충전 내역 (Supabase DB)
  const [chargeItems, setChargeItems] = useState<PointChargeItem[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    fetchPointTransactions(user.id, 'charge').then(setChargeItems).catch((e) => console.warn('충전 내역 로드 실패:', e));
  }, [user?.id]);

  // 포인트 사용 내역 (주문에서 파생)
  const usageItems: PointUsageItem[] = useMemo(() => {
    const sns = smmOrders
      .filter(o => o.userId === user.id && o.status !== '주문취소')
      .map(o => ({ id: o.id, description: `SNS 활성화 사용 (${o.productName})`, amount: o.sellingPrice * o.quantity, date: o.orderTime }));
    const ch = channelOrders
      .filter(o => o.userId === user.id)
      .map(o => ({ id: o.id, description: `채널 구매 (${o.productName})`, amount: o.price, date: typeof o.orderTime === 'string' ? o.orderTime : new Date(o.orderTime).toISOString() }));
    const st = storeOrders
      .filter(o => o.userId === user.id)
      .map(o => ({ id: o.id, description: `N잡스토어 구매 (${o.productName})`, amount: o.price, date: typeof o.orderTime === 'string' ? o.orderTime : new Date(o.orderTime).toISOString() }));
    return [...sns, ...ch, ...st].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [smmOrders, channelOrders, storeOrders, user.id]);

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
      .map(o => {
        const ebook = ebooks.find(e => e.id === o.productId);
        const isDownloadType = o.storeType === 'ebook' || o.storeType === 'template';
        // 전자책/템플릿: ebook에 fileUrl이 있으면 사용, 없으면 '#' (다운로드 시작 시간만 기록)
        const downloadUrl = isDownloadType ? ((ebook as any)?.fileUrl || '#') : undefined;
        return {
          id: o.id, type: 'store', orderTime: o.orderTime, productName: o.productName,
          thumbnail: ebook?.thumbnail || '', productId: o.productId, sellerName: o.sellerNickname || '',
          price: o.price, quantity: 1, totalPrice: o.price, status: o.status, storeType: o.storeType,
          downloadUrl,
        };
      });

    const base = [...snsItems, ...channelItems, ...storeItems];
    return base
      .filter(o => o.type === activeTab)
      .sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
  }, [smmOrders, channelOrders, storeOrders, user.id, activeTab]);

  const handleConfirmOrder = (order: OrderItem, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const now = new Date().toISOString();
    upsertOrderBuyerFlag(order.id, user.id, order.type, { confirmedAt: now })
      .then(() => setFlags((prev) => {
        const idx = prev.findIndex((f) => f.orderId === order.id && f.orderType === order.type);
        if (idx >= 0) return prev.map((f, i) => (i === idx ? { ...f, confirmedAt: now } : f));
        return [...prev, { orderId: order.id, orderType: order.type, confirmedAt: now, reviewedAt: null, downloadStartedAt: null }];
      }))
      .catch((err) => console.warn('구매확정 저장:', err));
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
    const now = new Date().toISOString();
    upsertOrderBuyerFlag(targetOrder.id, user.id, targetOrder.type, { reviewedAt: now })
      .then(() => setFlags((prev) => {
        const idx = prev.findIndex((f) => f.orderId === targetOrder.id && f.orderType === targetOrder.type);
        if (idx >= 0) return prev.map((f, i) => (i === idx ? { ...f, reviewedAt: now } : f));
        return [...prev, { orderId: targetOrder.id, orderType: targetOrder.type, confirmedAt: null, reviewedAt: now, downloadStartedAt: null }];
      }))
      .catch((err) => console.warn('리뷰플래그 저장:', err));
    setIsReviewModalOpen(false); setTargetOrder(null);
    alert('소중한 리뷰가 등록되었습니다!');
  };

  const handleDownloadClick = (orderId: string) => {
    if (downloadStarts[orderId]) return;
    const now = new Date().toISOString();
    upsertOrderBuyerFlag(orderId, user.id, 'store', { downloadStartedAt: now })
      .then(() => setFlags((prev) => {
        const idx = prev.findIndex((f) => f.orderId === orderId && f.orderType === 'store');
        if (idx >= 0) return prev.map((f, i) => (i === idx ? { ...f, downloadStartedAt: now } : f));
        return [...prev, { orderId, orderType: 'store', confirmedAt: null, reviewedAt: null, downloadStartedAt: now }];
      }))
      .catch((err) => console.warn('다운로드시작 저장:', err));
    alert('다운로드가 시작되었습니다. 지금부터 90일 동안만 다운로드가 가능합니다.');
  };

  // ─── 환불 처리 ────────────────────────────────────────────────────────
  const handleRefundRequest = async (order: OrderItem) => {
    const confirmed = window.confirm(
      `"${order.productName}" 주문을 환불신청하시겠습니까?\n환불 금액: ${order.totalPrice.toLocaleString()}원`
    );
    if (!confirmed) return;

    setRefundLoading(order.id);
    try {
      // paymentId 조회
      const storeOrder = storeOrders.find(o => o.id === order.id);
      const channelOrder = channelOrders.find(o => o.id === order.id);
      const paymentId = storeOrder?.paymentId || channelOrder?.paymentId;

      if (!paymentId) {
        alert('환불 실패: 결제 정보를 찾을 수 없습니다. 관리자에게 문의해 주세요.');
        return;
      }

      const res = await fetch('/.netlify/functions/portone-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, reason: '구매자 환불 신청' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(`환불 실패: ${data.error || '알 수 없는 오류가 발생했습니다.'}\n\n카드 내역에 환불이 확인된다면 관리자에게 문의해 주세요.`);
        return;
      }

      // DB 상태 업데이트 + 상위 상태 반영
      if (storeOrder) {
        const updated: StoreOrder = { ...storeOrder, status: '취소' };
        await upsertStoreOrder(updated);
        setStoreOrders?.(prev => prev.map(o => o.id === order.id ? updated : o));
      } else if (channelOrder) {
        const updated: ChannelOrder = { ...channelOrder, status: '취소' };
        await upsertChannelOrder(updated);
        setChannelOrders?.(prev => prev.map(o => o.id === order.id ? updated : o));
      }

      setRefundedOrderIds(prev => new Set([...prev, order.id]));
      const msg = data.alreadyCancelled
        ? '이미 환불 처리된 주문입니다. 카드 환불 내역을 확인해 주세요.'
        : '환불 신청이 완료되었습니다. 환불 금액은 영업일 기준 3~5일 내에 처리됩니다.';
      alert(msg);
    } catch (e) {
      alert(`환불 처리 중 오류가 발생했습니다: ${(e as Error).message}`);
    } finally {
      setRefundLoading(null);
    }
  };

  const isDownloadExpired = (orderId: string) => {
    const startTime = downloadStarts[orderId];
    if (!startTime) return false;
    const ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
    return Date.now() - startTime > ninetyDaysInMs;
  };

  // 환불 가능 여부 체크
  const isRefunded = (orderId: string) => refundedOrderIds.has(orderId);
  const getEffectiveStatus = (order: OrderItem) => {
    if (isRefunded(order.id)) return '취소';
    return order.status;
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => alert('복사되었습니다.'));
  };

  // "2026. 3. 12. 오전 3:51:55" 같은 한국 로케일 문자열도 파싱 가능한 날짜 포매터
  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('ko-KR');
    // "YYYY. M. D." 패턴 추출
    const m = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (m) return `${m[1]}. ${m[2]}. ${m[3]}.`;
    return dateStr;
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

  // ─── 스토어 주문 카드 액션 버튼 렌더 ─────────────────────────────────
  const renderStoreOrderActions = (order: OrderItem) => {
    const effectiveStatus = getEffectiveStatus(order);
    const isDownloadType = order.storeType === 'ebook' || order.storeType === 'template';
    const hasDownloaded = !!downloadStarts[order.id];
    const expired = isDownloadExpired(order.id);
    const downloadTime = downloadStarts[order.id];
    const isLoading = refundLoading === order.id;

    // 환불 완료된 주문
    if (effectiveStatus === '취소') {
      return (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="w-full px-8 py-4 bg-gray-100 text-gray-400 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 border border-gray-200 cursor-default">
            ✓ 환불 완료
          </div>
        </div>
      );
    }

    if (isDownloadType) {
      // 다운로드 상품 (전자책 / 템플릿)
      return (
        <div className="flex flex-col items-center gap-2 w-full">
          {order.downloadUrl && (
            <>
              <span className="bg-orange-50 text-orange-600 px-5 py-1.5 rounded-full text-[13px] font-black italic shadow-sm animate-pulse flex items-center gap-1 border border-orange-100">
                ⚡ 90일 이내 다운로드 가능
              </span>

              {expired ? (
                <div className="w-full px-8 py-4 bg-gray-200 text-gray-400 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 border border-gray-100 cursor-not-allowed">
                  🚫 다운로드 기간 만료
                </div>
              ) : order.downloadUrl !== '#' ? (
                <a
                  href={hasDownloaded ? order.downloadUrl : undefined}
                  download={hasDownloaded ? true : undefined}
                  onClick={hasDownloaded ? undefined : (e) => { e.preventDefault(); handleDownloadClick(order.id); }}
                  className={`w-full px-8 py-4 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 shadow-lg transition-all ${hasDownloaded ? 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700' : 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700'}`}
                >
                  📥 파일 다운로드
                </a>
              ) : (
                <button
                  onClick={() => handleDownloadClick(order.id)}
                  disabled={hasDownloaded}
                  className={`w-full px-8 py-4 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 shadow-lg transition-all ${hasDownloaded ? 'bg-gray-100 text-gray-400 cursor-default border border-gray-100' : 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700'}`}
                >
                  {hasDownloaded ? '✓ 다운로드 활성화됨' : '📥 다운로드 활성화'}
                </button>
              )}
            </>
          )}

          {/* 환불 버튼: 다운로드 전에만 표시 */}
          {!hasDownloaded && !expired && (
            <button
              onClick={() => handleRefundRequest(order)}
              disabled={isLoading}
              className={`w-full px-8 py-3 rounded-[20px] font-black text-[13px] italic flex items-center justify-center gap-2 transition-all border ${isLoading ? 'bg-gray-100 text-gray-400 cursor-default border-gray-100' : 'bg-white text-red-500 border-red-200 hover:bg-red-50'}`}
            >
              {isLoading ? '처리 중...' : '↩ 환불신청'}
            </button>
          )}
          {hasDownloaded && (
            <p className="text-[11px] text-gray-400 font-bold text-center">
              ※ 다운로드 후 환불이 불가합니다
            </p>
          )}
        </div>
      );
    } else {
      // 서비스 상품 (마케팅 / 강의 / 컨설팅 등)
      const canRefund = effectiveStatus === '결제완료';
      const workStarted = effectiveStatus === '작업중';

      return (
        <div className="flex flex-col items-center gap-2 w-full">
          {/* 구매확정 / 리뷰 버튼 */}
          {!confirmedList.includes(order.id) ? (
            <button onClick={(e) => handleConfirmOrder(order, e)} className="w-full px-8 py-4 rounded-[20px] bg-blue-600 text-white font-black shadow-lg hover:bg-black transition-all text-[13px] italic">구매 확정</button>
          ) : reviewedList.includes(order.id) ? (
            <button className="w-full px-8 py-4 bg-gray-100 text-gray-400 rounded-[20px] font-black text-[13px] italic cursor-default border border-gray-100">리뷰 완료 ✓</button>
          ) : (
            <button onClick={(e) => handleOpenReview(order, e)} className="w-full px-8 py-4 bg-orange-500 text-white rounded-[20px] font-black text-[13px] shadow-lg hover:bg-black transition-all italic animate-bounce">리뷰 쓰기</button>
          )}

          {/* 환불 버튼: 작업 시작 전에만 */}
          {canRefund && (
            <button
              onClick={() => handleRefundRequest(order)}
              disabled={isLoading}
              className={`w-full px-8 py-3 rounded-[20px] font-black text-[13px] italic flex items-center justify-center gap-2 transition-all border ${isLoading ? 'bg-gray-100 text-gray-400 cursor-default border-gray-100' : 'bg-white text-red-500 border-red-200 hover:bg-red-50'}`}
            >
              {isLoading ? '처리 중...' : '↩ 환불신청'}
            </button>
          )}

          {/* 작업 시작 후 환불 불가 안내 */}
          {workStarted && (
            <div className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-[16px] text-[11px] font-bold text-amber-700 text-center leading-relaxed">
              ⚠️ 판매자가 작업을 시작했습니다.<br />
              환불이 어려우며, 부분환불이 필요하면<br />
              판매자와 직접 협의해 주세요.
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex gap-2 p-2 bg-gray-100/50 rounded-[32px] w-full shadow-inner">
        {[
          { id: 'sns', label: 'SNS 활성화' },
          { id: 'channel', label: '채널 구매' },
          { id: 'store', label: 'N잡 스토어' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as BuyerSubTab); setExpandedId(null); }}
            className={`flex-1 py-4 rounded-[24px] text-[15px] font-black transition-all duration-300 ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-gray-400 hover:text-gray-600 hover:bg-white/30'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sns' ? (
        <div className="space-y-4">
          {/* SNS 서브탭: 구매내역 / 충전리스트 / 사용리스트 */}
          <div className="flex gap-2 border-b border-gray-100">
            {([['orders', '구매내역'], ['charge', '충전 리스트'], ['usage', '사용 리스트']] as [SnsSubTab, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSnsSubTab(id)}
                className={`px-5 py-3 font-black text-sm border-b-2 transition-all ${snsSubTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {snsSubTab === 'orders' && (
            <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
              {buyerOrders.length === 0 ? (
                <div className="py-16 text-center text-gray-300 font-black italic">내역이 존재하지 않습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <tbody className="divide-y divide-gray-50">
                      {buyerOrders.map(order => (
                        <React.Fragment key={order.id}>
                          <tr onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} className={`transition-all group cursor-pointer ${expandedId === order.id ? 'bg-[#2D3E5E] text-white' : 'hover:bg-gray-50/50 text-gray-700'}`}>
                            <td className="py-5 px-6 whitespace-nowrap font-black text-[13px]">
                              <span className="opacity-40 mr-1.5">≡</span>{order.id}
                            </td>
                            <td className="py-5 px-4 w-[200px]" style={{maxWidth:'200px', overflow:'hidden'}}>
                              <div className="flex items-center gap-1.5 w-full">
                                <span className="text-[12px] font-bold text-blue-400 overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 block">{order.link}</span>
                                <button onClick={(e) => copyToClipboard(order.link || '', e)} className="shrink-0 bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-black">복사</button>
                              </div>
                            </td>
                            <td className="py-5 px-4 font-black text-[14px] italic">{order.productName} - {order.price.toLocaleString()}원</td>
                            <td className="py-5 px-4 text-center whitespace-nowrap">
                              <span className={`px-3 py-1 rounded text-[11px] font-black ${expandedId === order.id ? 'bg-white text-[#2D3E5E]' : 'bg-gray-100 text-gray-400'}`}>{order.status}</span>
                            </td>
                            <td className="py-5 px-6 text-right text-[13px] font-bold italic opacity-80 whitespace-nowrap">{order.orderTime} <span className="ml-2">{expandedId === order.id ? '▲' : '▼'}</span></td>
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
                                  <div className="flex gap-2"><span>주문수량</span> <span className="text-gray-900">{order.quantity}</span></div>
                                  <div className="flex gap-2"><span>최초수량</span> <span className="text-orange-600">{order.initialCount || 0}</span></div>
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
              )}
            </div>
          )}

          {snsSubTab === 'charge' && (
            <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
              {chargeItems.length === 0 ? (
                <div className="py-16 text-center text-gray-300 font-black italic">충전 내역이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-5 text-left font-black text-gray-500 text-xs uppercase">No</th>
                      <th className="py-3 px-5 text-left font-black text-gray-500 text-xs uppercase">충전유형</th>
                      <th className="py-3 px-5 text-right font-black text-gray-500 text-xs uppercase">충전금액</th>
                      <th className="py-3 px-5 text-right font-black text-gray-500 text-xs uppercase">충전일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {chargeItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-5 text-gray-400 font-bold">{chargeItems.length - idx}</td>
                        <td className="py-3 px-5 text-gray-700 font-bold">{item.description}</td>
                        <td className="py-3 px-5 text-right text-blue-600 font-black">+{item.amount.toLocaleString()}P</td>
                        <td className="py-3 px-5 text-right text-gray-400 font-bold whitespace-nowrap">{safeFormatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {snsSubTab === 'usage' && (
            <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm">
              {usageItems.length === 0 ? (
                <div className="py-16 text-center text-gray-300 font-black italic">사용 내역이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="py-3 px-5 text-left font-black text-gray-500 text-xs uppercase">No</th>
                      <th className="py-3 px-5 text-left font-black text-gray-500 text-xs uppercase">사용유형</th>
                      <th className="py-3 px-5 text-right font-black text-gray-500 text-xs uppercase">사용금액</th>
                      <th className="py-3 px-5 text-right font-black text-gray-500 text-xs uppercase">사용일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {usageItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-5 text-gray-400 font-bold">{usageItems.length - idx}</td>
                        <td className="py-3 px-5 text-gray-700 font-bold">{item.description}</td>
                        <td className="py-3 px-5 text-right text-red-500 font-black">-{item.amount.toLocaleString()}P</td>
                        <td className="py-3 px-5 text-right text-gray-400 font-bold whitespace-nowrap">{safeFormatDate(item.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'channel' || activeTab === 'store' ? (
        <div className="space-y-4">
          {buyerOrders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
              <p className="text-gray-300 font-black italic">내역이 존재하지 않습니다.</p>
            </div>
          ) : (
            buyerOrders.map(order => {
              const downloadTime = downloadStarts[order.id];

              return (
                <div key={order.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-10 hover:border-blue-100 transition-all">
                  <div className="items-center gap-8 flex-1 w-full flex">
                    <div className="w-24 h-24 bg-gray-50 rounded-[28px] flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm shrink-0">
                      {order.thumbnail ? <img src={order.thumbnail} className="w-full h-full object-cover" alt="t" /> : <span className="text-3xl">📦</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase italic">주문번호: {order.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black italic uppercase ${getEffectiveStatus(order) === '취소' ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'}`}>{getEffectiveStatus(order)}</span>
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

                       {order.type === 'store' && (order.storeType === 'ebook' || order.storeType === 'template') && (
                         <p className="text-[12px] font-bold text-red-500 whitespace-nowrap overflow-hidden text-ellipsis italic">
                           ※ 전자책/자료·템플릿 상품의 경우는 다운로드 시 환불이 불가하며, 7일 후 자동으로 구매가 확정됩니다.
                         </p>
                       )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center lg:items-end gap-3 min-w-[200px] shrink-0">
                    {order.type === 'store'
                      ? renderStoreOrderActions(order)
                      : (
                        // 채널 주문 액션
                        <div className="flex flex-col items-center gap-2 w-full">
                          {getEffectiveStatus(order) === '취소' ? (
                            <div className="w-full px-8 py-4 bg-gray-100 text-gray-400 rounded-[20px] font-black text-[14px] italic flex items-center justify-center gap-2 border border-gray-200 cursor-default">
                              ✓ 환불 완료
                            </div>
                          ) : (
                            <>
                              {!confirmedList.includes(order.id) && (
                                <button onClick={(e) => handleConfirmOrder(order, e)} className="w-full px-8 py-4 rounded-[20px] bg-blue-600 text-white font-black shadow-lg hover:bg-black transition-all text-[13px] italic">구매 확정</button>
                              )}
                              {confirmedList.includes(order.id) && !reviewedList.includes(order.id) && order.type !== 'sns' && (
                                <button onClick={(e) => handleOpenReview(order, e)} className="w-full px-8 py-4 rounded-[20px] bg-amber-500 text-white font-black shadow-lg hover:bg-amber-600 transition-all text-[13px] italic">리뷰 작성</button>
                              )}
                            </>
                          )}
                        </div>
                      )
                    }
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {buyerOrders.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
              <p className="text-gray-300 font-black italic">내역이 존재하지 않습니다.</p>
            </div>
          ) : (
            buyerOrders.map(order => {
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
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black italic uppercase ${getEffectiveStatus(order) === '취소' ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'}`}>{getEffectiveStatus(order)}</span>
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

                       {order.type === 'store' && (order.storeType === 'ebook' || order.storeType === 'template') && (
                         <p className="text-[12px] font-bold text-red-500 whitespace-nowrap overflow-hidden text-ellipsis italic">
                           ※ 전자책/자료·템플릿 상품의 경우는 다운로드 시 환불이 불가하며, 7일 후 자동으로 구매가 확정됩니다.
                         </p>
                       )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center lg:items-end gap-3 min-w-[200px] shrink-0">
                    {renderStoreOrderActions(order)}
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
