import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeJobRequest } from '@/types';
import { getPartTimeJobRequests, setPartTimeJobRequests, calcAdvertiserTotalPayment } from '@/constants';
import { upsertPartTimeJobRequest } from '../parttimeDb';

declare const window: any;

interface Props {
  user: UserProfile;
  addNotif?: (userId: string, type: string, title: string, message: string, reason?: string) => void;
}

const AlbaPaymentPage: React.FC<Props> = ({ user, addNotif }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const jobRequest = location.state?.jobRequest as PartTimeJobRequest | undefined;

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'toss'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreeCancel, setAgreeCancel] = useState(false);
  const [agreeContract, setAgreeContract] = useState(false);
  const [agreePenalty, setAgreePenalty] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canAccess = jobRequest && (jobRequest.applicantUserId === user.id || isAdmin);
  if (!jobRequest || !canAccess) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-gray-600 font-bold mb-4">결제할 작업의뢰를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } })} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black">
          마이페이지로
        </button>
      </div>
    );
  }

  const totalAmount = calcAdvertiserTotalPayment(jobRequest.adAmount);

  const handlePayment = async () => {
    if (isProcessing) return;
    if (!agreeCancel || !agreeContract || !agreePenalty) {
      alert('필수 동의 항목에 모두 체크해 주세요.');
      return;
    }

    const { PortOne } = window;
    if (!PortOne) return alert('결제 모듈이 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');

    setIsProcessing(true);
    try {
      const paymentData: any = {
        storeId: 'store-77114631',
        channelKey: 'channel-key-8be52e64-59e5-4b03-9118-e320f7895e6a',
        paymentId: `ALBA_${Date.now()}_${jobRequest.id}`,
        orderName: `[알바의뢰] ${jobRequest.title}`,
        totalAmount,
        currency: 'CURRENCY_KRW',
        payMethod: paymentMethod === 'card' ? 'CARD' : paymentMethod === 'toss' ? 'EASY_PAY' : 'TRANSFER',
        customer: {
          fullName: user.nickname,
          phoneNumber: '01000000000',
          email: 'user@thebestsns.com',
        },
      };
      if (paymentMethod === 'toss') paymentData.easyPay = { provider: 'TOSSPAY' };

      const response = await PortOne.requestPayment(paymentData);

      if (!response.code) {
        const updated = { ...jobRequest, paid: true };
        const requests = getPartTimeJobRequests();
        const next = requests.map((r) => (r.id === jobRequest.id ? updated : r));
        setPartTimeJobRequests(next);
        await upsertPartTimeJobRequest(updated);
        addNotif?.(user.id, 'payment', '알바의뢰 결제 완료', `[${jobRequest.title}] 결제가 완료되었습니다. 프리랜서 모집이 진행될 예정입니다.`);
        alert('결제가 정상적으로 완료되었습니다.');
        navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } });
      } else {
        alert(`결제가 취소되었습니다: ${response.message || '사용자 취소'}`);
      }
    } catch (e: any) {
      alert(`시스템 오류: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-32 px-4 animate-in fade-in duration-500">
      <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-gray-400 font-bold hover:text-gray-900 group">
        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        뒤로가기
      </button>

      <div className="bg-white rounded-[32px] p-10 shadow-xl border border-gray-100">
        <h2 className="text-2xl font-black text-gray-900 mb-6">PG 결제</h2>
        <div className="space-y-4 mb-8">
          <p className="text-gray-600 font-bold">{jobRequest.title}</p>
          <p className="text-sm text-gray-500">{jobRequest.unitPrice != null && jobRequest.quantity != null ? `단가 ${jobRequest.unitPrice.toLocaleString()}원 × ${jobRequest.quantity}개` : `광고금액: ${jobRequest.adAmount.toLocaleString()}원`}</p>
          <p className="text-sm text-gray-500">플랫폼 수수료(25%+부가세10%): {jobRequest.fee.toLocaleString()}원 / 결제망 수수료(3.3%): {Math.round((jobRequest.adAmount + jobRequest.fee) * 0.033).toLocaleString()}원</p>
          <p className="text-2xl font-black text-emerald-600">총 결제: {totalAmount.toLocaleString()}원</p>
        </div>
        <div className="space-y-4 mb-8">
          <p className="text-xs font-black text-gray-400 uppercase">결제 수단</p>
          <div className="flex gap-2">
            {(['card', 'transfer', 'toss'] as const).map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)} className={`px-4 py-2 rounded-xl text-sm font-black ${paymentMethod === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {m === 'card' ? '카드' : m === 'toss' ? '토스' : '계좌이체'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4 mb-8 p-6 rounded-2xl bg-gray-50 border border-gray-100">
          <h4 className="text-sm font-black text-gray-800 mb-3">취소/환불 규정</h4>
          <p className="text-sm text-gray-700 leading-relaxed">
            작업 시작 전: 언제든 전액 취소·환불 가능합니다.<br />
            작업 시작 후: 프리랜서 선정이 끝난 경우 작업내용 전달이 되어 환불이 어렵습니다.
          </p>
          <label className="flex items-start gap-3 cursor-pointer mt-4">
            <input type="checkbox" checked={agreeCancel} onChange={(e) => setAgreeCancel(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300" />
            <span className="text-sm font-bold">(필수) 취소/환불 규정을 확인하였으며 이에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer mt-2">
            <input type="checkbox" checked={agreeContract} onChange={(e) => setAgreeContract(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300" />
            <span className="text-sm font-bold">(필수) 결제와 동시에 플랫폼과 귀하 사이의 용역 공급 계약이 성립됨에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer mt-2">
            <input type="checkbox" checked={agreePenalty} onChange={(e) => setAgreePenalty(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300" />
            <span className="text-sm font-bold">(필수) 플랫폼 외 직접 거래 시 거래액의 10배 위약벌이 부과됨을 확인하였습니다.</span>
          </label>
        </div>
        <div className="flex flex-col gap-3">
          {isAdmin && (
            <button
              onClick={async () => {
                if (isProcessing) return;
                if (!agreeCancel || !agreeContract || !agreePenalty) {
                  alert('필수 동의 항목에 모두 체크해 주세요.');
                  return;
                }
                setIsProcessing(true);
                try {
                  const targetUserId = jobRequest!.applicantUserId;
                  const updated = { ...jobRequest!, paid: true };
                  const requests = getPartTimeJobRequests();
                  const next = requests.map((r) => (r.id === jobRequest!.id ? updated : r));
                  setPartTimeJobRequests(next);
                  await upsertPartTimeJobRequest(updated);
                  addNotif?.(targetUserId, 'payment', '알바의뢰 결제 완료', `[${jobRequest!.title}] 결제가 완료되었습니다. 프리랜서 모집이 진행될 예정입니다.`);
                  alert('테스트 결제가 임시통과 처리되었습니다.');
                  navigate('/mypage', { state: { activeTab: 'freelancer', freelancerSubTab: 'alba' } });
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 disabled:opacity-70 border-2 border-dashed border-amber-600"
            >
              🔧 테스트용 임시통과 (PG 우회)
            </button>
          )}
          <div className="flex gap-4">
            <button onClick={() => navigate(-1)} className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-700 font-black">취소</button>
            <button onClick={handlePayment} disabled={isProcessing} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-70">
              {isProcessing ? '결제 진행 중...' : '결제하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbaPaymentPage;
