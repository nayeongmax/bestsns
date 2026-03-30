import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, EbookProduct } from '@/types';

interface Props {
  user: UserProfile;
  ebooks: EbookProduct[];
}

const CREDIT_PACKAGES = [
  { label: '1만 크레딧', amount: 10000 },
  { label: '3만 크레딧', amount: 30000 },
  { label: '5만 크레딧', amount: 50000 },
  { label: '10만 크레딧', amount: 100000 },
  { label: '50만 크레딧', amount: 500000 },
  { label: '100만 크레딧', amount: 1000000 },
];

const CreditApplication: React.FC<Props> = ({ user, ebooks }) => {
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // 마운트 시 DB에서 최신 프로필 재조회 (어드민이 보너스 OFF 처리 후 즉시 반영되도록)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('credit-refresh-profile'));
  }, []);

  // 보너스 포인트 계산 (관리자 설정 기반)
  const isBonusWithinPeriod = (() => {
    if (!user.pointBonusActive || (user.pointBonusPercent || 0) <= 0) return false;
    if (user.pointBonusExpiryDays == null) return true;
    if (!user.pointBonusStartDate) return true;
    const start = new Date(user.pointBonusStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + user.pointBonusExpiryDays);
    end.setHours(23, 59, 59, 999);
    return new Date() <= end;
  })();
  const bonusPercent = isBonusWithinPeriod ? (user.pointBonusPercent || 0) : 0;
  const bonusPoints = (bonusPercent > 0 && selectedAmount != null)
    ? Math.floor(selectedAmount * bonusPercent / 100)
    : 0;
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

  const handleSubmit = () => {
    if (!selectedAmount) return;
    // N잡스토어에 해당 금액의 승인된 상품이 있으면 상세페이지로 이동 + PG창 자동 오픈
    const matchedEbook = ebooks.find(
      (e) => e.status === 'approved' && !e.isPaused && e.price === selectedAmount
    );
    if (matchedEbook) {
      navigate(`/ebooks/${matchedEbook.id}`, { state: { autoTrigger: true, fromCreditPurchase: true } });
    } else {
      alert('해당 금액의 이용 가능한 상품이 없습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <button
        onClick={() => navigate(-1)}
        className="mb-8 flex items-center gap-2 text-gray-400 text-sm font-bold hover:text-gray-900 group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        뒤로가기
      </button>

      <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 mb-10">
        크레딧 구매
      </h2>

      <div className="space-y-6">

        {/* 크레딧 상품 선택 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[13px] font-black text-gray-400 uppercase italic tracking-widest block">
            크레딧 상품 선택
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.amount}
                type="button"
                onClick={() => setSelectedAmount(pkg.amount)}
                className={`py-5 px-3 rounded-[20px] font-black text-center transition-all border-4 ${
                  selectedAmount === pkg.amount
                    ? 'bg-gray-900 text-white border-gray-900 shadow-xl scale-[1.03]'
                    : 'bg-gray-50 text-gray-500 border-transparent hover:border-blue-100 hover:text-blue-600'
                }`}
              >
                <span className="block text-sm font-black">{pkg.label}</span>
                <span className={`block text-[12px] mt-1 font-bold ${selectedAmount === pkg.amount ? 'text-gray-400' : 'text-gray-300'}`}>
                  {pkg.amount.toLocaleString()}원
                </span>
              </button>
            ))}
          </div>

          {/* 금액 자동 표시 */}
          <div className="relative mt-2">
            <div className="w-full p-6 bg-gray-50 rounded-[24px] font-black text-5xl text-gray-800 shadow-inner text-right">
              {selectedAmount != null ? (
                <span>{selectedAmount.toLocaleString()}<span className="text-2xl text-blue-500 ml-2 font-black not-italic">C</span></span>
              ) : (
                <span className="text-gray-300 text-3xl font-bold">상품을 선택하세요</span>
              )}
            </div>
          </div>
        </div>

        {/* 보너스 포인트 배너 — 관리자가 활성화한 경우에만 표시 */}
        {isBonusWithinPeriod && bonusPercent > 0 && (
          <div className="bg-amber-50 rounded-[40px] p-7 border border-amber-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎁</span>
                <div>
                  <p className="font-black text-amber-800 text-lg">보너스 포인트 +{bonusPercent}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-amber-700 text-2xl">
                  +{bonusPoints > 0 ? bonusPoints.toLocaleString() : `${Math.floor(10000 * bonusPercent / 100).toLocaleString()}`}P
                </p>
                <p className="text-[12px] text-amber-500 font-bold">{bonusPeriodLabel}</p>
              </div>
            </div>
            <p className="text-[12px] text-amber-600 font-bold leading-relaxed border-t border-amber-200 pt-4">
              ※ 기간이 정해지지 않은 일시적 보너스 포인트입니다.<br />
              추후 보너스 혜택이 사라질 수 있습니다.
            </p>
          </div>
        )}

        {/* 환불 규정 */}
        <div className="bg-blue-50 rounded-[40px] p-8 md:p-10 border border-blue-100 space-y-5">
          <label className="text-[13px] font-black text-blue-500 uppercase italic tracking-widest block">
            환불 규정 안내
          </label>
          <div className="bg-white/60 rounded-[24px] p-6 space-y-3 text-sm text-blue-800 font-bold leading-relaxed border border-blue-100">
            <p className="font-black text-blue-900 text-[15px]">크레딧 환불 규정 (이용약관 제14조)</p>
            <ul className="space-y-2 pl-2">
              <li>1. 환불은 결제 완료 후 <strong>48시간 이내</strong>에만 가능합니다. (단, 지급된 크레딧을 사용하실 경우에는 환불이 불가능하오니 이점 유의하여 주시기 바랍니다.)</li>
              <li>2. 크레딧 구매 후 <strong>1C도 사용하지 않았을 때</strong> 환불이 가능합니다.</li>
              <li>3. 이벤트 등으로 무상 지급된 크레딧, 회원이 직접 충전하지 않은 크레딧은 환불이 불가합니다.</li>
              <li>4. 환불 신청은 고객센터 상담채팅방을 통해 접수바랍니다.</li>
              <li>5. 계좌번호 오타로 입금실수 시 적립 및 환불이 불가하니 확인하고 입금주세요.</li>
            </ul>
          </div>
        </div>

        {/* 구매 신청 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!selectedAmount}
          className={`w-full py-8 rounded-[32px] font-black text-2xl transition-all shadow-2xl italic uppercase tracking-wider ${
            selectedAmount
              ? 'bg-blue-600 text-white hover:bg-black scale-[1.02]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          구매 신청하기 🚀
        </button>

        <p className="text-center text-[12px] text-gray-400 font-bold leading-relaxed">
          선택한 금액의 N잡스토어 이용권 구매 페이지로 이동합니다.
        </p>
      </div>
    </div>
  );
};

export default CreditApplication;
