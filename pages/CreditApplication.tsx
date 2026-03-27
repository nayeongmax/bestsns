import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/types';
import { insertCreditApplication, generateCreditAppId } from '@/creditApplicationDb';

interface Props {
  user: UserProfile;
}

const CREDIT_PACKAGES = [
  { label: '10,000 크레딧', amount: 10000 },
  { label: '30,000 크레딧', amount: 30000 },
  { label: '50,000 크레딧', amount: 50000 },
  { label: '100,000 크레딧', amount: 100000 },
  { label: '300,000 크레딧', amount: 300000 },
  { label: '500,000 크레딧', amount: 500000 },
];

// 입금 계좌 정보 (실제 계좌번호로 변경 필요)
const BANK_INFO = {
  bank: '농협',
  accountNo: '352-2022-3464-43',
  holder: '김나영',
};

const CreditApplication: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [depositorName, setDepositorName] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // 보너스 포인트 계산 (관리자 설정 기반 — PointPayment와 동일한 로직)
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
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [workPolicyAgreed, setWorkPolicyAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const canSubmit =
    depositorName.trim().length > 0 &&
    selectedAmount !== null &&
    termsAgreed &&
    workPolicyAgreed &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    const appId = generateCreditAppId();
    try {
      await insertCreditApplication({
        id: appId,
        user_id: user.id,
        user_nickname: user.nickname,
        depositor_name: depositorName.trim(),
        amount: selectedAmount!,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      setSubmittedId(appId);
    } catch (e: any) {
      alert(`신청 중 오류가 발생했습니다: ${e?.message ?? '알 수 없는 오류'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 신청 완료 화면
  if (submittedId) {
    return (
      <div className="max-w-2xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
        <div className="bg-white rounded-[48px] p-10 md:p-14 shadow-sm border border-gray-100 space-y-8 text-center">
          <div className="text-6xl">✅</div>
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter">신청 완료!</h2>
          <p className="text-gray-500 font-bold leading-relaxed">
            크레딧 충전 신청이 접수되었습니다.<br />
            아래 계좌로 입금 후 관리자가 확인하여 크레딧을 지급합니다.
          </p>

          <div className="bg-blue-50 rounded-[32px] p-8 space-y-4 text-left border border-blue-100">
            <p className="text-[11px] font-black text-blue-400 uppercase italic tracking-widest">신청 정보</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">신청번호</span>
                <span className="font-black text-gray-900 text-sm tracking-widest">{submittedId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">입금자명</span>
                <span className="font-black text-gray-900">{depositorName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">신청 크레딧</span>
                <span className="font-black text-blue-600 text-lg">{selectedAmount!.toLocaleString()} C</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-[32px] p-8 space-y-4 text-left">
            <p className="text-[11px] font-black text-blue-400 uppercase italic tracking-widest">입금 계좌</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">은행</span>
                <span className="font-black text-white">{BANK_INFO.bank}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">계좌번호</span>
                <span className="font-black text-white tracking-widest">{BANK_INFO.accountNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-400">예금주</span>
                <span className="font-black text-white">{BANK_INFO.holder}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-sm font-bold text-gray-400">입금 금액</span>
                <span className="font-black text-blue-400 text-xl">{selectedAmount!.toLocaleString()}원</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-[24px] p-6 text-left border border-yellow-200">
            <p className="text-[12px] font-black text-yellow-700 mb-2">⚠️ 입금 시 꼭 확인하세요</p>
            <ul className="space-y-1 text-[12px] text-yellow-600 font-bold leading-relaxed">
              <li>• 입금자명을 반드시 <strong>{depositorName}</strong>으로 입력해주세요.</li>
              <li>• 입금 확인 후 영업일 기준 1~2일 내 크레딧이 지급됩니다.</li>
              <li>• 빠른 크레딧 충전을 원하시면 상담채팅방으로 문의남겨주세요.</li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={() => navigate('/sns')}
              className="flex-1 py-5 rounded-[24px] bg-blue-600 text-white font-black text-lg hover:bg-black transition-all shadow-xl"
            >
              마케팅 주문하기
            </button>
            <button
              onClick={() => navigate('/mypage')}
              className="flex-1 py-5 rounded-[24px] bg-gray-100 text-gray-700 font-black text-lg hover:bg-gray-200 transition-all"
            >
              마이페이지
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
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
        크레딧 충전 신청
      </h2>

      <div className="space-y-6">

        {/* 01. 입금자명 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
            01. 입금자명 입력
          </label>
          <input
            type="text"
            placeholder="실제 입금하실 분의 이름을 입력하세요"
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            className="w-full p-5 bg-gray-50 rounded-[24px] font-black text-gray-800 shadow-inner outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all text-base placeholder:font-bold placeholder:text-gray-300"
          />
          <p className="text-[11px] text-gray-400 font-bold px-1">
            ※ 입금 시 입금자명 또는 메모란에 닉네임(예: <strong className="text-gray-600">홍길동</strong>)을 기재해주시면 더 빠르게 처리됩니다.
          </p>
        </div>

        {/* 02. 크레딧 상품 선택 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
            02. 크레딧 상품 선택
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
          {selectedAmount != null && (
            <p className="text-[11px] text-gray-400 font-bold px-1">
              ※ 1 크레딧 = 1원. 위 금액을 아래 계좌로 입금해주세요.
            </p>
          )}
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

        {/* 03. 입금 계좌 안내 */}
        <div className="bg-gray-900 rounded-[40px] p-8 md:p-10 space-y-5">
          <label className="text-[12px] font-black text-blue-400 uppercase italic tracking-widest block">
            03. 입금 계좌
          </label>
          <div className="space-y-4">
            {[
              { label: '은행', value: BANK_INFO.bank },
              { label: '계좌번호', value: BANK_INFO.accountNo },
              { label: '예금주', value: BANK_INFO.holder },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-3 border-b border-white/10 last:border-0">
                <span className="text-sm font-bold text-gray-400">{label}</span>
                <span className="font-black text-white text-base tracking-wider">{value}</span>
              </div>
            ))}
            {selectedAmount != null && (
              <div className="flex justify-between items-center pt-3 border-t border-white/20">
                <span className="text-sm font-bold text-gray-400">입금 금액</span>
                <span className="font-black text-blue-400 text-2xl">{selectedAmount.toLocaleString()}원</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
            ※ 입금 시 입금자명 또는 메모란에 닉네임(예: <strong className="text-gray-300">홍길동</strong>)을 기재해주시면 더 빠르게 처리됩니다.
          </p>
        </div>

        {/* 04. 작업 시작 기준 안내 */}
        <div className="bg-blue-50 rounded-[40px] p-8 md:p-10 border border-blue-100 space-y-4">
          <label className="text-[12px] font-black text-blue-500 uppercase italic tracking-widest block">
            04. 작업 시작 기준 안내
          </label>
          <ul className="space-y-3 text-[13px] text-blue-800 font-bold leading-relaxed">
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">①</span>
              <span>입금 확인 후 크레딧을 충전해드립니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">②</span>
              <span>크레딧충전 하고도 적립이 되지 않았다면 상담채팅방으로 연락주세요. (주말·공휴일 가능)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">③</span>
              <span>입금자명을 일치해서 입금해주시고, 다를 경우 상담채팅방으로 연락주세요.</span>
            </li>
          </ul>
        </div>

        {/* 05. 환불 규정 동의 */}
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-sm space-y-5">
          <label className="text-[12px] font-black text-gray-400 uppercase italic tracking-widest block">
            05. 환불 규정 및 이용 동의
          </label>

          <div className="bg-gray-50 rounded-[24px] p-6 space-y-3 text-[12px] text-gray-600 font-bold leading-relaxed border border-gray-100">
            <p className="font-black text-gray-800 text-[13px]">크레딧 환불 규정 (이용약관 제14조)</p>
            <ul className="space-y-2 pl-2">
              <li>• 충전한 크레딧을 전혀 사용하지 않은 경우, 수수료 없이 전액 환불이 가능합니다.</li>
              <li>• 크레딧 일부를 사용한 경우 환불이 불가합니다.</li>
              <li>• 충전일로부터 <strong>14일이 경과</strong>한 이후에는 환불이 불가합니다.</li>
              <li>• 이벤트 등으로 무상 지급된 크레딧, 회원이 직접 충전하지 않은 크레딧은 환불이 불가합니다.</li>
              <li>• 환불 신청은 고객센터 상담채팅방을 통해 접수바랍니다.</li>
              <li>• 계좌번호 오타로 입금실수 시 적립 및 환불이 불가하니 확인하고 입금주세요.</li>
            </ul>
          </div>

          <div className="space-y-4 pt-2">
            <label className="flex items-start gap-4 cursor-pointer group">
              <div
                onClick={() => setTermsAgreed(prev => !prev)}
                className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                  termsAgreed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'
                }`}
              >
                {termsAgreed && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[13px] font-black text-gray-700 leading-snug">
                위 환불 규정을 확인하였으며, 이에 동의합니다. <span className="text-red-500">(필수)</span>
              </span>
            </label>

            <label className="flex items-start gap-4 cursor-pointer group">
              <div
                onClick={() => setWorkPolicyAgreed(prev => !prev)}
                className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                  workPolicyAgreed ? 'bg-blue-600 border-blue-600' : 'border-gray-300 group-hover:border-blue-400'
                }`}
              >
                {workPolicyAgreed && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[13px] font-black text-gray-700 leading-snug">
                마케팅 상품 주문 즉시 작업이 시작됩니다. 이후에는 취소·환불이 불가합니다. <span className="text-red-500">(필수)</span>
              </span>
            </label>
          </div>
        </div>

        {/* 신청하기 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-8 rounded-[32px] font-black text-2xl transition-all shadow-2xl italic uppercase tracking-wider ${
            canSubmit
              ? 'bg-blue-600 text-white hover:bg-black scale-[1.02]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? '신청 중...' : '크레딧 충전 신청하기 🚀'}
        </button>

        <p className="text-center text-[11px] text-gray-400 font-bold leading-relaxed">
          신청 후 입금을 완료해야 크레딧이 지급됩니다.
        </p>
      </div>
    </div>
  );
};

export default CreditApplication;
