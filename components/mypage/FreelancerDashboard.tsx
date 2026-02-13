import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import FreelancerRegistrationModal from './FreelancerRegistrationModal';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import {
  getFreelancerBalance,
  getFreelancerHistory,
  withdrawFreelancerEarnings,
  addFreelancerWithdrawRequest,
  MIN_WITHDRAW_FREELANCER,
  getPartTimeTasks,
} from '@/constants';

interface Props {
  user: UserProfile;
  onUpdate: (updated: UserProfile) => void;
}

const FreelancerDashboard: React.FC<Props> = ({ user, onUpdate }) => {
  const [balance, setBalance] = useState(0);
  const [showRegModal, setShowRegModal] = useState(false);
  const [history, setHistory] = useState<ReturnType<typeof getFreelancerHistory>>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<PartTimeTask[]>([]);
  const [chartTab, setChartTab] = useState<'daily' | 'monthly'>('daily');

  /** 입금 내역 (작업 완료 후 지급된 알바비만) */
  const depositEntries = useMemo(
    () => history.filter((e) => e.type === 'task' && e.amount > 0),
    [history]
  );

  /** 일별/월별 알바비 차트 데이터 */
  const chartData = useMemo(() => {
    if (chartTab === 'daily') {
      const data: { name: string; 금액: number }[] = [];
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const daySum = depositEntries
          .filter((e) => e.at.startsWith(dateStr))
          .reduce((sum, e) => sum + e.amount, 0);
        data.push({
          name: `${d.getMonth() + 1}/${d.getDate()}`,
          금액: daySum,
        });
      }
      return data;
    } else {
      const data: { name: string; 금액: number }[] = [];
      const year = new Date().getFullYear();
      for (let m = 0; m < 12; m++) {
        const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
        const monthSum = depositEntries
          .filter((e) => e.at.startsWith(prefix))
          .reduce((sum, e) => sum + e.amount, 0);
        data.push({ name: `${m + 1}월`, 금액: monthSum });
      }
      return data;
    }
  }, [chartTab, depositEntries]);

  const refresh = () => {
    setBalance(getFreelancerBalance(user.id));
    setHistory(getFreelancerHistory(user.id));
  };

  useEffect(() => {
    refresh();
    const tasks = getPartTimeTasks();
    const mySelected = tasks.filter(
      (t) => !t.pointPaid && t.applicants.some((a) => a.userId === user.id && a.selected)
    );
    setSelectedTasks(mySelected);
  }, [user.id]);

  const handleWithdraw = () => {
    if (balance < MIN_WITHDRAW_FREELANCER) {
      alert(`최소 출금 가능 금액은 ${MIN_WITHDRAW_FREELANCER.toLocaleString()}원입니다.`);
      return;
    }
    const bank = user.freelancerStatus === 'approved' && user.freelancerApplication
      ? { bankName: user.freelancerApplication.bankName, accountNo: user.freelancerApplication.accountNo, ownerName: user.freelancerApplication.ownerName }
      : (user.sellerApplication?.bankInfo ?? user.pendingApplication?.bankInfo);
    const bankInfo = bank;
    if (!bankInfo?.bankName?.trim() || !bankInfo?.accountNo?.trim()) {
      alert(
        '출금을 위해 전문가정보에 통장 정보를 먼저 등록해 주세요.\n마이페이지 → 전문가정보에서 은행/계좌를 등록해 주세요.'
      );
      return;
    }
    if (!confirm(`수익통장 전액 ${balance.toLocaleString()}원을 등록된 통장(${bankInfo.bankName} ${bankInfo.accountNo})으로 출금 신청하시겠습니까?`)) return;
    setWithdrawing(true);
    const result = withdrawFreelancerEarnings(user.id, balance);
    if (result.success) {
      addFreelancerWithdrawRequest({
        userId: user.id,
        nickname: user.nickname,
        amount: balance,
        bankName: bankInfo.bankName,
        accountNo: bankInfo.accountNo,
        ownerName: bankInfo.ownerName || user.nickname,
      });
      setBalance(result.newBalance);
      refresh();
      alert(
        `출금 신청이 완료되었습니다.\n${balance.toLocaleString()}원이 ${bankInfo.bankName} ${bankInfo.accountNo} (${bankInfo.ownerName || user.nickname})으로 입금 처리됩니다.`
      );
    } else {
      alert('출금 처리에 실패했습니다.');
    }
    setWithdrawing(false);
  };

  const canWithdraw = balance >= MIN_WITHDRAW_FREELANCER;
  const bankInfo = user.freelancerStatus === 'approved' && user.freelancerApplication
    ? { bankName: user.freelancerApplication.bankName, accountNo: user.freelancerApplication.accountNo, ownerName: user.freelancerApplication.ownerName }
    : (user.sellerApplication?.bankInfo ?? user.pendingApplication?.bankInfo);
  const hasBankInfo = !!(bankInfo?.bankName?.trim() && bankInfo?.accountNo?.trim());
  const isFreelancerApproved = user.freelancerStatus === 'approved';
  const isFreelancerPending = user.freelancerStatus === 'pending';

  const handleFreelancerRegSubmit = (app: import('@/types').FreelancerApplication) => {
    onUpdate({ ...user, freelancerStatus: 'pending', freelancerApplication: app });
    setShowRegModal(false);
  };

  if (!isFreelancerApproved && !isFreelancerPending) {
    return (
      <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 space-y-10 animate-in fade-in duration-300">
        <div>
          <h3 className="text-2xl font-black text-gray-900 italic">프리랜서 워크페이스</h3>
          <p className="text-sm text-gray-500 mt-1">누구나알바에 신청하려면 프리랜서 등록을 먼저 완료해 주세요.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[24px] border border-emerald-100">
          <p className="text-gray-600 font-bold mb-6 text-center">프리랜서 자격으로 누구나알바에 신청하려면<br />프리랜서 등록을 해주세요.</p>
          <button
            type="button"
            onClick={() => setShowRegModal(true)}
            className="px-12 py-4 rounded-xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700 shadow-lg transition-all"
          >
            프리랜서 등록하기
          </button>
        </div>
        {showRegModal && (
          <FreelancerRegistrationModal
            user={user}
            onClose={() => setShowRegModal(false)}
            onSubmit={handleFreelancerRegSubmit}
          />
        )}
      </div>
    );
  }

  if (isFreelancerPending) {
    return (
      <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-gray-100 space-y-10 animate-in fade-in duration-300">
        <div>
          <h3 className="text-2xl font-black text-gray-900 italic">프리랜서 워크페이스</h3>
          <p className="text-sm text-gray-500 mt-1">프리랜서 등록 신청이 접수되었습니다.</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 bg-amber-50 rounded-[24px] border border-amber-200">
          <p className="text-amber-800 font-black text-lg mb-2">승인 대기 중</p>
          <p className="text-amber-700 text-sm text-center">운영자가 정보를 확인한 후 승인됩니다.<br />2~3일 정도 소요될 수 있습니다.</p>
        </div>
      </div>
    );
  }

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

      <div className="max-w-md">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[24px] p-8 border border-emerald-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">
              🏦
            </div>
            <div>
              <p className="text-xs font-black text-gray-500 uppercase italic">수익통장</p>
              <p className="text-2xl font-black text-gray-900 italic">{balance.toLocaleString()}원</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            {MIN_WITHDRAW_FREELANCER.toLocaleString()}원 이상 모이면 등록된 통장으로 출금 신청할 수 있습니다.
            전문가정보에 통장을 등록해 주시면 출금 신청 시 해당 계좌로 입금됩니다.
          </p>
          {canWithdraw && !hasBankInfo && (
            <p className="text-xs text-amber-600 mt-2 font-bold">
              출금 전 <Link to="/mypage" state={{ activeTab: 'settings', openExpert: true } as any} className="underline hover:text-amber-700">전문가정보</Link>에서 통장(은행/계좌번호)을 등록해 주세요.
            </p>
          )}
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
            {withdrawing ? '처리 중...' : canWithdraw ? `전액 ${balance.toLocaleString()}원 출금 신청` : '5,000원 이상 시 출금 가능'}
          </button>
        </div>
      </div>

      {selectedTasks.length > 0 && (
        <div>
          <h4 className="font-black text-gray-800 mb-3">선정된 작업</h4>
          <p className="text-sm text-gray-500 mb-3">작업 완료 후 링크를 제출하면 운영자 확인 후 수익통장에 알바비가 적립됩니다.</p>
          <ul className="space-y-2">
            {selectedTasks.map((t) => {
              const me = t.applicants.find((a) => a.userId === user.id);
              const hasLink = (me?.workLinks?.length ?? 0) > 0 || !!me?.workLink;
              const status = t.paidUserIds?.includes(user.id)
                ? '알바비 지급됨'
                : hasLink
                  ? '링크 제출됨 (확인 대기)'
                  : '링크 미제출';
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-emerald-200">
                  <div>
                    <p className="font-black text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500">+{t.reward.toLocaleString()}원 · {status}</p>
                  </div>
                  <Link
                    to={`/part-time/${t.id}`}
                    className="shrink-0 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200"
                  >
                    상세/링크 제출
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 알바비 관리 - 입금 내역 + 일별/월별 그래프 */}
      <div className="border-t border-gray-100 pt-10">
        <h4 className="font-black text-gray-800 mb-1 flex items-center gap-2">
          <span className="text-xl">📊</span> 알바비 관리
        </h4>
        <p className="text-sm text-gray-500 mb-6">
          작업 완료 후 입금된 내역과 수익 현황을 확인하세요. 시시비비 가리지 않고 한눈에 확인!
        </p>

        {/* 일별/월별 그래프 */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h5 className="font-black text-gray-900">알바비 수익 현황</h5>
            <div className="flex p-1.5 bg-gray-100 rounded-full shadow-inner border border-gray-200/50">
              <button
                type="button"
                onClick={() => setChartTab('daily')}
                className={`px-6 py-2.5 rounded-full text-xs font-black transition-all ${chartTab === 'daily' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400'}`}
              >
                일별
              </button>
              <button
                type="button"
                onClick={() => setChartTab('monthly')}
                className={`px-6 py-2.5 rounded-full text-xs font-black transition-all ${chartTab === 'monthly' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400'}`}
              >
                월별
              </button>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === 'daily' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAlbaAmount" x1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                  <Tooltip formatter={(val: number) => [`${val.toLocaleString()}원`, '알바비']} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.08)', fontWeight: 900 }} />
                  <Area type="monotone" dataKey="금액" stroke="#059669" strokeWidth={4} fillOpacity={1} fill="url(#colorAlbaAmount)" />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => val.toLocaleString()} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                  <Tooltip cursor={{ fill: '#f8fafc', radius: 8 }} formatter={(val: number) => [`${val.toLocaleString()}원`, '월간 알바비']} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.08)', fontWeight: 900 }} />
                  <Bar dataKey="금액" radius={[8, 8, 0, 0]}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === new Date().getMonth() ? '#059669' : '#d1fae5'} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* 입금 내역 테이블 */}
        <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden shadow-sm mb-6">
          <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100">
            <h5 className="font-black text-gray-800 text-sm">입금 내역 (작업 완료 후 지급)</h5>
            <p className="text-xs text-gray-500 mt-0.5">입금날짜, 작업내역, 금액을 상세히 확인할 수 있습니다.</p>
          </div>
          {depositEntries.length === 0 ? (
            <div className="p-10 text-center text-gray-400 font-bold">
              아직 입금 내역이 없습니다.<br />
              <Link to="/part-time" className="text-emerald-600 hover:underline mt-2 inline-block font-black">누구나알바</Link>에서 작업을 완료하면 여기에 입금 내역이 쌓입니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">입금날짜</th>
                    <th className="px-6 py-4">작업내역</th>
                    <th className="px-6 py-4 text-right">금액 (원)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {depositEntries.slice(0, 50).map((entry) => (
                    <tr key={entry.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700 text-sm">
                        {new Date(entry.at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">{entry.label}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">+{entry.amount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-black text-gray-800 mb-4">수익통장 내역 (전체)</h4>
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
                    {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}원
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
