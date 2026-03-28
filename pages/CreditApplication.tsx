import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/types';

interface Props {
  user: UserProfile;
}

const CREDIT_PACKAGES = [
  { label: '1만 크레딧', amount: 10000 },
  { label: '3만 크레딧', amount: 30000 },
  { label: '5만 크레딧', amount: 50000 },
  { label: '10만 크레딧', amount: 100000 },
  { label: '50만 크레딧', amount: 500000 },
  { label: '100만 크레딧', amount: 1000000 },
];

const CreditApplication: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

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
    navigate('/store/marketing-voucher', { state: { amount: selectedAmount } });
  };

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

      <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase underline decoration-blue-500 underline-offset-8 mb-10">
        크레딧 충전
      </h2>

      <div className="space-y-6">

        {/* 크레딧 상품 선택 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
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
                <span className="block text-[13px] font-black">{pkg.label}</span>
                <span className={`block text-[11px] mt-1 font-bold ${selectedAmount === pkg.amount ? 'text-gray-400' : 'text-gray-300'}`}>
                  {pkg.amount.toLocaleString()}원
                </span>
              </button>
            ))}
          </div>

          {/* 금액 자동 표시 */}
          <div className="relative mt-2">
            <div className="w-full p-6 bg-gray-50 rounded-[24px] font-black text-4xl text-gray-800 shadow-inner text-right">
              {selectedAmount != null ? (
                <span>{selectedAmount.toLocaleString()}<span className="text-xl text-blue-500 ml-2 font-black not-italic">C</span></span>
              ) : (
                <span className="text-gray-300 text-2xl font-bold">상품을 선택하세요</span>
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
                  <p className="font-black text-amber-800 text-base">보너스 포인트 +{bonusPercent}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-black text-amber-700 text-xl">
                  +{bonusPoints > 0 ? bonusPoints.toLocaleString() : `${Math.floor(10000 * bonusPercent / 100).toLocaleString()}`}P
                </p>
                <p className="text-[11px] text-amber-500 font-bold">{bonusPeriodLabel}</p>
              </div>
            </div>
            <p className="text-[11px] text-amber-600 font-bold leading-relaxed border-t border-amber-200 pt-4">
              ※ 기간이 정해지지 않은 일시적 보너스 포인트입니다.<br />
              추후 보너스 혜택이 사라질 수 있습니다.
            </p>
          </div>
        )}

        {/* 안내 */}
        <div className="bg-blue-50 rounded-[40px] p-8 md:p-10 border border-blue-100 space-y-4">
          <label className="text-[12px] font-black text-blue-500 uppercase italic tracking-widest block">
            이용 안내
          </label>
          <ul className="space-y-3 text-[13px] text-blue-800 font-bold leading-relaxed">
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">①</span>
              <span>충전 신청 버튼 클릭 시 N잡스토어 이용권 구매 페이지로 이동합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">②</span>
              <span>카드 결제 완료 즉시 크레딧이 자동 충전됩니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">③</span>
              <span>충전된 크레딧으로 유튜브·인스타그램·틱톡 등 마케팅 서비스를 이용하세요.</span>
            </li>
          </ul>
        </div>

        {/* 환불 규정 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
            환불 규정 안내
          </label>
          <div className="bg-gray-50 rounded-[24px] p-6 space-y-3 text-[12px] text-gray-600 font-bold leading-relaxed border border-gray-100">
            <p className="font-black text-gray-800 text-[13px]">크레딧 환불 규정 (이용약관 제14조)</p>
            <ul className="space-y-2 pl-2">
              <li>• 충전한 크레딧을 전혀 사용하지 않은 경우, 수수료 없이 전액 환불이 가능합니다.</li>
              <li>• 크레딧 일부를 사용한 경우 환불이 불가합니다.</li>
              <li>• 충전일로부터 <strong>14일이 경과</strong>한 이후에는 환불이 불가합니다.</li>
              <li>• 이벤트 등으로 무상 지급된 크레딧은 환불이 불가합니다.</li>
              <li>• 환불 신청은 고객센터 상담채팅방을 통해 접수바랍니다.</li>
            </ul>
          </div>
        </div>

        {/* 충전 신청 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!selectedAmount}
          className={`w-full py-8 rounded-[32px] font-black text-2xl transition-all shadow-2xl italic uppercase tracking-wider ${
            selectedAmount
              ? 'bg-blue-600 text-white hover:bg-black scale-[1.02]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          충전 신청하기 🚀
        </button>

        <p className="text-center text-[11px] text-gray-400 font-bold leading-relaxed">
          선택한 금액의 N잡스토어 이용권 구매 페이지로 이동합니다.
        </p>
      </div>
    </div>
  );
};

export default CreditApplication;
