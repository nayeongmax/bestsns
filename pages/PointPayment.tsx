
import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, Coupon, NotificationType, EbookProduct, ChannelProduct, ChannelOrder, StoreOrder, StoreType } from '@/types';
import { updateProfile } from '../profileDb';
import { insertPointTransaction } from '../pointDb';

declare const window: any;

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string;
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string;

interface Props {
  user: UserProfile;
  ebooks: EbookProduct[];
  channels: ChannelProduct[];
  members: UserProfile[];
  onUpdateUser: (updated: UserProfile) => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  setChannelOrders: React.Dispatch<React.SetStateAction<ChannelOrder[]>>;
  setStoreOrders: React.Dispatch<React.SetStateAction<StoreOrder[]>>;
}

const PointPayment: React.FC<Props> = ({ user, ebooks, channels, members, onUpdateUser, addNotif, setChannelOrders, setStoreOrders }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const productInfo = location.state?.product;
  const initialAmount = location.state?.amount || 0;
  const isProductPayment = !!productInfo;
  const ebookTier = location.state?.tier as { name: string; price: number } | undefined;
  const storeType = (location.state?.storeType as StoreType) || 'ebook';
  const sellerNickname = location.state?.sellerNickname as string | undefined;

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'toss'>('card');
  const [amount, setAmount] = useState<number>(initialAmount); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  // 유효한 쿠폰만 필터링 (사용하지 않음 + 유효기간 내)
  const availableCoupons = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    return (user.coupons || []).filter(c => c.status === 'available' && c.expiry >= now);
  }, [user.coupons]);

  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalPayAmount = Math.max(0, amount - discountAmount);

  // 포인트 충전 보너스 계산 (기간 만료 여부 포함)
  const isBonusWithinPeriod = (() => {
    if (!user.pointBonusActive || (user.pointBonusPercent || 0) <= 0) return false;
    if (user.pointBonusExpiryDays == null) return true; // 무기한
    if (!user.pointBonusStartDate) return true;
    const start = new Date(user.pointBonusStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + user.pointBonusExpiryDays);
    end.setHours(23, 59, 59, 999);
    return new Date() <= end;
  })();
  const bonusPercent = (!isProductPayment && isBonusWithinPeriod)
    ? (user.pointBonusPercent || 0)
    : 0;
  const bonusPoints = bonusPercent > 0 ? Math.floor(amount * bonusPercent / 100) : 0;
  const totalChargePoints = amount + bonusPoints;

  // 보너스 기간 표시용 날짜 포맷 (YY.MM.DD.)
  const isUnlimitedBonus = isBonusWithinPeriod && user.pointBonusExpiryDays == null;
  const bonusPeriodLabel = (() => {
    if (!isBonusWithinPeriod) return null;
    if (user.pointBonusExpiryDays == null) return '무기한';
    if (!user.pointBonusStartDate) return '무기한';
    const fmt = (d: Date) => `${String(d.getFullYear()).slice(2)}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}.`;
    const start = new Date(user.pointBonusStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + user.pointBonusExpiryDays);
    return `${fmt(start)}~${fmt(end)}`;
  })();

  // 금액 선택 프리셋
  const amountPresets = [10000, 30000, 50000, 100000, 300000, 500000];

  // 금액 누적 합산 함수
  const handleAddAmount = (val: number) => {
    setAmount(prev => prev + val);
  };

  const handleCharge = async () => {
    if (amount <= 0) return alert('결제할 금액을 선택하거나 입력해주세요.');
    if (isProcessing) return;

    const { PortOne } = window;
    if (!PortOne) return alert('결제 모듈이 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');

    setIsProcessing(true);
    try {
      // 포트원 V2 결제 요청 파라미터
      const paymentData: any = {
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId: `PAY_${Date.now()}_${user.id.slice(0, 4)}`,
        orderName: isProductPayment
          ? `[상품구매] ${productInfo.title}`
          : `[포인트충전] ${amount.toLocaleString()}원`,
        totalAmount: finalPayAmount,
        currency: "CURRENCY_KRW",
        payMethod: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'toss' ? 'EASY_PAY' : 'TRANSFER',
        customer: {
          fullName: user.nickname,
          phoneNumber: "01000000000",
          email: "user@thebestsns.com",
        },
      };

      // 간편결제(토스)일 경우 추가 설정
      if (paymentMethod === 'toss') {
        paymentData.easyPay = {
          provider: "TOSSPAY"
        };
      }

      const response = await PortOne.requestPayment(paymentData);

      // 결제 성공 시 (response.code가 없으면 성공으로 간주하는 V2 방식)
      if (!response.code) {
        const paymentId = paymentData.paymentId as string;
        const receiptUrl: string | undefined = (response as any).receiptUrl ?? (response as any).receipt_url;
        // 쿠폰 사용 시 DB 반영
        let nextUser = { ...user };
        if (appliedCoupon) {
          const nextCoupons = (user.coupons || []).map((c) =>
            c.id === appliedCoupon.id ? { ...c, status: 'used' as const } : c
          );
          nextUser = { ...user, coupons: nextCoupons };
          onUpdateUser(nextUser);
          updateProfile(user.id, { coupons: nextCoupons }).catch((e) => console.warn('쿠폰 사용 DB 반영 실패:', e));
        }

        if (isProductPayment) {
          addNotif(user.id, 'payment', '💳 상품 결제 완료', `[${productInfo.title}] 상품의 결제가 완료되었습니다. 마이페이지에서 확인하세요.`);
          // 채널 상품: 구매 내역(ChannelOrder) 추가 → DB 연동은 App에서 channelOrders 변경 시 자동 저장
          const channelProduct = channels.find((c: ChannelProduct) => c.id === productInfo.id) ?? (productInfo as ChannelProduct);
          if (channelProduct && 'platform' in channelProduct) {
            const newOrder: ChannelOrder = {
              id: `CO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              userId: user.id,
              userNickname: user.nickname ?? user.id,
              orderTime: new Date().toISOString(),
              productId: channelProduct.id,
              productName: channelProduct.title ?? productInfo.title,
              platform: channelProduct.platform ?? '',
              price: finalPayAmount,
              status: '결제완료',
              paymentId,
              paymentMethod: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'toss' ? 'EASY_PAY' : 'TRANSFER',
              paymentLog: response ? JSON.stringify(response) : undefined,
              receiptUrl,
            };
            setChannelOrders((prev) => [...prev, newOrder]);
            if (channelProduct.sellerId) {
              addNotif(channelProduct.sellerId, 'channel', '💰 채널 판매 알림', `[${channelProduct.title}] 채널이 판매되었습니다.`);
            }
          } else {
            // N잡스토어(이북 등): StoreOrder 추가 → DB 연동은 App에서 storeOrders 변경 시 자동 저장
            const targetProduct = ebooks.find((e) => e.id === productInfo.id);
            if (targetProduct && ebookTier && sellerNickname) {
              const newStoreOrder: StoreOrder = {
                id: `SO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                userId: user.id,
                userNickname: user.nickname ?? user.id,
                sellerNickname,
                orderTime: new Date().toISOString(),
                productId: targetProduct.id,
                productName: productInfo.title ?? targetProduct.title,
                tierName: ebookTier.name ?? '',
                price: finalPayAmount,
                storeType,
                status: '결제완료',
                paymentId,
                paymentMethod: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'toss' ? 'EASY_PAY' : 'TRANSFER',
                paymentLog: response ? JSON.stringify(response) : undefined,
                receiptUrl,
              };
              setStoreOrders((prev) => [...prev, newStoreOrder]);
              addNotif(targetProduct.authorId, 'ebook', '💰 상품 판매 알림', `축하합니다! 회원님의 [${targetProduct.title}] 상품이 판매되었습니다.`);
            } else if (targetProduct) {
              addNotif(targetProduct.authorId, 'ebook', '💰 상품 판매 알림', `축하합니다! 회원님의 [${targetProduct.title}] 상품이 판매되었습니다.`);
            }
          }
        } else {
          // 포인트 충전 처리 + DB 반영 (보너스 포인트 포함)
          const nextPoints = (user.points || 0) + totalChargePoints;
          onUpdateUser({ ...nextUser, points: nextPoints });
          updateProfile(user.id, { points: nextPoints }).catch((e) => console.warn('포인트 충전 DB 반영 실패:', e));
          const notifMsg = bonusPoints > 0
            ? `${amount.toLocaleString()}P + 보너스 ${bonusPoints.toLocaleString()}P(${bonusPercent}%) = 총 ${totalChargePoints.toLocaleString()}P 충전! 현재 잔액: ${nextPoints.toLocaleString()}P`
            : `${amount.toLocaleString()}P 충전이 완료되었습니다. 현재 잔액: ${nextPoints.toLocaleString()}P`;
          addNotif(user.id, 'payment', '💰 포인트 충전 완료', notifMsg);
          // 충전 내역 DB 저장
          insertPointTransaction({
            id: paymentId,
            user_id: user.id,
            type: 'charge',
            description: paymentMethod === 'card' ? '카드 충전' : paymentMethod === 'toss' ? '토스페이 충전' : '계좌이체 충전',
            amount,
            created_at: new Date().toISOString(),
            payment_method: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'toss' ? 'EASY_PAY' : 'TRANSFER',
            payment_log: response ? JSON.stringify(response) : undefined,
          }).catch((e) => console.warn('충전 내역 DB 저장 실패:', e));
        }
        alert('결제가 정상적으로 완료되었습니다.');
        navigate('/mypage');
      } else {
        // 결제 실패 또는 취소
        alert(`결제가 취소되었습니다: ${response.message || '사용자 취소'}`);
      }
    } catch (e: any) {
      alert(`시스템 오류: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 group">
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
        뒤로가기
      </button>

      <div className="flex flex-col lg:flex-row gap-10 items-stretch">
        <div className="flex-1 space-y-10 w-full flex flex-col">
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8">
            {isProductPayment ? '상품 안전 결제' : '포인트 충전'}
          </h2>
          <div className="flex-1 bg-white p-8 md:p-12 rounded-[48px] border border-gray-100 shadow-sm space-y-12">
            <div className="space-y-6">
              <label className="text-[12px] font-black text-gray-400 uppercase italic px-1">01. 결제 수단 선택</label>
              <div className="grid grid-cols-3 gap-4">
                {(['card', 'transfer', 'toss'] as const).map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={`py-6 rounded-[24px] font-black transition-all border-4 ${paymentMethod === m ? 'bg-gray-900 text-white border-gray-900 shadow-xl' : 'bg-gray-50 text-gray-400 border-transparent hover:border-gray-100'}`}>
                    {m === 'card' ? '신용카드' : m === 'transfer' ? '계좌이체' : '토스페이'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <label className="text-[12px] font-black text-gray-400 uppercase italic px-1">
                {isProductPayment ? '02. 결제 상품 확인' : '02. 충전 금액 합산 (클릭 시 합산됩니다)'}
              </label>
              {isProductPayment && (
                <div className="bg-blue-50 p-6 rounded-[32px] mb-4 border border-blue-100">
                  <p className="text-xl font-black text-gray-900">{productInfo.title}</p>
                </div>
              )}
              
              {!isProductPayment && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                  {amountPresets.map(preset => (
                    <button 
                      key={preset}
                      onClick={() => handleAddAmount(preset)}
                      className="group py-3 rounded-xl text-[11px] font-black transition-all border-2 bg-white text-gray-400 border-gray-100 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 shadow-sm active:scale-95"
                    >
                      +{preset >= 10000 ? `${preset/10000}만` : preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative group">
                <input 
                  type="text" 
                  value={`${amount.toLocaleString()}원`} 
                  readOnly 
                  className="w-full p-8 bg-gray-50 rounded-[32px] font-black text-4xl text-gray-800 shadow-inner text-right pr-20 focus:outline-none" 
                />
                {amount > 0 && (
                  <button 
                    onClick={() => setAmount(0)}
                    title="금액 초기화"
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-200 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center font-black text-2xl transition-all shadow-sm active:scale-90"
                  >
                    ✕
                  </button>
                )}
              </div>
              {!isProductPayment && amount > 0 && (
                <p className="text-[11px] text-gray-400 italic px-4 text-right">※ 위 버튼을 누르면 금액이 계속 더해집니다. 잘못 누른 경우 X를 눌러 초기화하세요.</p>
              )}
            </div>

            <div className="space-y-6 pt-6 border-t border-gray-50">
              <label className="text-[12px] font-black text-gray-400 uppercase italic px-1">03. 혜택 적용</label>
              <div onClick={() => setIsModalOpen(true)} className="w-full p-8 bg-[#f8fbff] border-2 border-dashed border-blue-200 rounded-[32px] flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-6"><div className="text-2xl">🎫</div><div><p className="text-sm font-black text-gray-900 italic">{appliedCoupon ? appliedCoupon.title : '사용 가능한 쿠폰을 선택하세요'}</p></div></div>
                <span className="text-xs font-black text-blue-500 uppercase italic underline group-hover:text-blue-700">변경하기 ↺</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[400px] flex flex-col pt-[72px]">
          <div className="flex-1 bg-white p-10 rounded-[48px] shadow-2xl space-y-12 lg:sticky lg:top-24 border border-gray-50">
            <h3 className="text-xl font-black italic uppercase border-b pb-6">결제 요약</h3>
            <div className="space-y-8 flex-1">
              <div className="flex justify-between items-center text-[15px] font-bold">
                <span className="text-gray-400 italic">주문 금액</span>
                <span className="text-gray-900 font-black">{amount.toLocaleString()} {isProductPayment ? '원' : 'P'}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between items-center text-[15px] font-bold">
                  <span className="text-red-400 italic">쿠폰 할인</span>
                  <span className="text-red-500 font-black">-{appliedCoupon.discount.toLocaleString()} 원</span>
                </div>
              )}
              {bonusPoints > 0 && (
                <div className="bg-amber-50 px-4 py-3 rounded-2xl border border-amber-200 space-y-1">
                  <div className="flex justify-between items-center text-[15px] font-bold">
                    <span className="text-amber-600 italic">🎁 보너스 포인트 +{bonusPercent}%</span>
                    <span className="text-amber-600 font-black">+{bonusPoints.toLocaleString()} P</span>
                  </div>
                  {bonusPeriodLabel && (
                    <p className="text-[11px] text-amber-500 font-bold text-right">{bonusPeriodLabel}</p>
                  )}
                  {isUnlimitedBonus && (
                    <p className="text-[11px] text-amber-400 leading-relaxed">※ 기간이 정해지지 않은 일시적 보너스 포인트로, 추후 보너스 혜택이 사라질 수 있습니다.</p>
                  )}
                </div>
              )}
              <div className="pt-8 border-t space-y-3">
                <span className="text-[11px] font-black text-blue-400 uppercase italic block text-center">실제 결제 금액 (VAT포함)</span>
                <p className="text-5xl font-black text-gray-900 text-center italic tracking-tighter">{finalPayAmount.toLocaleString()}원</p>
                {bonusPoints > 0 && (
                  <p className="text-center text-[13px] font-black text-amber-600">충전 포인트: {totalChargePoints.toLocaleString()}P</p>
                )}
              </div>
            </div>
            {!isProductPayment && (
              <div className="pt-2 space-y-1">
                <p className="text-[11px] font-black text-gray-500 uppercase italic">포인트 충전 유의사항</p>
                <p className="text-[11px] text-red-500 font-bold leading-relaxed">충전한 포인트는 충전일로부터 1년 이내에 사용하지 않을 경우, 사용하지 못할 수 있습니다.</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">포인트는 현금으로 환급되지 않으며, 타인에게 양도할 수 없습니다.</p>
              </div>
            )}
            <button
              onClick={handleCharge}
              disabled={amount <= 0 || isProcessing}
              className={`w-full py-8 rounded-[32px] font-black text-2xl transition-all shadow-2xl italic uppercase ${amount > 0 && !isProcessing ? 'bg-blue-600 text-white hover:bg-black scale-[1.02]' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              {isProcessing ? '처리 중...' : '안전 결제하기 🚀'}
            </button>
            <div className="pt-4 text-center">
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                안전결제 이용 시 상점 정책에 따라<br/>보안 결제 및 에스크로 보호가 적용됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[60px] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border-4 border-blue-50">
            <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
               <h3 className="text-2xl font-black italic tracking-tighter uppercase underline decoration-blue-500">쿠폰 선택</h3>
               <button onClick={() => setIsModalOpen(false)} className="text-gray-300 hover:text-gray-900 font-black text-3xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
              {availableCoupons.length === 0 ? (<p className="text-center py-10 text-gray-400 font-black italic">사용 가능한 쿠폰이 없습니다.</p>) : availableCoupons.map((cp) => (
                <div key={cp.id} onClick={() => { setAppliedCoupon(cp); setIsModalOpen(false); }} className={`bg-white rounded-[32px] p-8 border-4 cursor-pointer flex items-center gap-8 transition-all ${appliedCoupon?.id === cp.id ? 'border-blue-600 bg-blue-50/20' : 'border-gray-50 hover:border-blue-100'}`}>
                  <div className="w-24 h-24 rounded-2xl bg-blue-50 flex flex-col items-center justify-center font-black text-blue-600 italic text-xl shadow-inner border border-blue-100">
                    <span>{cp.discountLabel}</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-black italic">{cp.title}</h4>
                    <p className="text-gray-400 text-[12px] italic mt-2">만료일: {cp.expiry}</p>
                  </div>
                </div>
              ))}
            </div>
            {appliedCoupon && (
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <button onClick={() => { setAppliedCoupon(null); setIsModalOpen(false); }} className="w-full py-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black text-xs hover:text-red-500 transition-colors">쿠폰 적용 취소</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PointPayment;
