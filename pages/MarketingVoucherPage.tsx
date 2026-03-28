import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile, NotificationType } from '@/types';
import { updateProfile } from '../profileDb';
import { insertPointTransaction } from '../pointDb';

declare const window: any;

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string;
const CHANNEL_KEY = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string;

// 금액별 마케팅 이용권 정보
const VOUCHER_INFO: Record<number, { title: string; desc: string }> = {
  10000:   { title: 'SNS 마케팅 이용권 1만원',   desc: '1만 크레딧 충전' },
  30000:   { title: 'SNS 마케팅 이용권 3만원',   desc: '3만 크레딧 충전' },
  50000:   { title: 'SNS 마케팅 이용권 5만원',   desc: '5만 크레딧 충전' },
  100000:  { title: 'SNS 마케팅 이용권 10만원',  desc: '10만 크레딧 충전' },
  500000:  { title: 'SNS 마케팅 이용권 50만원',  desc: '50만 크레딧 충전' },
  1000000: { title: 'SNS 마케팅 이용권 100만원', desc: '100만 크레딧 충전' },
};

interface Props {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
  addNotif: (userId: string, type: NotificationType, title: string, message: string) => void;
}

const MarketingVoucherPage: React.FC<Props> = ({ user, onUpdateUser, addNotif }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const amount: number = location.state?.amount || 10000;
  const voucher = VOUCHER_INFO[amount] || { title: `SNS 마케팅 이용권 ${amount.toLocaleString()}원`, desc: `${amount.toLocaleString()} 크레딧 충전` };

  const [isProcessing, setIsProcessing] = useState(false);
  const autoTriggered = useRef(false);

  const handlePayment = async () => {
    if (isProcessing) return;

    const { PortOne } = window;
    if (!PortOne) {
      alert('결제 모듈이 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!STORE_ID || !CHANNEL_KEY) {
      alert('결제 설정이 올바르지 않습니다. 관리자에게 문의하세요.');
      return;
    }

    setIsProcessing(true);
    try {
      const paymentId = `PAY_${Date.now()}_${user.id.slice(0, 4)}`;

      const response = await PortOne.requestPayment({
        storeId: STORE_ID,
        channelKey: CHANNEL_KEY,
        paymentId,
        orderName: `[마케팅크레딧] ${voucher.title}`,
        totalAmount: amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
          fullName: user.nickname,
          phoneNumber: '01000000000',
          email: user.email || 'user@bestsns.com',
        },
      });

      if (!response || 'code' in response) {
        const msg = (response as any)?.message || '사용자 취소';
        alert(`결제가 취소되었습니다: ${msg}`);
        return;
      }

      // 결제 성공 → 크레딧(포인트) 충전
      const nextPoints = (user.points || 0) + amount;
      onUpdateUser({ ...user, points: nextPoints });
      updateProfile(user.id, { points: nextPoints }).catch((e) =>
        console.warn('크레딧 충전 DB 반영 실패:', e)
      );

      // 거래 내역 저장
      insertPointTransaction({
        id: paymentId,
        user_id: user.id,
        type: 'charge',
        description: `마케팅 이용권 구매 (${voucher.title})`,
        amount,
        created_at: new Date().toISOString(),
        payment_method: 'CARD',
        payment_log: JSON.stringify(response),
      }).catch((e) => console.warn('거래 내역 저장 실패:', e));

      addNotif(
        user.id,
        'payment',
        '💳 크레딧 충전 완료',
        `${amount.toLocaleString()}C 크레딧이 충전되었습니다. 현재 잔액: ${nextPoints.toLocaleString()}C`
      );

      alert('크레딧 충전이 완료되었습니다!');
      navigate('/sns');
    } catch (e: any) {
      alert(`오류가 발생했습니다: ${e?.message ?? '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 페이지 진입 시 자동으로 결제창 열기
  useEffect(() => {
    if (autoTriggered.current) return;
    autoTriggered.current = true;
    // 짧은 딜레이 후 트리거 (페이지 렌더링 완료 대기)
    const timer = setTimeout(() => {
      handlePayment();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        뒤로가기
      </button>

      {/* 상품 헤더 */}
      <div className="space-y-3 mb-10">
        <div className="flex gap-2">
          <span className="bg-rose-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm uppercase italic tracking-widest">마케팅</span>
          <span className="bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-black px-4 py-1.5 rounded-full shadow-sm border border-green-100 uppercase italic tracking-widest">N잡스토어</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-gray-900 italic tracking-tighter leading-tight">
          {voucher.title}
        </h1>
        <p className="text-gray-500 font-bold text-base">SNS 마케팅 서비스 전용 크레딧 이용권</p>
      </div>

      <div className="space-y-6">

        {/* 구매 흐름 안내 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-6">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
            구매 후 안내
          </label>
          <div className="space-y-4">
            {[
              { icon: '🛒', title: '이용권 구매', desc: `N잡스토어에서 ${voucher.title} 결제` },
              { icon: '💳', title: '크레딧 지급', desc: `결제 완료 즉시 ${amount.toLocaleString()}C 자동 충전` },
              { icon: '📣', title: '마케팅 서비스 선택', desc: '유튜브·인스타그램·틱톡 등 서비스를 자유롭게 이용' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-[14px] flex items-center justify-center text-xl shrink-0 border border-blue-100">
                  {step.icon}
                </div>
                <div>
                  <p className="font-black text-gray-900 text-[14px]">{step.title}</p>
                  <p className="text-[12px] text-gray-500 font-bold mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 핵심 포인트 */}
        <div className="bg-gray-900 rounded-[40px] p-8 md:p-10 space-y-5">
          <label className="text-[12px] font-black text-blue-400 uppercase italic tracking-widest block">
            핵심 포인트 한 줄
          </label>
          <div className="space-y-3">
            <p className="text-white font-bold text-base leading-relaxed">
              결제는 <span className="text-blue-400 font-black">"이용권"</span>을 사고
            </p>
            <p className="text-white font-bold text-base leading-relaxed">
              사용은 <span className="text-blue-400 font-black">"서비스 선택"</span>으로 분리
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-400">충전 크레딧</span>
              <span className="font-black text-blue-400 text-xl">{amount.toLocaleString()} C</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-400">결제 금액</span>
              <span className="font-black text-white text-xl">{amount.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* 환불 규정 */}
        <div className="bg-blue-50 rounded-[40px] p-8 md:p-10 border border-blue-100 space-y-4">
          <label className="text-[12px] font-black text-blue-500 uppercase italic tracking-widest block">
            유의사항
          </label>
          <ul className="space-y-3 text-[13px] text-blue-800 font-bold leading-relaxed">
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">①</span>
              <span>결제 완료 즉시 크레딧이 자동으로 충전됩니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">②</span>
              <span>크레딧을 전혀 사용하지 않은 경우 충전일로부터 14일 이내 환불 가능합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">③</span>
              <span>크레딧 일부 사용 후에는 환불이 불가합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">④</span>
              <span>환불 신청은 고객센터 상담채팅방으로 접수해 주세요.</span>
            </li>
          </ul>
        </div>

        {/* 구매하기 버튼 */}
        <button
          onClick={handlePayment}
          disabled={isProcessing}
          className={`w-full py-8 rounded-[32px] font-black text-2xl transition-all shadow-2xl italic uppercase tracking-wider ${
            isProcessing
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-black scale-[1.02]'
          }`}
        >
          {isProcessing ? '결제창 열리는 중...' : `${amount.toLocaleString()}원 구매하기 🚀`}
        </button>

        <p className="text-center text-[11px] text-gray-400 font-bold leading-relaxed">
          결제 완료 즉시 {amount.toLocaleString()}C 크레딧이 자동으로 충전됩니다.
        </p>
      </div>
    </div>
  );
};

export default MarketingVoucherPage;
