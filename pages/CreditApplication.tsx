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
  bank: '기업은행',
  accountNo: '000-000000-00-000',
  holder: '더베스트',
};

const CreditApplication: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [depositorName, setDepositorName] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
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
              <li>• 또는 입금 메모란에 신청번호 <strong>{submittedId}</strong>를 기재해주세요.</li>
              <li>• 입금 확인 후 영업일 기준 1~2일 내 크레딧이 지급됩니다.</li>
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
            ※ 입금자명이 일치해야 크레딧 자동 매칭이 가능합니다.
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
            ※ 입금 시 입금자명 또는 메모란에 닉네임(<strong className="text-gray-300">{user.nickname}</strong>)을 기재해주시면 더 빠르게 처리됩니다.
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
              <span>신청서 제출 및 입금 완료 후, 관리자가 입금을 확인하면 크레딧이 지급됩니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">②</span>
              <span>크레딧 지급 후 SNS 활성화 주문 페이지에서 주문하시면 작업이 시작됩니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">③</span>
              <span>입금 확인은 영업일 기준 1~2일 소요될 수 있습니다. (주말·공휴일 제외)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-blue-400">④</span>
              <span>입금자명이 다를 경우 신청번호를 고객센터(010-5315-6542)로 알려주세요.</span>
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
              <li>• 크레딧 일부를 사용한 경우에도 충전일로부터 <strong>14일 이내</strong>이면 잔액 전액 환불이 가능합니다.</li>
              <li>• 충전일로부터 <strong>14일이 경과</strong>한 이후에는 환불이 불가합니다.</li>
              <li>• 이벤트 등으로 무상 지급된 크레딧, 회원이 직접 충전하지 않은 크레딧은 환불이 불가합니다.</li>
              <li>• 환불 신청은 고객센터(010-5315-6542)를 통해 접수하며, 접수 후 <strong>10일 이내</strong>에 처리됩니다.</li>
              <li>• 충전된 크레딧의 유효기간은 마지막 로그인일로부터 <strong>1년</strong>입니다.</li>
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
                크레딧 지급 후 주문 시 작업이 시작되며, 작업 시작 이후에는 취소·환불이 불가함을 이해합니다. <span className="text-red-500">(필수)</span>
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
          신청 후 입금을 완료해야 크레딧이 지급됩니다.<br />
          문의: 고객센터 010-5315-6542
        </p>
      </div>
    </div>
  );
};

export default CreditApplication;
