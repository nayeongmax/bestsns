import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { UserProfile } from '@/types';
import type { PartTimeTask, PartTimeJobRequest } from '@/types';
import {
  PAYMENT_GATEWAY_FEE_RATE,
  calcAdvertiserTotalPayment,
  getFreelancerBalance,
  getFreelancerHistory,
  withdrawFreelancerEarnings,
  addFreelancerWithdrawRequest,
  addFreelancerEarning,
  MIN_WITHDRAW_FREELANCER,
  FREELANCER_FEE_RATE,
  FREELANCER_SETTLEMENT_FEE_RATE,
  FREELANCER_WITHHOLDING_RATE,
  getPartTimeTasks,
  setPartTimeTasks,
  getPartTimeJobRequests,
  setPartTimeJobRequests,
  processAutoApprovals,
} from '@/constants';
import type { NotificationType } from '@/types';

interface Props {
  user: UserProfile;
  onUpdate: (updated: UserProfile) => void;
  onApplyFreelancer?: () => void;
  initialSubTab?: 'main' | 'tasks' | 'settlement' | 'alba';
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const FreelancerDashboard: React.FC<Props> = ({ user, onUpdate, onApplyFreelancer, initialSubTab, addNotif }) => {
  const navigate = useNavigate();
  const [freelancerTab, setFreelancerTab] = useState<'tasks' | 'settlement' | 'alba'>(() => (initialSubTab === 'main' ? 'tasks' : initialSubTab ?? 'tasks'));
  const [settlementMonth, setSettlementMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showFreelancerSettlementModal, setShowFreelancerSettlementModal] = useState(false);
  const [showAdvertiserSettlementModal, setShowAdvertiserSettlementModal] = useState(false);
  const [balance, setBalance] = useState(0);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [history, setHistory] = useState<ReturnType<typeof getFreelancerHistory>>([]);
  const [withdrawing, setWithdrawing] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<PartTimeTask[]>([]);
  const [chartTab, setChartTab] = useState<'daily' | 'monthly'>('daily');
  const [workConfirmModal, setWorkConfirmModal] = useState<{ task: PartTimeTask; isAdvertiserView: boolean; step?: 'check' | 'confirmed' } | null>(null);
  const [estimateViewJr, setEstimateViewJr] = useState<PartTimeJobRequest | null>(null);
  const [jobRequests, setJobRequests] = useState(() => getPartTimeJobRequests());
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());

  const myJobRequests = useMemo(() => jobRequests.filter((jr) => jr.applicantUserId === user.id), [jobRequests, user.id]);
  const myApprovedRequests = useMemo(() => myJobRequests.filter((jr) => jr.status === 'pending' && !jr.paid), [myJobRequests]);
  const myPaidRequests = useMemo(() => myJobRequests.filter((jr) => jr.paid), [myJobRequests]);
  const myRejectedRequests = useMemo(() => myJobRequests.filter((jr) => jr.status === 'not_selected'), [myJobRequests]);
  const myPendingReviewRequests = useMemo(() => myJobRequests.filter((jr) => jr.status === 'pending_review'), [myJobRequests]);
  const myTasksAsApplicant = useMemo(() => tasks.filter((t) => t.applicantUserId === user.id), [tasks, user.id]);
  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) => (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();

  useEffect(() => {
    if (initialSubTab === 'main') setFreelancerTab('tasks');
    else if (initialSubTab === 'tasks' || initialSubTab === 'settlement' || initialSubTab === 'alba') setFreelancerTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (freelancerTab === 'alba') processAutoApprovals();
    setJobRequests(getPartTimeJobRequests());
    setTasks(getPartTimeTasks());
  }, [freelancerTab]);

  /** 입금 내역 (작업 완료 후 지급된 알바비만) */
  const depositEntries = useMemo(
    () => history.filter((e) => e.type === 'task' && e.amount > 0),
    [history]
  );

  const getNetAmount = (e: (typeof history)[0]) =>
    e.type === 'task' && e.amount > 0 && !e.label?.includes('환급')
      ? Math.round(e.amount * (1 - FREELANCER_FEE_RATE))
      : e.amount;

  /** 일별/월별 알바비 차트 데이터 (실지급 기준) */
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
          .reduce((sum, e) => sum + getNetAmount(e), 0);
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
          .reduce((sum, e) => sum + getNetAmount(e), 0);
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

  const handleWithdrawClick = () => {
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
    setShowWithdrawModal(true);
  };

  const handleWithdrawConfirm = () => {
    if (!bankInfo) return;
    setShowWithdrawModal(false);
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
      setBalance(getFreelancerBalance(user.id));
      refresh();
      alert(
        `출금 신청이 완료되었습니다.\n출금일 기준 익일~3일 이내 신청한 계좌(${bankInfo.bankName} ${bankInfo.accountNo})로 입금됩니다.`
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
            onClick={() => {
              if (onApplyFreelancer) {
                onApplyFreelancer();
              } else {
                alert('전문가 정보에서 수익화할 내용을 작성하고, 운영자 승인을 받아야 합니다.');
              }
            }}
            className="px-12 py-4 rounded-xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700 shadow-lg transition-all"
          >
            프리랜서 등록하기
          </button>
        </div>
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

      <div className="flex gap-2 p-2 bg-gray-100/50 rounded-[32px] w-full shadow-inner">
        {[
          { id: 'tasks' as const, label: '작업내역' },
          { id: 'settlement' as const, label: '정산내역' },
          { id: 'alba' as const, label: '알바의뢰 (광고주전용)' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFreelancerTab(tab.id)}
            className={`flex-1 py-4 rounded-[24px] text-[15px] font-black transition-all duration-300 ${freelancerTab === tab.id ? 'bg-white text-emerald-600 shadow-md scale-100' : 'text-gray-400 hover:text-gray-600 hover:bg-white/30'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {freelancerTab === 'tasks' ? (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-gray-900">작업내역</h4>
            <Link to="/part-time" className="text-emerald-600 font-black text-sm hover:underline">누구나알바에서 작업하기 →</Link>
          </div>
      {selectedTasks.length > 0 && (
        <div>
          <h4 className="font-black text-gray-800 mb-3">선정된 작업</h4>
          <p className="text-sm text-gray-500 mb-3">작업 완료 후 링크를 제출하면 광고주 또는 운영자 확인 후 수익통장에 알바비가 적립됩니다.</p>
          <ul className="space-y-2">
            {selectedTasks.map((t) => {
              const me = t.applicants.find((a) => a.userId === user.id);
              const hasLink = (me?.workLinks?.length ?? 0) > 0 || !!me?.workLink;
              const hasRevision = !!me?.revisionRequest;
              const hasAutoApprove = !!me?.autoApproveAt && !t.paidUserIds?.includes(user.id);
              const status = t.paidUserIds?.includes(user.id)
                ? '알바비 지급됨'
                : hasRevision
                  ? '작업에 수정필요'
                  : hasLink
                    ? '링크 제출됨 (확인 대기)'
                    : '링크 미제출';
              const statusDesc = hasLink && !t.paidUserIds?.includes(user.id) && !hasRevision
                ? '광고주 확인 후 4~7일이내 수익통장에 충전됩니다.'
                : null;
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white border border-gray-100 hover:border-emerald-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-gray-900">{t.title}</p>
                      {t.projectNo && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t.projectNo}</span>}
                    </div>
                    <p className="text-xs text-gray-500">+{t.reward.toLocaleString()}원 · {status}</p>
                    {hasRevision && me?.revisionRequest && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                        <p className="text-xs font-black text-amber-700 uppercase">운영자 수정 요청</p>
                        <p className="text-sm text-amber-900 mt-0.5">{me.revisionRequest}</p>
                        <p className="text-xs text-amber-600 mt-1">아래 링크 수정 버튼으로 수정 후 재제출해 주세요.</p>
                      </div>
                    )}
                    {statusDesc && <p className="text-xs text-emerald-600 mt-1 font-bold">{statusDesc}</p>}
                    {hasAutoApprove && me?.autoApproveAt && (
                      <p className="text-xs text-blue-600 font-bold mt-1">
                        {new Date(me.autoApproveAt) > new Date()
                          ? `${Math.ceil((new Date(me.autoApproveAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))}일 후 자동 지급 예정 (${new Date(me.autoApproveAt).toLocaleString('ko-KR')})`
                          : '자동 지급 대기 중'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {(hasRevision || hasLink) && (
                      <Link to={`/part-time/${t.id}`} state={{ focusWorkLink: true } as any} className={`px-4 py-2 rounded-lg font-black text-sm ${hasRevision ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
                        수정
                      </Link>
                    )}
                    <button type="button" onClick={() => setWorkConfirmModal({ task: t, isAdvertiserView: false })} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-black text-sm hover:bg-gray-200">
                      작업확정서
                    </button>
                    {!hasLink && (
                      <Link to={`/part-time/${t.id}`} className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-black text-sm hover:bg-emerald-200">
                        상세/링크 제출
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {selectedTasks.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
          <p className="text-gray-400 font-bold">선정된 작업이 없습니다.</p>
          <Link to="/part-time" className="inline-block mt-4 text-emerald-600 font-black hover:underline">누구나알바에서 작업 보기 →</Link>
        </div>
      )}
        </div>
      ) : freelancerTab === 'settlement' ? (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h4 className="font-black text-gray-900">정산내역</h4>
            <button
              onClick={() => setShowFreelancerSettlementModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 text-indigo-600 font-black text-sm hover:bg-indigo-100 border border-indigo-100 shadow-sm"
            >
              정산 정책 안내
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </button>
          </div>

          <div className="max-w-md">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-[24px] p-8 border border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">🏦</div>
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase italic">정산수익통장 (실지급)</p>
                  <p className="text-2xl font-black text-gray-900 italic">{balance.toLocaleString()}원</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">정산 수수료·원천징수 제외 실지급액</p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                {MIN_WITHDRAW_FREELANCER.toLocaleString()}원 이상 모이면 출금 신청할 수 있습니다.
              </p>
              {canWithdraw && !hasBankInfo && (
                <p className="text-xs text-amber-600 mt-2 font-bold">
                  출금 전 <Link to="/mypage" state={{ activeTab: 'settings', openExpert: true } as any} className="underline">전문가정보</Link>에서 통장을 등록해 주세요.
                </p>
              )}
              <button
                type="button"
                onClick={handleWithdrawClick}
                disabled={!canWithdraw || withdrawing}
                className={`mt-4 w-full py-3 rounded-xl font-black text-sm ${canWithdraw && !withdrawing ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                {withdrawing ? '처리 중...' : canWithdraw ? `전액 ${balance.toLocaleString()}원 출금 신청` : '5,000원 이상 시 출금 가능'}
              </button>
            </div>
          </div>

          <div>
            <h5 className="font-black text-gray-800 mb-3">알바비 관리</h5>
            <div className="bg-white p-6 rounded-[24px] border border-gray-100 mb-6">
              <div className="flex p-1.5 bg-gray-100 rounded-full w-fit mb-4">
                <button type="button" onClick={() => setChartTab('daily')} className={`px-5 py-2 rounded-full text-xs font-black ${chartTab === 'daily' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>일별</button>
                <button type="button" onClick={() => setChartTab('monthly')} className={`px-5 py-2 rounded-full text-xs font-black ${chartTab === 'monthly' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>월별</button>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartTab === 'daily' ? (
                    <AreaChart data={chartData}>
                      <defs><linearGradient id="colorAlbaAmount" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.3} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString()}원`, '알바비']} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.08)', fontWeight: 900 }} />
                      <Area type="monotone" dataKey="금액" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorAlbaAmount)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} />
                      <Tooltip cursor={{ fill: '#f8fafc', radius: 8 }} formatter={(v: number) => [`${v.toLocaleString()}원`, '월간 알바비']} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.08)', fontWeight: 900 }} />
                      <Bar dataKey="금액" radius={[8, 8, 0, 0]}>{chartData.map((_, i) => <Cell key={i} fill={i === new Date().getMonth() ? '#059669' : '#d1fae5'} />)}</Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div>
            <h5 className="font-black text-gray-800 mb-2">입금 내역</h5>
            <div className="flex items-center gap-2 mb-3">
              <select value={settlementMonth} onChange={(e) => setSettlementMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold bg-white">
                {Array.from({ length: 24 }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  return <option key={v} value={v}>{d.getFullYear()}년 {d.getMonth() + 1}월</option>;
                })}
              </select>
            </div>
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
              {depositEntries.filter((e) => e.at.startsWith(settlementMonth)).length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-bold text-sm">해당 월 입금 내역이 없습니다.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-black text-gray-500 uppercase">
                    <tr><th className="px-5 py-3">날짜</th><th className="px-5 py-3">작업내역</th><th className="px-5 py-3 text-right">금액</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depositEntries.filter((e) => e.at.startsWith(settlementMonth)).map((entry) => (
                      <tr key={entry.id} className="hover:bg-emerald-50/30">
                        <td className="px-5 py-3 font-bold text-gray-700">{new Date(entry.at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-5 py-3 font-black text-gray-900">{entry.label}</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-600">+{getNetAmount(entry).toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <h5 className="font-black text-gray-800 mb-2">수익통장 내역 (전체)</h5>
            <div className="flex items-center gap-2 mb-3">
              <select value={settlementMonth} onChange={(e) => setSettlementMonth(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold bg-white">
                {Array.from({ length: 24 }, (_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  return <option key={v} value={v}>{d.getFullYear()}년 {d.getMonth() + 1}월</option>;
                })}
              </select>
            </div>
            <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
              {history.filter((e) => e.at.startsWith(settlementMonth)).length === 0 ? (
                <div className="p-8 text-center text-gray-400 font-bold text-sm">해당 월 내역이 없습니다.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {history.filter((e) => e.at.startsWith(settlementMonth)).map((entry) => {
                    const isRefund = entry.label?.includes('환급');
                    const isTaskEarn = entry.type === 'task' && entry.amount > 0 && !isRefund;
                    const netAmount = isTaskEarn ? Math.round(entry.amount * (1 - FREELANCER_FEE_RATE)) : entry.amount;
                    return (
                      <li key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{entry.type === 'task' ? '💰' : '📤'}</span>
                          <div>
                            <p className="font-bold text-gray-800">{entry.label}</p>
                            <p className="text-[11px] text-gray-400">{new Date(entry.at).toLocaleString('ko-KR')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {isTaskEarn ? (
                            <p className="font-black text-emerald-600">받는 {entry.amount.toLocaleString()}원 / 실지급 {netAmount.toLocaleString()}원</p>
                          ) : (
                            <p className={`font-black ${entry.amount >= 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}원</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h4 className="font-black text-gray-900">알바의뢰 (광고주전용)</h4>
            <button onClick={() => setShowAdvertiserSettlementModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 text-indigo-600 font-black text-sm hover:bg-indigo-100 border border-indigo-100 shadow-sm">
              정산 정책 안내
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </button>
          </div>
          {myPendingReviewRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">검토 대기</h4>
              {myPendingReviewRequests.map((jr) => {
                const hasEstimate = !!(jr.operatorEstimate);
                return (
                  <div key={jr.id} className={`p-6 rounded-[32px] shadow-sm border flex flex-col sm:flex-row justify-between items-start gap-4 ${hasEstimate ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                      <p className="text-gray-500 mt-2 line-clamp-2">{jr.workContent}</p>
                      {hasEstimate ? (
                        <span className="inline-block mt-3 px-3 py-1 rounded-lg bg-emerald-200 text-emerald-800 text-xs font-black">견적서가 도착했습니다!</span>
                      ) : (
                        <span className="inline-block mt-3 px-3 py-1 rounded-lg bg-amber-200 text-amber-800 text-xs font-black">운영자 검토 중</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {hasEstimate && (
                        <>
                          <button type="button" onClick={() => setEstimateViewJr(jr)} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">견적서확인</button>
                          {!jr.paid && (
                            <button type="button" onClick={() => navigate('/payment/alba', { state: { jobRequest: jr } })} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">결제하기</button>
                          )}
                          {jr.paid && <span className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">결제 완료</span>}
                        </>
                      )}
                      {!hasEstimate && <Link to="/part-time/request" state={{ editJobRequest: jr, fromAlba: true }} className="px-6 py-3 rounded-xl bg-gray-600 text-white font-black hover:bg-gray-700">수정하기</Link>}
                      <button type="button" onClick={() => { if (!confirm('정말 삭제하시겠습니까?')) return; const next = jobRequests.filter((r) => r.id !== jr.id); setPartTimeJobRequests(next); setJobRequests(next); alert('삭제되었습니다.'); }} className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200">삭제</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {myRejectedRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">거절 · 수정 필요</h4>
              {myRejectedRequests.map((jr) => (
                <div key={jr.id} className="bg-red-50/50 p-6 rounded-[32px] shadow-sm border border-red-100 flex flex-col gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                    <p className="text-gray-500 mt-2 line-clamp-2">{jr.workContent}</p>
                    {jr.rejectReason && <div className="mt-3 p-3 rounded-xl bg-white border border-red-100"><p className="text-xs font-black text-red-600 uppercase">거절 사유</p><p className="text-gray-800 font-bold mt-1">{jr.rejectReason}</p></div>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link to="/part-time/request" state={{ editJobRequest: jr, fromAlba: true }} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">수정하기</Link>
                    <button type="button" onClick={() => { if (!confirm('정말 삭제하시겠습니까?')) return; const next = jobRequests.filter((r) => r.id !== jr.id); setPartTimeJobRequests(next); setJobRequests(next); alert('삭제되었습니다.'); }} className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200">삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {myApprovedRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">승인 완료 · 결제 대기</h4>
              {myApprovedRequests.map((jr) => (
                <div key={jr.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-start gap-10">
                  <div className="flex-1 min-w-0 space-y-4">
                    <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                    <p className="text-gray-500 line-clamp-2">{jr.workContent}</p>
                    {jr.operatorEstimate ? (
                      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-6">
                        <p className="text-xs font-black text-slate-500 uppercase mb-4">견 적 서</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">{jr.operatorEstimate.unitPrice != null && jr.operatorEstimate.quantity != null ? `단가 (${jr.operatorEstimate.unitPrice.toLocaleString()}원 × ${jr.operatorEstimate.quantity}개)` : '광고금액'}</span>
                            <span className="font-bold text-gray-900">{jr.operatorEstimate.totalAmount.toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">수수료 (25% + 부가세)</span>
                            <span className="font-bold text-gray-900">{jr.operatorEstimate.fee.toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between pt-3 mt-3 border-t-2 border-slate-200">
                            <span className="font-black text-gray-900">총 결제금액</span>
                            <span className="font-black text-emerald-600 text-lg">{(jr.operatorEstimate.totalAmount + jr.operatorEstimate.fee).toLocaleString()}원</span>
                          </div>
                          {jr.operatorEstimate.note && <p className="mt-3 text-gray-600 text-xs">{jr.operatorEstimate.note}</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="font-bold text-gray-700">{jr.unitPrice != null && jr.quantity != null ? `단가 ${jr.unitPrice.toLocaleString()}원 × ${jr.quantity}개` : `광고금액: ${jr.adAmount.toLocaleString()}원`}</span>
                        <span className="font-bold text-gray-700">수수료: {jr.fee.toLocaleString()}원</span>
                        <span className="font-black text-emerald-600">총 결제: {calcAdvertiserTotalPayment(jr.adAmount).toLocaleString()}원</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => navigate('/payment/alba', { state: { jobRequest: jr } })} className="px-10 py-4 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shrink-0">결제하기 ({calcAdvertiserTotalPayment(jr.adAmount).toLocaleString()}원)</button>
                </div>
              ))}
            </div>
          )}
          {myPaidRequests.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">프리랜서 모집</h4>
              {myPaidRequests.map((jr) => {
                const linkedTask = tasks.find((t) => t.jobRequestId === jr.id);
                const selectedWithLink = linkedTask?.applicants.filter((a) => a.selected && hasWorkLink(a)) ?? [];
                const allPaid = linkedTask && selectedWithLink.length > 0 && selectedWithLink.every((a) => linkedTask.paidUserIds?.includes(a.userId));
                const hasDelivery = selectedWithLink.some((a) => a.deliveryAt);
                const statusStep = !linkedTask ? '모집진행중' : linkedTask.applicants.length === 0 ? '모집진행중' : selectedWithLink.length === 0 ? '프리랜서선정완료' : allPaid ? '작업확정완료' : hasDelivery ? '작업완료' : '작업중';
                return (
                  <div key={jr.id} className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                      <h4 className="font-black text-gray-900 text-lg">{jr.title}</h4>
                      <span className={`px-3 py-1 rounded-lg text-xs font-black ${statusStep === '모집진행중' ? 'bg-gray-200 text-gray-700' : statusStep === '프리랜서선정완료' ? 'bg-blue-100 text-blue-700' : statusStep === '작업중' ? 'bg-amber-100 text-amber-700' : statusStep === '작업완료' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {statusStep}
                      </span>
                    </div>
                    {linkedTask ? (
                      <div className="space-y-3">
                        {selectedWithLink.length > 0 && (
                          <div>
                            <p className="text-xs font-black text-gray-500 uppercase mb-2">작업 링크</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedWithLink.flatMap((a) => (a.workLinks ?? (a.workLink ? [a.workLink] : [])).filter(Boolean).map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-sm hover:underline break-all">{url}</a>
                              )))}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setWorkConfirmModal({ task: linkedTask, isAdvertiserView: true, step: selectedWithLink.length > 0 ? 'check' : 'confirmed' })} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700">
                            {selectedWithLink.length > 0 ? '링크 확인 · 작업확정' : '작업확정서'}
                          </button>
                          <Link to="/chat" state={{ targetUser: { id: 'admin', nickname: '플랫폼 운영자', profileImage: '' } } as any} className="px-4 py-2 rounded-xl border-2 border-gray-300 text-gray-700 font-black text-sm hover:bg-gray-100">문의요청</Link>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">운영자가 작업을 등록하면 프리랜서 모집이 시작됩니다.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {myTasksAsApplicant.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-black text-gray-900">의뢰 진행 현황</h4>
              {myTasksAsApplicant.map((t) => {
                const selectedWithLink = t.applicants.filter((a) => a.selected && hasWorkLink(a));
                const hasDelivery = selectedWithLink.some((a) => a.deliveryAt);
                const allPaid = selectedWithLink.length > 0 && selectedWithLink.every((a) => t.paidUserIds?.includes(a.userId));
                const statusLabel = t.applicants.length === 0 ? '모집중' : selectedWithLink.length === 0 ? '선정완료' : allPaid ? '대금지급 완료' : hasDelivery ? '3일 이내 자동확정' : '검수중';
                return (
                  <div key={t.id} className="bg-white p-8 rounded-[48px] shadow-sm border border-gray-100 flex flex-col gap-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-gray-900 text-lg">{t.title}</h4>
                          {t.projectNo && <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t.projectNo}</span>}
                        </div>
                        <p className="text-gray-500 mt-2 line-clamp-2">{t.description}</p>
                        <p className="text-sm text-gray-500 mt-2">작업기간: {t.workPeriod?.start ?? '-'} ~ {t.workPeriod?.end ?? '-'}</p>
                        <span className={`inline-block mt-3 px-3 py-1 rounded-lg text-xs font-black ${statusLabel === '모집중' ? 'bg-gray-200 text-gray-700' : statusLabel === '선정완료' ? 'bg-blue-100 text-blue-700' : statusLabel === '검수중' ? 'bg-amber-100 text-amber-700' : statusLabel === '3일 이내 자동확정' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{statusLabel}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {selectedWithLink.length > 0 ? (
                          <button onClick={() => setWorkConfirmModal({ task: t, isAdvertiserView: true, step: 'check' })} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all">결과물 확인</button>
                        ) : (
                          <button onClick={() => setWorkConfirmModal({ task: t, isAdvertiserView: true, step: 'confirmed' })} className="px-6 py-3 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-700 transition-all">작업확정서</button>
                        )}
                        <Link to="/chat" state={{ targetUser: { id: 'admin', nickname: '플랫폼 운영자', profileImage: '' } } as any} className="px-6 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-black hover:bg-gray-100 transition-all">문의요청</Link>
                      </div>
                    </div>
                    {selectedWithLink.length > 0 && (
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-black text-gray-500 uppercase mb-2">작업 링크</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedWithLink.flatMap((a) => (a.workLinks ?? (a.workLink ? [a.workLink] : []))).filter(Boolean).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold text-sm hover:underline break-all">{url}</a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {myJobRequests.length === 0 && myTasksAsApplicant.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[40px] border border-dashed border-gray-100">
              <p className="text-gray-300 font-black italic">알바의뢰 내역이 없습니다.</p>
              <Link to="/part-time/request" className="inline-block mt-4 text-emerald-600 font-black hover:underline">작업의뢰 신청하러 가기 →</Link>
            </div>
          )}
        </div>
      )}

      {estimateViewJr && estimateViewJr.operatorEstimate && (() => {
        const est = estimateViewJr.operatorEstimate;
        const subTotal = est.totalAmount;
        const platformFee = est.fee;
        const beforePg = subTotal + platformFee;
        const pgFee = Math.round(beforePg * PAYMENT_GATEWAY_FEE_RATE);
        const totalPay = beforePg + pgFee;
        const handlePdfDownload = () => {
          const cell = (align: string, bold?: boolean) => `style="border:1px solid #e5e7eb;padding:8px;text-align:${align}${bold ? ';font-weight:bold' : ''}"`;
          const itemsHtml = (est.items && est.items.length > 0)
            ? est.items.map((it: { seq: number; content: string; unitPrice: number; quantity: number; amount: number; remarks?: string }) =>
              `<tr><td ${cell('center')}>${it.seq}</td><td ${cell('left')}>${it.content}</td><td ${cell('right')}>${it.unitPrice.toLocaleString()}</td><td ${cell('center')}>${it.quantity}</td><td ${cell('right', true)}>${it.amount.toLocaleString()}</td><td ${cell('left')}>${it.remarks || ''}</td></tr>`
            ).join('')
            : `<tr><td ${cell('center')}>1</td><td ${cell('left')}>${estimateViewJr.workContent}</td><td ${cell('right')}>${est.unitPrice?.toLocaleString() ?? '-'}</td><td ${cell('center')}>${est.quantity ?? 1}</td><td ${cell('right', true)}>${est.totalAmount.toLocaleString()}</td><td ${cell('left')}></td></tr>`;
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.');
            return;
          }
          printWindow.document.write(`
<!DOCTYPE html><html><head><meta charset="utf-8"><title>견적서</title>
<style>body{font-family:Malgun Gothic,sans-serif;padding:24px;max-width:800px;margin:0 auto;font-size:13px}
h2{text-align:center;margin:0 0 8px}.meta{text-align:center;color:#666;font-size:12px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.section{background:#f9fafb;padding:12px;border-radius:8px}
.label{font-size:11px;font-weight:bold;color:#666;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
th{background:#ecfdf5;font-weight:bold;font-size:11px}
.tc{text-align:center;white-space:nowrap}.tr{text-align:right}.b{font-weight:bold}
.fee-detail{font-size:11px;color:#666;margin-top:4px}
.total{font-size:16px;font-weight:bold;color:#059669}
.footer{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af}
@media print{.no-print{display:none}}
</style></head><body>
<h2>THEBEST<span style="color:#2563eb">SNS</span> 견적서</h2>
<p class="meta">견적일자: ${new Date(est.sentAt).toLocaleDateString('ko-KR')}${est.workName ? ' · ' + est.workName : ''}</p>
<div class="grid"><div class="section"><div class="label">공급처</div><p><strong>상호</strong> THEBESTSNS<br><strong>대표자</strong> 김나영<br><strong>주소</strong> 대구광역시 달성군 현풍로6길 5<br><strong>사업자번호</strong> 409-30-51469</p></div>
<div class="section"><div class="label">수신처</div><p><strong>${est.recipientName || '광고주'}</strong><br>${est.recipientContact || estimateViewJr.contact}</p></div></div>
${est.workPeriod ? `<p class="label">작업기간 : ${est.workPeriod}</p>` : ''}
<table><thead><tr><th class="tc">순번</th><th>내용</th><th class="tr">단가</th><th class="tc">수량</th><th class="tr">금액</th><th>비고</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px">
<div style="display:flex;justify-content:space-between"><span>소계 (광고금액)</span><span><strong>${subTotal.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:8px"><span>플랫폼 수수료 (광고금액의 25% + 부가세 10%)<span class="fee-detail"><br>${subTotal.toLocaleString()} × 25% = ${Math.round(subTotal * 0.25).toLocaleString()}원, 부가세 ${Math.round(Math.round(subTotal * 0.25) * 0.1).toLocaleString()}원</span></span><span><strong>${platformFee.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:8px"><span>결제망 수수료 (3.3%)<span class="fee-detail"><br>(${subTotal.toLocaleString()}+${platformFee.toLocaleString()}) × 3.3%</span></span><span><strong>${pgFee.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:2px solid #d1d5db"><span class="total">총 결제금액</span><span class="total">${totalPay.toLocaleString()}원</span></div>
</div>
${est.note ? `<p style="margin-top:12px;font-size:12px;color:#6b7280">추가 안내: ${est.note}</p>` : ''}
<div class="footer"><p style="font-size:18px;font-weight:bold;color:#1f2937">THEBEST<span style="color:#2563eb">SNS</span></p><p>© THEBESTSNS. All rights reserved.</p></div>
<p class="no-print" style="margin-top:16px;text-align:center;font-size:12px;color:#666">인쇄 대화상자에서 <strong>대상 > PDF로 저장</strong>을 선택하면 파일로 저장할 수 있습니다.</p>
</body></html>`);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
        };
        return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div id="estimate-pdf-content" className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
              <h4 className="font-black text-gray-900">견적서</h4>
              <button type="button" onClick={() => setEstimateViewJr(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">✕</button>
            </div>
            <div className="p-8 space-y-6">
              <div className="text-center border-b border-gray-200 pb-4">
                <p className="text-2xl font-black text-gray-900">THEBEST<span className="text-blue-600">SNS</span> 견적서</p>
                <p className="text-xs text-gray-500 mt-1">견적일자: {new Date(est.sentAt).toLocaleDateString('ko-KR')}{est.workName && ` · ${est.workName}`}</p>
              </div>
              <div className="grid grid-cols-2 gap-8 border-b border-gray-200 pb-6">
                <div><p className="text-xs font-black text-gray-500 uppercase mb-2">공급처</p><div className="text-sm text-gray-700 space-y-1"><p><strong>상호</strong> THEBESTSNS</p><p><strong>대표자</strong> 김나영</p><p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p><p><strong>사업자번호</strong> 409-30-51469</p></div></div>
                <div><p className="text-xs font-black text-gray-500 uppercase mb-2">수신처</p><div className="text-sm text-gray-700 space-y-1"><p><strong>{est.recipientName || '광고주'}</strong></p><p>{est.recipientContact || estimateViewJr.contact}</p></div></div>
              </div>
              {est.workPeriod && <p className="text-sm font-black text-gray-600">작업기간 : {est.workPeriod}</p>}
              <div>
                <p className="text-xs font-black text-gray-500 uppercase mb-3">견적항목</p>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-emerald-50 text-gray-700"><th className="px-4 py-2 text-center font-black whitespace-nowrap">순번</th><th className="px-4 py-2 text-left font-black">내용</th><th className="px-4 py-2 text-right font-black w-24">단가</th><th className="px-4 py-2 text-center font-black w-16">수량</th><th className="px-4 py-2 text-right font-black w-28">금액</th><th className="px-4 py-2 text-left font-black w-24">비고</th></tr></thead>
                    <tbody>
                      {(est.items && est.items.length > 0) ? est.items.map((item: { seq: number; content: string; unitPrice: number; quantity: number; amount: number; remarks?: string }, i: number) => (
                        <tr key={i} className="border-t border-gray-100"><td className="px-4 py-3 text-center font-bold">{item.seq}</td><td className="px-4 py-3 text-gray-700 whitespace-pre-wrap">{item.content}</td><td className="px-4 py-3 text-right">{item.unitPrice.toLocaleString()}</td><td className="px-4 py-3 text-center">{item.quantity}</td><td className="px-4 py-3 text-right font-bold">{item.amount.toLocaleString()}</td><td className="px-4 py-3 text-gray-600 text-xs">{item.remarks || ''}</td></tr>
                      )) : (
                        <tr className="border-t border-gray-100"><td className="px-4 py-3 text-center font-bold">1</td><td className="px-4 py-3 text-gray-700">{estimateViewJr.workContent}</td><td className="px-4 py-3 text-right">{est.unitPrice?.toLocaleString() ?? '-'}</td><td className="px-4 py-3 text-center">{est.quantity ?? 1}</td><td className="px-4 py-3 text-right font-bold">{est.totalAmount.toLocaleString()}</td><td className="px-4 py-3 text-gray-600 text-xs"></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 space-y-2 text-sm bg-gray-50 p-4 rounded-xl">
                  <div className="flex justify-between"><span className="text-gray-600">소계 (광고금액)</span><span className="font-bold">{subTotal.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">플랫폼 수수료 (광고금액 25% + 부가세 10%)<br /><span className="text-xs text-gray-500">{subTotal.toLocaleString()} × 25% = {Math.round(subTotal * 0.25).toLocaleString()}원, 부가세 {Math.round(Math.round(subTotal * 0.25) * 0.1).toLocaleString()}원</span></span><span className="font-bold">{platformFee.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">결제망 수수료 (3.3%)<br /><span className="text-xs text-gray-500">({subTotal.toLocaleString()}+{platformFee.toLocaleString()}) × 3.3%</span></span><span className="font-bold">{pgFee.toLocaleString()}원</span></div>
                  <div className="flex justify-between pt-3 mt-3 border-t-2 border-gray-200"><span className="font-black text-gray-900">총 결제금액</span><span className="font-black text-emerald-600 text-lg">{totalPay.toLocaleString()}원</span></div>
                </div>
                {est.note && <p className="mt-3 text-gray-600 text-sm">추가 안내: {est.note}</p>}
              </div>
              <div className="pt-4 border-t border-gray-200 text-center"><p className="text-xl font-black text-gray-800">THEBEST<span className="text-blue-600">SNS</span></p><p className="text-xs text-gray-400 mt-1">© THEBESTSNS. All rights reserved.</p></div>
              <div className="flex gap-3 justify-center pt-2">
                <button onClick={() => setEstimateViewJr(null)} className="px-8 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">닫기</button>
                <button onClick={handlePdfDownload} className="px-8 py-3 rounded-xl bg-slate-600 text-white font-black hover:bg-slate-700">내려받기</button>
                <button onClick={() => { setEstimateViewJr(null); navigate('/payment/alba', { state: { jobRequest: estimateViewJr } }); }} className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">결제하기</button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {workConfirmModal && (() => {
        const { task, isAdvertiserView, step = 'confirmed' } = workConfirmModal;
        const selectedWithLink = task.applicants.filter((a) => a.selected && ((a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim()));
        const workLinksList = selectedWithLink.flatMap((a) => a.workLinks ?? (a.workLink ? [a.workLink] : [])).filter(Boolean);
        const deductedReward = Math.round(task.reward * (1 - FREELANCER_FEE_RATE));
        const isCheckStep = isAdvertiserView && step === 'check';

        const handlePayAndShowConfirm = () => {
          if (!confirm(`작업 결과물을 확인하셨나요? ${selectedWithLink.length}명에게 각 ${task.reward.toLocaleString()}원을 즉시 지급합니다.`)) return;
          selectedWithLink.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
          if (addNotif) {
            selectedWithLink.forEach((a) =>
              addNotif(a.userId, 'freelancer', '알바비 지급 완료', `[${task.title}] 광고주 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`, `작업이 확인되어 수익통장에 ${task.reward.toLocaleString()}원이 적립되었습니다.`)
            );
          }
          const paidIds = [...(task.paidUserIds || []), ...selectedWithLink.map((a) => a.userId)];
          const nextTasks = tasks.map((t) =>
            t.id !== task.id ? t : { ...t, pointPaid: true, paidUserIds: paidIds }
          );
          setPartTimeTasks(nextTasks);
          setTasks(nextTasks);
          setWorkConfirmModal({ task: { ...task, pointPaid: true, paidUserIds: paidIds }, isAdvertiserView: true, step: 'confirmed' });
          alert('작업완료 처리되었습니다. 아래에서 작업확정서를 PDF로 저장할 수 있습니다.');
        };

        const handlePdfDownload = () => {
          const printContent = document.getElementById('work-confirm-print');
          if (!printContent) return;
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            window.print();
            return;
          }
          printWindow.document.write(`
            <!DOCTYPE html><html><head><meta charset="utf-8"><title>작업확정서</title>
            <style>body{font-family:Malgun Gothic,sans-serif;padding:24px;max-width:600px;margin:0 auto;font-size:14px}
            h2{margin:0 0 16px;font-size:18px} .section{margin-bottom:16px}
            .label{font-size:11px;color:#666;font-weight:bold;margin-bottom:4px}
            .value{color:#333} a{color:#059669;word-break:break-all}
            </style></head><body>
            <h2>프로젝트 작업확정서 ${isAdvertiserView ? '(광고주용)' : '(프리랜서용)'}</h2>
            <p style="font-size:12px;color:#666">본 문서의 내용은 이용약관에 의거하여 결제 시점부터 법적 효력이 발생합니다.</p>
            <div class="section"><div class="label">1. 프로젝트 번호 및 계약당사자</div>
            <div class="value">프로젝트번호: ${task.projectNo || '-'}</div>
            <div class="value">프로젝트명: ${task.title}</div>
            <div class="value">재위탁 수행자: ${task.applicants.filter((a) => a.selected).map((a) => a.nickname).join(', ') || '-'}</div></div>
            <div class="section"><div class="label">2. 업무 범위 및 단가</div>
            <div class="value">과업 내용: ${task.description}</div>
            <div class="value">최종 납기: ${task.workPeriod?.end ?? '-'}</div>
            <div class="value" style="font-weight:bold;color:#059669">총 계약 금액: ₩${task.reward.toLocaleString()}</div>
            ${!isAdvertiserView ? `<div class="value">지급대금 (5%+3.3% 차감): ₩${deductedReward.toLocaleString()}</div>` : ''}</div>
            ${workLinksList.length > 0 ? `<div class="section"><div class="label">3. 작업 링크</div><ul>${workLinksList.map((u) => `<li><a href="${u}">${u}</a></li>`).join('')}</ul></div>` : ''}
            <div class="section"><div class="label">취소·환불·검수·위약벌</div>
            <div class="value">작업 시작 전 전액 취소·환불 가능. 결과물 전달일로부터 3일 이내 이의없으면 자동 승인. 직거래 시 거래액 10배 위약벌.</div></div>
            </body></html>`);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        };

        if (isCheckStep) {
          return (
            <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in overflow-y-auto">
              <div className="bg-white w-full max-w-2xl rounded-[48px] p-10 shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-900">결과물 확인</h3>
                  <button onClick={() => setWorkConfirmModal(null)} className="text-gray-400 hover:text-gray-800 text-2xl font-bold">×</button>
                </div>
                <p className="text-sm text-gray-600">아래 작업 링크를 확인하고 문제없으면 즉시지급을 눌러 주세요.</p>
                <div className="space-y-2">
                  <p className="text-xs font-black text-gray-500 uppercase">작업 링크</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {workLinksList.map((url, i) => (
                      <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all hover:underline">{url}</a></li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button onClick={handlePayAndShowConfirm} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">즉시지급</button>
                  <button onClick={() => setWorkConfirmModal(null)} className="flex-1 py-4 rounded-xl bg-gray-200 text-gray-700 font-black">취소</button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in overflow-y-auto">
            <div id="work-confirm-print" className="bg-white w-full max-w-2xl rounded-[48px] p-10 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-gray-900">📂 프로젝트 작업확정서 {isAdvertiserView ? '(광고주용)' : '(프리랜서용)'}</h3>
                <button onClick={() => setWorkConfirmModal(null)} className="text-gray-400 hover:text-gray-800 text-2xl font-bold">×</button>
              </div>
              <p className="text-xs text-gray-500">본 문서의 내용은 이용약관에 의거하여 결제 시점부터 법적 효력이 발생합니다.</p>
              <div className="space-y-6 text-sm">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase mb-2">1. 프로젝트 번호 및 계약당사자</p>
                  <p className="font-bold text-gray-800">프로젝트번호: {task.projectNo || '-'}</p>
                  <p className="font-bold text-gray-800 mt-1">프로젝트명: {task.title}</p>
                  <p className="text-gray-600 mt-1">재위탁 수행자(프리랜서): {task.applicants.filter((a) => a.selected).map((a) => a.nickname).join(', ') || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase mb-2">2. 업무 범위 및 단가</p>
                  <p className="font-bold text-gray-800">과업 내용: {task.description}</p>
                  <p className="text-gray-600 mt-1">최종 납기: {task.workPeriod?.end ?? '-'}</p>
                  <p className="text-emerald-600 font-black mt-1">총 계약 금액: ₩{task.reward.toLocaleString()} (VAT 포함)</p>
                  {!isAdvertiserView && (
                    <p className="text-gray-600 mt-1">지급대금 (정산 수수료 5% + 원천징수 3.3% 차감): ₩{deductedReward.toLocaleString()}</p>
                  )}
                </div>
                {isAdvertiserView && workLinksList.length > 0 && (
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase mb-2">3. 작업 링크</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {workLinksList.map((url, i) => (
                        <li key={i}><a href={url} className="text-blue-600 break-all" rel="noopener noreferrer" target="_blank">{url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase mb-2">{isAdvertiserView ? (workLinksList.length > 0 ? '4' : '3') : '3'}. 취소 및 환불 규정</p>
                  <p className="text-gray-700 leading-relaxed text-sm">작업 시작 전: 언제든 전액 취소·환불 가능합니다. 작업 시작 후: 프리랜서 선정이 끝난 경우 작업내용 전달이 되어 환불이 어렵습니다.</p>
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase mb-2">{isAdvertiserView ? (workLinksList.length > 0 ? '5' : '4') : '4'}. 검수 및 A/S 규정</p>
                  {isAdvertiserView ? (
                    <p className="text-gray-700 leading-relaxed">A/S 진행: 결과물 전달일로부터 3일 이내.<br />해당 기간 내 광고주 이의없으면 자동 승인 및 수익통장 적립.</p>
                  ) : (
                    <p className="text-gray-700 leading-relaxed">A/S 진행: 결과물 전달일로부터 3일 이내.<br />해당 기간 내 광고주 이의없으면 자동 승인 및 수익통장 적립.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase mb-2">{isAdvertiserView ? (workLinksList.length > 0 ? '6' : '5') : '5'}. 위약벌 및 법적 조치</p>
                  <p className="text-gray-700 leading-relaxed">직거래 시도 시 거래액 10배 위약벌 청구 및 영구 제명.<br />작업결과물 삭제불가. 게시글/대화 기록 임의 삭제 불가.</p>
                </div>
                {!isAdvertiserView && (
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase mb-2">6. 정산 시점 및 파트너 준수 사항</p>
                    <p className="text-gray-700 leading-relaxed">정산 시점: 작업완료일로부터 4~7일 수익통장에 적립.<br />(광고주 작업완료는 프리랜서 작업완료일로부터 최대 3일임을 감안한 일정)<br /><br />본 건은 플랫폼으로부터 재위탁받은 업무이며, 광고주와 직접 계약 관계가 없음을 인지합니다.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handlePdfDownload} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">PDF 저장</button>
                <button onClick={() => setWorkConfirmModal(null)} className="flex-1 py-4 rounded-xl bg-gray-900 text-white font-black">확인</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 프리랜서 정산정책안내 모달 (n잡스토어 스타일) */}
      {showFreelancerSettlementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowFreelancerSettlementModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-100">
              <h3 className="text-xl font-black text-indigo-600 text-center">수익금 정산 정책 가이드</h3>
              <p className="text-xs text-gray-500 mt-1 text-center">프리랜서 · 수익통장 실지급 기준</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-2 w-full">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">👤</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">플랫폼 수수료</p><p className="text-sm font-black text-indigo-600">5%</p></div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">📄</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">원천징수</p><p className="text-sm font-black text-indigo-600">3.3%</p></div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">💳</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">결제수수료</p><p className="text-sm font-black text-indigo-600">3.3%</p></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                <p className="text-sm font-black text-gray-800">예시: 50,000원 작업 완료 시</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  <li>· 플랫폼 수수료 (5%): - ₩2,500</li>
                  <li>· 원천징수 (3.3%): - ₩1,650</li>
                  <li>· 결제수수료 (3.3%): - ₩1,650</li>
                  <li className="pt-1 font-black text-indigo-600">최종 통장 수령 금액: ₩44,200</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                <p className="text-sm font-black text-gray-800">예시: 100,000원 작업 완료 시</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  <li>· 플랫폼 수수료 (5%): - ₩5,000</li>
                  <li>· 원천징수 (3.3%): - ₩3,300</li>
                  <li>· 결제수수료 (3.3%): - ₩3,300</li>
                  <li className="pt-1 font-black text-indigo-600">최종 통장 수령 금액: ₩88,400</li>
                </ul>
              </div>
              <p className="text-[11px] text-gray-500">※ 출금 신청 시 추가 수수료 없음</p>
            </div>
            <div className="px-8 py-4 bg-gray-100 border-t border-gray-200">
              <button onClick={() => setShowFreelancerSettlementModal(false)} className="w-full py-3 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-900">내용을 모두 확인했습니다</button>
            </div>
          </div>
        </div>
      )}

      {/* 광고주 정산정책안내 모달 (n잡스토어 스타일) */}
      {showAdvertiserSettlementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdvertiserSettlementModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 py-6 border-b border-gray-100">
              <h3 className="text-xl font-black text-indigo-600 text-center">수익금 정산 정책 가이드</h3>
              <p className="text-xs text-gray-500 mt-1 text-center">알바의뢰 · 광고주 부담 수수료</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-2 w-full">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">🏢</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">플랫폼 수수료</p><p className="text-sm font-black text-indigo-600">25%</p></div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">💳</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">결제망 수수료</p><p className="text-sm font-black text-indigo-600">3.3%</p></div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="text-lg">📋</span>
                  <div className="min-w-0"><p className="text-[10px] font-black text-gray-500 uppercase">부가세</p><p className="text-sm font-black text-indigo-600">10%</p></div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                <p className="text-sm font-black text-gray-800">예시: 광고비 100,000원 결제 시</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  <li>· 플랫폼 수수료 (25%): ₩25,000</li>
                  <li>· 부가세 (수수료의 10%): ₩2,500</li>
                  <li>· 결제망 수수료 (3.3%): (100,000+27,500) × 3.3% = ₩4,208</li>
                  <li className="pt-1 font-black text-indigo-600">총 결제 금액: ₩131,708</li>
                </ul>
              </div>
              <p className="text-[11px] text-gray-500">※ 작업 의뢰 시 광고주가 부담하는 수수료입니다.</p>
            </div>
            <div className="px-8 py-4 bg-gray-100 border-t border-gray-200">
              <button onClick={() => setShowAdvertiserSettlementModal(false)} className="w-full py-3 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-900">내용을 모두 확인했습니다</button>
            </div>
          </div>
        </div>
      )}

      {/* 출금 신청 확인 모달 */}
      {showWithdrawModal && bankInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowWithdrawModal(false)}>
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black text-gray-900 mb-6">출금 신청 확인</h3>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-1">은행명</p>
                <p className="font-bold text-gray-800">{bankInfo.bankName}</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-1">계좌번호</p>
                <p className="font-bold text-gray-800">{bankInfo.accountNo}</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase mb-1">출금 금액</p>
                <p className="font-black text-emerald-600 text-xl">{balance.toLocaleString()}원</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-amber-50 rounded-xl p-4 border border-amber-100 mb-6">
              출금일 기준 익일~3일 이내 신청한 계좌로 입금됩니다.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowWithdrawModal(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">취소</button>
              <button type="button" onClick={handleWithdrawConfirm} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreelancerDashboard;
