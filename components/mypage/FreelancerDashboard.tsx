import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserProfile } from '@/types';
import {
  getFreelancerBalance,
  getFreelancerHistory,
  withdrawFreelancerEarnings,
  MIN_WITHDRAW,
} from '@/services/freelancerEarnings';

interface Props {
  user: UserProfile;
  onUpdate: (updated: UserProfile) => void;
}

const FreelancerDashboard: React.FC<Props> = ({ user, onUpdate }) => {
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<ReturnType<typeof getFreelancerHistory>>([]);
  const [withdrawing, setWithdrawing] = useState(false);

  const refresh = () => {
    setBalance(getFreelancerBalance(user.id));
    setHistory(getFreelancerHistory(user.id));
  };

  useEffect(() => {
    refresh();
  }, [user.id]);

  const handleWithdraw = () => {
    if (balance < MIN_WITHDRAW) {
      alert(`최소 출금 가능 금액은 ${MIN_WITHDRAW.toLocaleString()}원입니다.`);
      return;
    }
    if (!confirm(`${MIN_WITHDRAW.toLocaleString()}원을 포인트로 출금하시겠습니까?`)) return;
    setWithdrawing(true);
    const result = withdrawFreelancerEarnings(user.id, MIN_WITHDRAW);
    if (result.success) {
      setBalance(result.newBalance);
      refresh();
      const newPoints = (user.points ?? 0) + MIN_WITHDRAW;
      onUpdate({ ...user, points: newPoints });
      alert(`${MIN_WITHDRAW.toLocaleString()} P가 포인트로 출금되었습니다.`);
    } else {
      alert('출금 처리에 실패했습니다.');
    }
    setWithdrawing(false);
  };

  const canWithdraw = balance >= MIN_WITHDRAW;

  return (
    <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 space-y-10 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-gray-900 italic">프리랜서 워크페이스</h3>
          <p className="text-sm text-gray-500 mt-1">누구나알바에서 작업한 수익을 관리하세요.</p>
        </div>
        <Link
          to="/part-time"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-blue-700 transition-all"
        >
          👷 누구나알바에서 작업하기
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[24px] p-8 border border-emerald-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
              🏦
            </div>
            <div>
              <p className="text-xs font-black text-gray-500 uppercase italic">수익통장</p>
              <p className="text-2xl font-black text-gray-900 italic">{balance.toLocaleString()} P</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            {MIN_WITHDRAW.toLocaleString()} P 이상 모이면 포인트로 출금할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={!canWithdraw || withdrawing}
            className={`mt-4 w-full py-3 rounded-xl font-black text-sm transition-all ${
              canWithdraw && !withdrawing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {withdrawing ? '처리 중...' : canWithdraw ? `${MIN_WITHDRAW.toLocaleString()} P 출금하기` : '5,000 P 이상 시 출금 가능'}
          </button>
        </div>

        <div className="bg-gray-50 rounded-[24px] p-6 border border-gray-100">
          <h4 className="font-black text-gray-800 mb-3">포인트 잔액</h4>
          <p className="text-xl font-black text-gray-900 italic">{(user.points ?? 0).toLocaleString()} P</p>
          <Link to="/payment/point" className="inline-block mt-3 text-blue-600 font-black text-sm hover:underline">
            충전하기 →
          </Link>
        </div>
      </div>

      <div>
        <h4 className="font-black text-gray-800 mb-4">수익통장 내역</h4>
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-bold">
              아직 내역이 없습니다.<br />
              <Link to="/part-time" className="text-blue-600 hover:underline mt-2 inline-block">누구나알바</Link>에서 작업을 완료하면 여기에 쌓입니다.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {history.slice(0, 20).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{entry.type === 'task' ? '💰' : '📤'}</span>
                    <div>
                      <p className="font-bold text-gray-800">{entry.label}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(entry.at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <span className={`font-black ${entry.amount >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()} P
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FreelancerDashboard;
