import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PartTimeTask, PartTimeJobRequest } from '@/types';
import type { UserProfile } from '@/types';
import { NotificationType } from '@/types';
import { calcJobRequestFee, FREELANCER_FEE_RATE, PAYMENT_GATEWAY_FEE_RATE } from '@/constants';
import {
  fetchPartTimeTasks,
  fetchPartTimeJobRequests,
  upsertPartTimeTasks,
  upsertPartTimeJobRequest,
  fetchFreelancerWithdrawRequests,
  updateFreelancerWithdrawRequestStatusToDb,
  refundFreelancerWithdrawalInDb,
  processAutoApprovalsInDb,
  fetchFreelancerBalance,
  setFreelancerBalance,
  addFreelancerEarningToDb,
} from '../../parttimeDb';

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif', '작업링크', '작업안내'];

interface EstimateItem { content: string; unitPrice: string; quantity: string; remarks: string }

interface Props {
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
  members?: UserProfile[];
}

type PartTimeAdminTab = 'estimate' | 'freelancer' | 'revenue';

const PartTimeAdmin: React.FC<Props> = ({ addNotif, members = [] }) => {
  const navigate = useNavigate();
  const [adminTab, setAdminTab] = useState<PartTimeAdminTab>('estimate');
  const [tasks, setTasks] = useState<PartTimeTask[]>([]);
  const [jobRequests, setJobRequests] = useState<PartTimeJobRequest[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<Awaited<ReturnType<typeof fetchFreelancerWithdrawRequests>>>([]);
  const [rejectModal, setRejectModal] = useState<{ jr: PartTimeJobRequest; reason: string } | null>(null);
  const [revisionModal, setRevisionModal] = useState<{ task: PartTimeTask; userId: string; nickname: string; text: string } | null>(null);
  const [detailJr, setDetailJr] = useState<PartTimeJobRequest | null>(null);
  const [estimateModal, setEstimateModal] = useState<PartTimeJobRequest | null>(null);
  const [estimateForm, setEstimateForm] = useState<{ workName: string; recipientName: string; recipientContact: string; workPeriodStart: string; workPeriodEnd: string; items: EstimateItem[]; note: string }>({ workName: '', recipientName: '', recipientContact: '', workPeriodStart: '', workPeriodEnd: '', items: [{ content: '', unitPrice: '', quantity: '1', remarks: '' }], note: '' });
  const [parttimeDateOffset, setParttimeDateOffset] = useState(0);
  const [revenueMonthOffset, setRevenueMonthOffset] = useState(0);
  const [freelancerMonthOffset, setFreelancerMonthOffset] = useState(0);
  const [freelancerStatusFilter, setFreelancerStatusFilter] = useState<string>('all');
  const [freelancerShowAllMonths, setFreelancerShowAllMonths] = useState(true); // 기본 전체 보기 (누구나알바 작업 목록 연동)
  const [revenueSearch, setRevenueSearch] = useState('');
  const [workConfirmModal, setWorkConfirmModal] = useState<{ task: PartTimeTask; isAdvertiserView: boolean } | null>(null);
  const [estimateViewJr, setEstimateViewJr] = useState<PartTimeJobRequest | null>(null);
  const [zoomedExampleImage, setZoomedExampleImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await processAutoApprovalsInDb();
        const [taskList, jrList, withdrawList] = await Promise.all([
          fetchPartTimeTasks(),
          fetchPartTimeJobRequests(),
          fetchFreelancerWithdrawRequests(),
        ]);
        if (!cancelled) {
          setTasks(taskList);
          setJobRequests(jrList);
          setWithdrawRequests(withdrawList);
        }
      } catch (e) {
        if (!cancelled) console.error('PartTimeAdmin load:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (adminTab !== 'freelancer') return;
    fetchPartTimeTasks().then(setTasks).catch((e) => console.error('PartTime tasks refresh:', e));
  }, [adminTab]);

  const pushModalState = (key: string, onPop: () => void) => {
    window.history.pushState({ [key]: true }, '');
    const handler = () => onPop();
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      if (window.history.state?.[key]) window.history.back();
    };
  };
  useEffect(() => {
    if (!workConfirmModal) return;
    return pushModalState('adminWorkConfirm', () => setWorkConfirmModal(null));
  }, [workConfirmModal]);
  useEffect(() => {
    if (!estimateViewJr) return;
    return pushModalState('adminEstimateView', () => setEstimateViewJr(null));
  }, [estimateViewJr]);

  const refreshWithdrawRequests = () => fetchFreelancerWithdrawRequests().then(setWithdrawRequests).catch(console.error);

  const pendingReviewsBase = jobRequests.filter((jr) => jr.status === 'pending_review');

  const handleApproveJobRequest = async (jr: PartTimeJobRequest) => {
    const updated = { ...jr, status: 'pending' as const };
    try {
      await upsertPartTimeJobRequest(updated);
      setJobRequests((prev) => prev.map((r) => (r.id === jr.id ? updated : r)));
      if (jr.applicantUserId && addNotif) {
        addNotif(jr.applicantUserId, 'approval', '작업의뢰 승인', `[${jr.title}] 작업의뢰가 승인되었습니다. 프리랜서 워크페이스 → 알바의뢰 (광고주한정) 탭에서 결제를 진행해 주세요.`, '프리랜서 워크페이스 → 알바의뢰 탭에서 결제를 진행해 주세요.');
      }
      alert('승인되었습니다. 신청자에게 알림이 전송되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    }
  };

  const handleRejectJobRequest = (jr: PartTimeJobRequest) => {
    setRejectModal({ jr, reason: '' });
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    const { jr, reason } = rejectModal;
    if (!reason.trim()) {
      alert('거절 사유를 입력해 주세요.');
      return;
    }
    const updated = { ...jr, status: 'not_selected' as const, rejectReason: reason.trim() };
    try {
      await upsertPartTimeJobRequest(updated);
      setJobRequests((prev) => prev.map((r) => (r.id === jr.id ? updated : r)));
      if (jr.applicantUserId && addNotif) {
        addNotif(jr.applicantUserId, 'revision', '작업의뢰 거절', `[${jr.title}] 작업의뢰가 거절되었습니다. 사유: ${reason.trim()}`, reason.trim());
      }
      setRejectModal(null);
      setDetailJr(null);
      alert('거절 처리되었습니다. 신청자에게 알림이 전송되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    }
  };

  const handleSendEstimate = async () => {
    if (!estimateModal) return;
    if (!estimateForm.workPeriodStart || !estimateForm.workPeriodEnd) {
      alert('작업기간을 선택해 주세요.');
      return;
    }
    const validItems = estimateForm.items.filter((it) => (Number(it.unitPrice) || 0) > 0);
    if (validItems.length === 0) {
      alert('단가를 입력한 견적 항목이 1개 이상 필요합니다.');
      return;
    }
    const itemsData = validItems.map((it, i) => {
      const up = Number(it.unitPrice) || 0;
      const qty = Math.max(1, Number(it.quantity) || 1);
      return { seq: i + 1, content: it.content.trim() || '-', unitPrice: up, quantity: qty, amount: up * qty, remarks: it.remarks.trim() || undefined };
    });
    const totalAmount = itemsData.reduce((s, it) => s + it.amount, 0);
    const fee = calcJobRequestFee(totalAmount);
    const now = new Date().toISOString();
    const workPeriod = `${estimateForm.workPeriodStart} ~ ${estimateForm.workPeriodEnd}`;
    const updated = {
      ...estimateModal,
      adAmount: totalAmount,
      unitPrice: itemsData[0]?.unitPrice,
      quantity: itemsData.reduce((s, it) => s + it.quantity, 0),
      fee,
      operatorEstimate: {
        totalAmount,
        fee,
        note: estimateForm.note.trim() || undefined,
        sentAt: now,
        recipientName: estimateForm.recipientName.trim() || undefined,
        recipientContact: estimateForm.recipientContact.trim() || estimateModal.contact,
        workPeriod,
        workName: estimateForm.workName.trim() || undefined,
        items: itemsData,
      },
    };
    try {
      await upsertPartTimeJobRequest(updated);
      setJobRequests((prev) => prev.map((r) => (r.id === estimateModal.id ? updated : r)));
      if (estimateModal.applicantUserId && addNotif) {
        addNotif(estimateModal.applicantUserId, 'approval', '견적서 도착', `[${estimateModal.title}] 견적서가 도착했습니다. 마이페이지 → 알바의뢰 탭에서 확인해 주세요.`, undefined);
      }
      setEstimateModal(null);
      setEstimateForm({ workName: '', recipientName: '', recipientContact: '', workPeriodStart: '', workPeriodEnd: '', items: [{ content: '', unitPrice: '', quantity: '1', remarks: '' }], note: '' });
      setDetailJr(null);
      alert('견적서가 전송되었습니다. 광고주에게 알림이 전송되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    }
  };

  const parttimeViewDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + parttimeDateOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const pendingReviews = parttimeDateOffset === 0 ? pendingReviewsBase : pendingReviewsBase.filter((jr) => jr.workPeriodStart === parttimeViewDate);
  const tasksWithSelectedBase = tasks.filter(
    (t) => !t.pointPaid && t.applicants.some((a) => a.selected)
  );
  const tasksWithSelected = tasksWithSelectedBase.filter(
    (t) => (t.workPeriod?.start || t.applicationPeriod?.start) === parttimeViewDate
  );

  const revenueViewMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + revenueMonthOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const tasksWithSelectedForRevenue = tasksWithSelectedBase.filter((t) => {
    const taskDate = t.workPeriod?.start || t.applicationPeriod?.start || t.createdAt;
    return taskDate && taskDate.startsWith(revenueViewMonth);
  });

  const saveTasks = (next: PartTimeTask[]) => {
    setTasks(next);
    upsertPartTimeTasks(next).catch((e) => console.error('saveTasks:', e));
  };

  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) =>
    (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();

  const handleApprovePass = (task: PartTimeTask, userId: string) => {
    const a = task.applicants.find((ap) => ap.userId === userId && ap.selected && hasWorkLink(ap));
    if (!a) return;
    const now = new Date();
    const autoAt = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6일 후 자동 지급
    const next = tasks.map((t) =>
      t.id !== task.id ? t : {
        ...t,
        applicants: t.applicants.map((ap) =>
          ap.userId === userId ? { ...ap, deliveryAt: now.toISOString(), autoApproveAt: autoAt.toISOString() } : ap
        ),
      }
    );
    saveTasks(next);
    if (addNotif) {
      addNotif(userId, 'freelancer', '작업 통과', `[${task.title}] 작업이 통과되었습니다. 4~7일 이내 수익통장에 ${task.reward.toLocaleString()}원이 적립됩니다.`, '4~7일 이내 수익통장에 적립됩니다.');
    }
    alert('통과 처리되었습니다. 4~7일 이내 수익통장에 지급됩니다.');
  };

  const handlePayPoints = async (task: PartTimeTask, userId?: string) => {
    const freshTask = tasks.find((x) => x.id === task.id);
    const currentPaid = freshTask?.paidUserIds ?? task.paidUserIds ?? [];
    const base = userId
      ? task.applicants.filter((a) => a.userId === userId && a.selected && hasWorkLink(a))
      : task.applicants.filter((a) => a.selected && hasWorkLink(a));
    const target = base.filter((a) => !currentPaid.includes(a.userId));
    if (target.length === 0) {
      if (base.length > 0 && base.every((a) => task.paidUserIds?.includes(a.userId))) {
        alert('이미 수익통장에 지급 완료된 상태입니다. 이중 지급되지 않습니다.');
      } else {
        alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다.');
      }
      return;
    }
    if (!confirm(`작업을 확인하셨나요? ${target.length}명에게 각 ${task.reward.toLocaleString()}원을 지급합니다.`)) return;
    try {
      const netAmount = Math.round(task.reward * (1 - FREELANCER_FEE_RATE));
      for (const a of target) {
        const cur = await fetchFreelancerBalance(a.userId);
        await setFreelancerBalance(a.userId, cur + netAmount);
        await addFreelancerEarningToDb(a.userId, `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'task', task.reward, task.title);
      }
      if (addNotif) {
        target.forEach((a) =>
          addNotif(a.userId, 'freelancer', '알바비 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`, `작업이 확인되어 수익통장에 ${task.reward.toLocaleString()}원이 적립되었습니다.`)
        );
      }
      const paidIds = target.map((a) => a.userId);
      const allPaid = [...(freshTask?.paidUserIds ?? []), ...paidIds];
      const selectedWithLink = (freshTask ?? task).applicants.filter((a) => a.selected && hasWorkLink(a));
      const pointPaid = selectedWithLink.every((a) => allPaid.includes(a.userId));
      const next = tasks.map((t) => (t.id !== task.id ? t : { ...t, pointPaid, paidUserIds: allPaid }));
      setTasks(next);
      await upsertPartTimeTasks(next);
      alert('알바비가 지급되었습니다.');
    } catch (err) {
      console.error(err);
      alert('지급 처리 중 오류가 발생했습니다.');
    }
  };

  const handleSelect = (task: PartTimeTask, userId: string) => {
    const applicant = task.applicants.find((a) => a.userId === userId);
    const now = new Date().toISOString();
    let updatedTask: PartTimeTask = { ...task, applicants: task.applicants.map((a) => (a.userId === userId ? { ...a, selected: true, selectedAt: now } : a)) };
    if (task.applicantUserId && !task.jobRequestId) {
      const jobReqs = jobRequests.filter((jr) => jr.applicantUserId === task.applicantUserId && (jr.paid || jr.status === 'pending'));
      const linkedIds = new Set(tasks.filter((t) => t.jobRequestId).map((t) => t.jobRequestId!));
      const unlinked = jobReqs.find((jr) => !linkedIds.has(jr.id));
      if (unlinked) updatedTask = { ...updatedTask, jobRequestId: unlinked.id };
    }
    const next = tasks.map((t) => (t.id !== task.id ? t : updatedTask));
    saveTasks(next);
    if (applicant && addNotif) {
      addNotif(userId, 'freelancer', '프리랜서 선정', `[${task.title}]에 선정되었습니다. 작업 완료 후 작업 링크를 제출해 주세요.`, '작업 완료 후 작업 링크를 제출해 주세요.');
    }
  };

  const handleDeselect = (task: PartTimeTask, userId: string) => {
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, applicants: t.applicants.map((a) => (a.userId === userId ? { ...a, selected: false } : a)) }
    );
    saveTasks(next);
    if (addNotif) {
      addNotif(userId, 'freelancer', '선정 취소', `[${task.title}] 작업에서 선정이 취소되었습니다.`, '선정이 취소되었습니다.');
    }
  };

  const handleRevisionRequest = (task: PartTimeTask, userId: string, text: string) => {
    if (!text.trim()) return;
    const next = tasks.map((t) =>
      t.id !== task.id ? t : {
        ...t,
        applicants: t.applicants.map((a) =>
          a.userId === userId ? { ...a, revisionRequest: text.trim() } : a
        ),
      }
    );
    saveTasks(next);
    if (addNotif) {
      addNotif(userId, 'revision', '작업 수정요청', `[${task.title}] 운영자가 수정을 요청했습니다. ${text.trim()}`, text.trim());
    }
    setRevisionModal(null);
    alert('수정요청 알림이 전송되었습니다.');
  };

  /** 광고주 전송: 운영자 만족 시 → 광고주 확인 알림, 광고주가 링크확인·수정·구매확정 가능 */
  const handleSendToAdvertiser = (task: PartTimeTask) => {
    const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
    if (selectedWithLink.length === 0) return;
    const now = new Date().toISOString();
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, sentToAdvertiserAt: now }
    );
    saveTasks(next);
    if (task.applicantUserId && addNotif) {
      addNotif(task.applicantUserId, 'approval', '작업 완료·결과물 확인', `[${task.title}] 프리랜서 작업이 완료되었습니다. 마이페이지 → 알바의뢰 탭에서 링크 확인 후 구매확정해 주세요.`);
    }
    alert('광고주에게 결과물 전송 알림을 보냈습니다.');
  };

  const pendingWithdrawals = withdrawRequests.filter((r) => r.status === 'pending');

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const today = todayStr();
  const needsSelectionTasks = tasks.filter(
    (t) => t.applicationPeriod?.end <= today && t.applicants.length > 0 && !t.applicants.some((a) => a.selected)
  );
  const freelancerViewMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + freelancerMonthOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  // 전체 작업 표시 (신규 등록 작업 포함) - 운영자가 한눈에 관리할 수 있도록
  const freelancerAllTasks = tasks;
  const getTaskStatus = (t: PartTimeTask) => {
    const selectedOne = t.applicants.find((a) => a.selected);
    const needsSelection = !selectedOne;
    const hasWorkLinkSel = selectedOne && hasWorkLink(selectedOne);
    const isPaid = selectedOne && t.paidUserIds?.includes(selectedOne.userId);
    const sentToAdvertiser = !!t.sentToAdvertiserAt;
    if (needsSelection) return '프리모집';
    if (!hasWorkLinkSel) return '프리선정';
    if (isPaid) return '지급완료'; // 지급된 경우 상태 뱃지도 지급완료로 (비상 알바비 컬럼과 일치)
    if (!sentToAdvertiser) return '작업진행';
    return '작업완료'; // 링크 전송됐으나 아직 미지급
  };
  const freelancerFilteredTasks = freelancerAllTasks.filter((t) => {
    if (!freelancerShowAllMonths) {
      const taskDate = t.workPeriod?.start || t.applicationPeriod?.start || t.applicationPeriod?.end || t.createdAt;
      if (taskDate && typeof taskDate === 'string' && taskDate.length >= 7) {
        const taskMonth = taskDate.slice(0, 7);
        if (taskMonth !== freelancerViewMonth) return false;
      }
    }
    if (freelancerStatusFilter !== 'all' && getTaskStatus(t) !== freelancerStatusFilter) return false;
    return true;
  });

  const estimateHistory = jobRequests
    .filter((jr) => jr.operatorEstimate?.sentAt)
    .sort((a, b) => (b.operatorEstimate!.sentAt! > a.operatorEstimate!.sentAt! ? 1 : -1));
  const estimateHistoryByDate = estimateHistory.reduce<Record<string, PartTimeJobRequest[]>>((acc, jr) => {
    const dateKey = jr.operatorEstimate!.sentAt!.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(jr);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {/* 누구나알바 서브 탭 */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-2xl">
        <button type="button" onClick={() => setAdminTab('estimate')} className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${adminTab === 'estimate' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
          견적진행
        </button>
        <button type="button" onClick={() => setAdminTab('freelancer')} className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${adminTab === 'freelancer' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
          프리랜서모집
          {needsSelectionTasks.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{needsSelectionTasks.length}</span>
          )}
        </button>
        <button type="button" onClick={() => setAdminTab('revenue')} className={`px-6 py-3 rounded-xl font-black text-sm transition-all ${adminTab === 'revenue' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
          수익탭
          {pendingWithdrawals.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{pendingWithdrawals.length}</span>
          )}
        </button>
      </div>

      {adminTab === 'estimate' && (
        <div className="space-y-10">
      {/* 견적진행: 검토 대기 */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900 mb-1">견적서 요청 · 검토 대기</h3>
            <p className="text-sm text-gray-500">광고주가 보낸 견적서 요청을 확인하고, 견적서 전송 또는 승인/거절해 주세요.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setParttimeDateOffset((o) => o - 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">←</button>
            <span className="text-sm font-black text-gray-600 min-w-[100px] text-center">{parttimeViewDate}</span>
            <button type="button" onClick={() => setParttimeDateOffset((o) => o + 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">→</button>
          </div>
        </div>
        {pendingReviews.length === 0 ? (
          <div className="py-12 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
            검토 대기 중인 작업의뢰가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">제목</th>
                  <th className="px-6 py-4">작업기간</th>
                  <th className="px-6 py-4">연락처</th>
                  <th className="px-6 py-4 text-center">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingReviews.map((jr) => (
                  <tr key={jr.id} className="hover:bg-emerald-50/20">
                    <td className="px-6 py-4 font-bold text-gray-900">{jr.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{jr.workPeriodStart} ~ {jr.workPeriodEnd}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{jr.contact}</td>
                    <td className="px-6 py-4 text-center">
                      <button type="button" onClick={() => setDetailJr(jr)} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700">견적확인하기</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 결제 완료된 작업 목록 (별도 보관) */}
        {(() => {
          const paidList = jobRequests.filter((jr) => jr.paid);
          if (paidList.length === 0) return null;
          return (
            <div className="mt-10 pt-10 border-t border-gray-100">
              <h4 className="text-lg font-black text-gray-900 mb-3">결제 확인된 작업</h4>
              <p className="text-sm text-gray-500 mb-4">결제가 완료된 작업의뢰 목록입니다. 프리랜서 모집 탭에서 작업을 등록·연결할 수 있습니다.</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-indigo-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-black">제목</th>
                      <th className="px-4 py-3 text-left font-black">광고주</th>
                      <th className="px-4 py-3 text-right font-black">금액</th>
                      <th className="px-4 py-3 text-center font-black">상세확인</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paidList.map((jr) => {
                      const m = members.find((mm) => mm.id === jr.applicantUserId);
                      const hasEstimate = !!jr.operatorEstimate;
                      return (
                        <tr key={jr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-gray-900">{jr.title}</td>
                          <td className="px-4 py-3 text-gray-600">{m?.nickname ?? '-'}</td>
                          <td className="px-4 py-3 text-right font-black text-indigo-600">{jr.adAmount?.toLocaleString() ?? '-'}원</td>
                          <td className="px-4 py-3 text-center">
                            {hasEstimate ? (
                              <button type="button" onClick={() => setEstimateViewJr(jr)} className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs hover:bg-indigo-200">
                                견적서 확인
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 견적서 발송 내역 */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 mb-1">견적서 발송 내역</h3>
        <p className="text-sm text-gray-500 mb-6">날짜별로 발송한 견적서 목록입니다. C/S 응대 시 참고해 주세요.</p>
        {estimateHistory.length === 0 ? (
          <div className="py-8 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">발송된 견적서가 없습니다.</div>
        ) : (
          <div className="space-y-6 max-h-[400px] overflow-y-auto">
            {Object.entries(estimateHistoryByDate).map(([dateStr, list]: [string, PartTimeJobRequest[]]) => (
              <div key={dateStr} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 font-black text-sm">{dateStr}</div>
                <ul className="divide-y divide-gray-50">
                  {list.map((jr) => {
                    const m = members.find((mm) => mm.id === jr.applicantUserId);
                    const est = jr.operatorEstimate!;
                    return (
                      <li key={jr.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50">
                        <div>
                          <span className="font-bold text-gray-900">{jr.title}</span>
                          <span className="text-gray-500 text-sm ml-2">→ {m?.nickname ?? '광고주'}</span>
                        </div>
                        <div className="text-sm text-gray-600">{est.totalAmount.toLocaleString()}원 / {est.workPeriod ?? '-'}</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      )}

      {adminTab === 'revenue' && (
      <div className="space-y-10">
      {/* 수익탭: 프리랜서 출금 신청 목록 */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 mb-1">프리랜서 출금 신청 (PortOne 입금 대상)</h3>
        <p className="text-sm text-gray-500 mb-6">수익통장에서 출금을 신청한 프리랜서 목록입니다. 신청일 기준 익일에 출금됩니다. 전문가정보에 등록된 통장으로 PortOne을 통해 입금 처리해 주세요.</p>
        {pendingWithdrawals.length === 0 ? (
          <div className="py-8 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
            대기 중인 출금 신청이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-black text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">신청일시</th>
                  <th className="px-6 py-4">출금 예정일 (익일)</th>
                  <th className="px-6 py-4">프리랜서</th>
                  <th className="px-6 py-4 text-right">금액 (원)</th>
                  <th className="px-6 py-4">입금 계좌</th>
                  <th className="px-6 py-4 text-center">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingWithdrawals.map((r) => {
                  const reqDate = new Date(r.requestedAt);
                  const nextDay = new Date(reqDate);
                  nextDay.setDate(reqDate.getDate() + 1);
                  return (
                  <tr key={r.id} className="hover:bg-emerald-50/20">
                    <td className="px-6 py-4 font-bold text-sm text-gray-700">
                      {new Date(r.requestedAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-sm text-emerald-600">
                      {nextDay.toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900">{r.nickname}</td>
                    <td className="px-6 py-4 text-right font-black text-emerald-600">{r.amount.toLocaleString()}원</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-bold text-gray-800">{r.bankName}</span> {r.accountNo}
                      <br />
                      <span className="text-gray-500 text-xs">예금주: {r.ownerName}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateFreelancerWithdrawRequestStatusToDb(r.id, 'completed');
                              await refreshWithdrawRequests();
                              if (addNotif) addNotif(r.userId, 'freelancer', '출금 완료', `${r.amount.toLocaleString()}원이 ${r.bankName} ${r.accountNo} 계좌로 입금되었습니다.`);
                              alert('입금 완료로 표시했습니다.');
                            } catch (e) {
                              console.error(e);
                              alert('처리에 실패했습니다.');
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700"
                        >
                          입금 완료
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('입금 실패로 표시하시겠습니까? 수익통장에 해당 금액이 다시 충전됩니다.')) return;
                            try {
                              await refundFreelancerWithdrawalInDb(r.userId, r.amount, '출금 실패 환급');
                              await updateFreelancerWithdrawRequestStatusToDb(r.id, 'failed');
                              await refreshWithdrawRequests();
                              if (addNotif) addNotif(r.userId, 'freelancer', '출금 실패', `출금 신청이 실패하여 ${r.amount.toLocaleString()}원이 수익통장에 환급되었습니다. 통장 정보를 확인 후 다시 출금 신청해 주세요.`);
                              alert('실패로 표시했습니다. 수익통장에 금액이 환급되었습니다.');
                            } catch (e) {
                              console.error(e);
                              alert('처리에 실패했습니다.');
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-red-100 text-red-700 font-black text-xs hover:bg-red-200"
                        >
                          실패
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
      )}

      {adminTab === 'freelancer' && (
      <div className="space-y-10">
        {(freelancerAllTasks.length > 0) ? (
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-1">프리랜서 모집 · 작업 목록</h3>
                <p className="text-sm text-gray-500">월별·상태별 필터. 내용확인으로 상세 페이지에서 수정 또는 프리랜서 선정할 수 있습니다.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setFreelancerShowAllMonths(!freelancerShowAllMonths)} className={`px-4 py-2 rounded-xl text-sm font-black ${freelancerShowAllMonths ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {freelancerShowAllMonths ? '전체 보기' : '월별 보기'}
                </button>
                {!freelancerShowAllMonths && (
                  <>
                    <button type="button" onClick={() => setFreelancerMonthOffset((o) => o - 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">←</button>
                    <span className="text-sm font-black text-gray-600 min-w-[100px] text-center">{freelancerViewMonth}</span>
                    <button type="button" onClick={() => setFreelancerMonthOffset((o) => o + 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">→</button>
                  </>
                )}
                <select value={freelancerStatusFilter} onChange={(e) => setFreelancerStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold bg-white">
                  <option value="all">전체 상태</option>
                  <option value="프리모집">프리모집</option>
                  <option value="프리선정">프리선정</option>
                  <option value="작업진행">링크확인</option>
                  <option value="작업완료">작업완료</option>
                  <option value="구매확정">구매확정</option>
                  <option value="지급완료">지급완료</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-black text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">제목 / 안내문구</th>
                    <th className="px-4 py-3 text-center">내용확인</th>
                    <th className="px-4 py-3 text-center">채팅하기</th>
                    <th className="px-4 py-3 text-center">수정요청</th>
                    <th className="px-4 py-3 text-center">비상 알바비</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {freelancerFilteredTasks.map((t) => {
                    const selectedOne = t.applicants.find((a) => a.selected);
                    const needsSelection = !selectedOne;
                    const hasWorkLinkSelected = selectedOne && hasWorkLink(selectedOne);
                    const isPaid = selectedOne && t.paidUserIds?.includes(selectedOne.userId);
                    const hasReApproval = selectedOne?.reApprovalRequestedAt;
                    const sentToAdvertiser = !!t.sentToAdvertiserAt;
                    const status = getTaskStatus(t);
                    const statusLabels: Record<string, { label: string; msg: string }> = {
                      프리모집: { label: '프리모집', msg: `${t.applicants.length}명 신청. 프리랜서 선정이 필요합니다.` },
                      프리선정: { label: '프리선정', msg: `${selectedOne?.nickname ?? '-'} 선정됨. 작업 링크 제출 대기 중입니다.` },
                      작업진행: { label: '링크확인', msg: hasReApproval ? '링크를 재제출했습니다. 재승인요청을 했습니다. 확인바랍니다.' : '링크를 제출했습니다. 확인바랍니다.' },
                      작업완료: { label: '작업완료', msg: '광고주 전송 완료. 구매확정 대기 중입니다.' },
                      구매확정: { label: '구매확정', msg: '광고주 구매확정 완료. 알바비 지급 대기 중입니다.' },
                      지급완료: { label: '지급완료', msg: '알바비 지급 완료되었습니다.' },
                    };
                    const { label: statusLabel, msg } = statusLabels[status] || { label: status, msg: '' };
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-black ${status === '프리모집' ? 'bg-amber-200 text-amber-800' : status === '프리선정' ? 'bg-blue-100 text-blue-700' : status === '작업진행' ? 'bg-blue-100 text-blue-700' : status === '작업완료' ? 'bg-indigo-100 text-indigo-700' : status === '지급완료' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{t.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{msg}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link to={`/part-time/${t.id}`} state={{ fromAdmin: true }} className="inline-block px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs hover:bg-emerald-200">
                            내용확인
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(needsSelection ? t.applicants[0] : selectedOne) && !needsSelection ? (
                            <button type="button" onClick={() => navigate('/chat', { state: { targetUser: { id: selectedOne!.userId, nickname: selectedOne!.nickname, profileImage: '' } } })} className="inline-block px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs hover:bg-blue-200">
                              채팅하기
                            </button>
                          ) : needsSelection && t.applicants[0] ? (
                            <button type="button" onClick={() => navigate('/chat', { state: { targetUser: { id: t.applicants[0].userId, nickname: t.applicants[0].nickname, profileImage: '' } } })} className="inline-block px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs hover:bg-blue-200">
                              채팅하기
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedOne && hasWorkLinkSelected && !isPaid ? (
                            <button type="button" onClick={() => setRevisionModal({ task: t, userId: selectedOne.userId, nickname: selectedOne.nickname, text: selectedOne.revisionRequest || '' })} className="inline-block px-3 py-1.5 rounded-lg bg-orange-100 text-orange-700 font-bold text-xs hover:bg-orange-200">
                              수정요청
                            </button>
                          ) : (status === '작업진행' || status === '작업완료') && hasWorkLinkSelected ? (
                            <Link to={`/part-time/${t.id}`} state={{ focusWorkLink: true, fromAdmin: true }} className="inline-block px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs hover:bg-amber-200">
                              수정하기
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {selectedOne && hasWorkLinkSelected && !isPaid ? (
                            <button type="button" onClick={() => handlePayPoints(t, selectedOne.userId)} className="inline-block px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs hover:bg-amber-200">
                              비상 지급
                            </button>
                          ) : isPaid ? (
                            <span className="text-gray-500 font-bold text-xs">지급완료</span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {freelancerFilteredTasks.length === 0 && (
              <p className="py-8 text-center text-gray-500 font-bold">해당 조건에 맞는 작업이 없습니다.</p>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
            프리랜서 선정이 필요한 작업이 없습니다. 누구나알바 페이지에서 작업을 등록하고, 신청 기간이 끝나면 여기서 선정해 주세요.
          </div>
        )}
      </div>
      )}

      {adminTab === 'revenue' && (
      <div className="space-y-10">
      {/* 수익탭: 거래 목록 (ALBA-상품번호, 광고주/프리랜서, 작업확정서/상세확인) */}
      {(() => {
        const tradeTasksBase = tasks.filter((t) => t.jobRequestId && t.applicantUserId && t.applicants.some((a) => a.selected));
        const tradeTasks = tradeTasksBase.filter((t) => {
          const taskDate = t.workPeriod?.start || t.applicationPeriod?.start || t.createdAt;
          const inMonth = !taskDate || (typeof taskDate === 'string' && taskDate.length >= 7 && taskDate.startsWith(revenueViewMonth));
          if (!inMonth) return false;
          const jr = jobRequests.find((j) => j.id === t.jobRequestId);
          const adv = members.find((m) => m.id === t.applicantUserId);
          const selectedOne = t.applicants.find((a) => a.selected);
          const searchLower = revenueSearch.trim().toLowerCase();
          if (!searchLower) return true;
          const title = (jr?.title ?? t.title ?? '').toLowerCase();
          const advName = (adv?.nickname ?? '').toLowerCase();
          const freeName = (selectedOne?.nickname ?? '').toLowerCase();
          const projectNo = (t.projectNo ?? t.id ?? '').toLowerCase();
          return title.includes(searchLower) || advName.includes(searchLower) || freeName.includes(searchLower) || projectNo.includes(searchLower);
        });
        if (tradeTasksBase.length === 0) return null;
        return (
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-1">거래 목록</h3>
                <p className="text-sm text-gray-500">월별 확인 · 검색. 상품번호(ALBA), 광고주·프리랜서, 작업확정서·상세 페이지 확인</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setRevenueMonthOffset((o) => o - 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">←</button>
                <span className="text-sm font-black text-gray-600 min-w-[100px] text-center">{revenueViewMonth}</span>
                <button type="button" onClick={() => setRevenueMonthOffset((o) => o + 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">→</button>
                <input type="text" value={revenueSearch} onChange={(e) => setRevenueSearch(e.target.value)} placeholder="제목·광고주·프리랜서 검색" className="px-4 py-2 rounded-xl border border-gray-200 text-sm w-48" />
              </div>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-black text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">상품번호</th>
                    <th className="px-4 py-3 text-left">견적제목</th>
                    <th className="px-4 py-3 text-left">광고주</th>
                    <th className="px-4 py-3 text-left">프리랜서</th>
                    <th className="px-4 py-3 text-center">광고주 작업확정서</th>
                    <th className="px-4 py-3 text-center">프리랜서 작업확정서</th>
                    <th className="px-4 py-3 text-center">상세확인</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tradeTasks.map((t) => {
                    const jr = jobRequests.find((jr) => jr.id === t.jobRequestId);
                    const selectedOne = t.applicants.find((a) => a.selected);
                    const adv = members.find((m) => m.id === t.applicantUserId);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-black text-gray-900">{t.projectNo ?? t.id}</td>
                        <td className="px-4 py-3 font-bold">{jr?.title ?? t.title}</td>
                        <td className="px-4 py-3">{adv?.nickname ?? '-'}</td>
                        <td className="px-4 py-3">{selectedOne?.nickname ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => setWorkConfirmModal({ task: t, isAdvertiserView: true })} className="inline-block px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs hover:bg-blue-200">
                            광고주
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => setWorkConfirmModal({ task: t, isAdvertiserView: false })} className="inline-block px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs hover:bg-indigo-200">
                            프리랜서
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link to={`/part-time/${t.id}`} state={{ fromAdmin: true }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200">
                            상세확인
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      </div>
      )}

      {/* 견적서 상세 확인 모달 (결제확인된 작업에서) */}
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
          if (!printWindow) return;
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
.total{font-size:16px;font-weight:bold;color:#059669}
</style></head><body>
<h2>THEBEST<span style="color:#2563eb">SNS</span> 견적서</h2>
<p class="meta">견적일자: ${new Date(est.sentAt!).toLocaleDateString('ko-KR')}${est.workName ? ' · ' + est.workName : ''}</p>
<div class="grid"><div class="section"><div class="label">공급처</div><p><strong>상호</strong> THEBESTSNS<br><strong>대표자</strong> 김나영<br><strong>주소</strong> 대구광역시 달성군 현풍로6길 5<br><strong>사업자번호</strong> 409-30-51469</p></div>
<div class="section"><div class="label">수신처</div><p><strong>${est.recipientName || '광고주'}</strong><br>${est.recipientContact || estimateViewJr.contact}</p></div></div>
${est.workPeriod ? `<p class="label">작업기간 : ${est.workPeriod}</p>` : ''}
<table><thead><tr><th class="tc">순번</th><th>내용</th><th class="tr">단가</th><th class="tc">수량</th><th class="tr">금액</th><th>비고</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px">
<div style="display:flex;justify-content:space-between"><span>소계 (광고금액)</span><span><strong>${subTotal.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:8px"><span>플랫폼 수수료</span><span><strong>${platformFee.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:8px"><span>결제망 수수료 (3.3%)</span><span><strong>${pgFee.toLocaleString()}원</strong></span></div>
<div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:2px solid #d1d5db"><span class="total">총 결제금액</span><span class="total">${totalPay.toLocaleString()}원</span></div>
</div>
${est.note ? `<p style="margin-top:12px;font-size:12px;color:#6b7280">추가 안내: ${est.note}</p>` : ''}
</body></html>`);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
        };
        return (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
                <h4 className="font-black text-gray-900">견적서</h4>
                <button type="button" onClick={() => setEstimateViewJr(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">✕</button>
              </div>
              <div className="p-8 space-y-6">
                <div className="text-center border-b border-gray-200 pb-4">
                  <p className="text-2xl font-black text-gray-900">THEBEST<span className="text-blue-600">SNS</span> 견적서</p>
                  <p className="text-xs text-gray-500 mt-1">견적일자: {new Date(est.sentAt!).toLocaleDateString('ko-KR')}{est.workName && ` · ${est.workName}`}</p>
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
                    <div className="flex justify-between"><span className="text-gray-600">플랫폼 수수료 (광고금액 25% + 부가세 10%)</span><span className="font-bold">{platformFee.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">결제망 수수료 (3.3%)</span><span className="font-bold">{pgFee.toLocaleString()}원</span></div>
                    <div className="flex justify-between pt-3 mt-3 border-t-2 border-gray-200"><span className="font-black text-gray-900">총 결제금액</span><span className="font-black text-emerald-600 text-lg">{totalPay.toLocaleString()}원</span></div>
                  </div>
                  {est.note && <p className="mt-3 text-gray-600 text-sm">추가 안내: {est.note}</p>}
                </div>
                <div className="pt-4 border-t border-gray-200 text-center"><p className="text-xl font-black text-gray-800">THEBEST<span className="text-blue-600">SNS</span></p></div>
                <div className="flex gap-3 justify-center pt-2">
                  <button onClick={() => setEstimateViewJr(null)} className="px-8 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">닫기</button>
                  <button onClick={handlePdfDownload} className="px-8 py-3 rounded-xl bg-slate-600 text-white font-black hover:bg-slate-700">내려받기</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 작업확정서 모달 (거래 목록에서 광고주/프리랜서용) */}
      {workConfirmModal && (() => {
        const { task, isAdvertiserView } = workConfirmModal;
        const selectedWithLink = task.applicants.filter((a) => a.selected && ((a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim()));
        const workLinksList = selectedWithLink.flatMap((a) => a.workLinks ?? (a.workLink ? [a.workLink] : [])).filter(Boolean);
        const deductedReward = Math.round(task.reward * (1 - FREELANCER_FEE_RATE));
        const handlePdfDownload = () => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) return;
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
            <div class="value">지급대금 (정산 수수료 5% + 원천징수 3.3% 차감): ₩${deductedReward.toLocaleString()}</div></div>
            ${workLinksList.length > 0 ? `<div class="section"><div class="label">3. 작업 링크</div><ul>${workLinksList.map((u) => `<li><a href="${u}">${u}</a></li>`).join('')}</ul></div>` : ''}
            <div class="section"><div class="label">4. 취소 및 환불 규정</div>
            <div class="value">작업 시작 전: 언제든 전액 취소·환불 가능합니다. 작업 시작 후: 프리랜서 선정이 끝난 경우 작업내용 전달이 되어 환불이 어렵습니다.</div></div>
            <div class="section"><div class="label">5. 검수 및 A/S 규정</div>
            <div class="value">A/S 진행: 결과물 전달일로부터 3일 이내. 해당 기간 내 광고주 이의없으면 자동 승인 및 수익통장 적립.</div></div>
            <div class="section"><div class="label">6. 위약벌 및 법적 조치</div>
            <div class="value">직거래 시도 시 거래액 10배 위약벌 청구 및 영구 제명. 작업결과물 삭제불가. 게시글/대화 기록 임의 삭제 불가.</div></div>
            <div class="section"><div class="label">7. 정산 시점 및 파트너 준수 사항</div>
            <div class="value">정산 시점: 작업완료일로부터 4~7일 수익통장에 적립. (광고주 작업완료는 프리랜서 작업완료일로부터 최대 3일임을 감안한 일정) 본 건은 플랫폼으로부터 재위탁받은 업무이며, 광고주와 직접 계약 관계가 없음을 인지합니다.</div></div>
            </body></html>`);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        };
        const sectionNum = (n: number) => (workLinksList.length > 0 ? n : (n > 3 ? n - 1 : n));
        return (
          <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setWorkConfirmModal(null)}>
            <div id="work-confirm-print" className="bg-white w-full max-w-2xl rounded-[24px] p-10 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto border-2 border-gray-200" onClick={(e) => e.stopPropagation()}>
              <div className="text-center border-b-2 border-gray-900 pb-4">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">프로젝트 작업확정서</h3>
                <p className="text-sm font-black text-gray-600 mt-1">{isAdvertiserView ? '(광고주용)' : '(프리랜서용)'}</p>
                <p className="text-xs text-gray-500 mt-2">본 문서는 이용약관에 의거하여 결제 시점부터 법적 효력이 발생합니다.</p>
              </div>
              <div className="space-y-5 text-sm font-medium">
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{sectionNum(1)}. 프로젝트 번호 및 계약당사자</p>
                  <p className="text-gray-800">프로젝트번호: {task.projectNo || '-'}</p>
                  <p className="text-gray-800 mt-1">프로젝트명: {task.title}</p>
                  <p className="text-gray-700 mt-1">재위탁 수행자(프리랜서): {task.applicants.filter((a) => a.selected).map((a) => a.nickname).join(', ') || '-'}</p>
                </div>
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{sectionNum(2)}. 업무 범위 및 단가</p>
                  <p className="text-gray-800">과업 내용: {task.description}</p>
                  <p className="text-gray-700 mt-1">최종 납기: {task.workPeriod?.end ?? '-'}</p>
                  <p className="text-gray-900 font-black mt-2">총 계약 금액: ₩{task.reward.toLocaleString()} (VAT 포함)</p>
                  <p className="text-gray-600 mt-1">지급대금 (정산 수수료 5% + 원천징수 3.3% 차감): ₩{deductedReward.toLocaleString()}</p>
                </div>
                {workLinksList.length > 0 && (
                  <div className="border-b border-gray-200 pb-4">
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">{sectionNum(3)}. 작업 링크</p>
                    <ul className="list-decimal pl-4 space-y-1">
                      {workLinksList.map((url, i) => (
                        <li key={i}><a href={url} className="text-blue-600 break-all underline" rel="noopener noreferrer" target="_blank">{url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{workLinksList.length > 0 ? '4' : '3'}. 취소 및 환불 규정</p>
                  <p className="text-gray-700 leading-relaxed text-sm">작업 시작 전: 언제든 전액 취소·환불 가능합니다. 작업 시작 후: 프리랜서 선정이 끝난 경우 작업내용 전달이 되어 환불이 어렵습니다.</p>
                </div>
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{workLinksList.length > 0 ? '5' : '4'}. 검수 및 A/S 규정</p>
                  <p className="text-gray-700 leading-relaxed">A/S 진행: 결과물 전달일로부터 3일 이내.<br />해당 기간 내 광고주 이의없으면 자동 승인 및 수익통장 적립.</p>
                </div>
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{workLinksList.length > 0 ? '6' : '5'}. 위약벌 및 법적 조치</p>
                  <p className="text-gray-700 leading-relaxed">직거래 시도 시 거래액 10배 위약벌 청구 및 영구 제명.<br />작업결과물 삭제불가. 게시글/대화 기록 임의 삭제 불가.</p>
                </div>
                <div className="border-b border-gray-200 pb-4">
                  <p className="text-xs font-black text-gray-500 uppercase mb-2">{workLinksList.length > 0 ? '7' : '6'}. 정산 시점 및 파트너 준수 사항</p>
                  <p className="text-gray-700 leading-relaxed">정산 시점: 작업완료일로부터 4~7일 수익통장에 적립.<br />(광고주 작업완료는 프리랜서 작업완료일로부터 최대 3일임을 감안한 일정)<br /><br />본 건은 플랫폼으로부터 재위탁받은 업무이며, 광고주와 직접 계약 관계가 없음을 인지합니다.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handlePdfDownload} className="flex-1 py-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">PDF 저장</button>
                <button onClick={() => setWorkConfirmModal(null)} className="flex-1 py-4 rounded-xl bg-gray-800 text-white font-black hover:bg-gray-900">닫기</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 모달: 견적 확인 상세, 견적서 전송, 거절, 수정요청 (estimate/freelancer 탭 공용) */}
        {detailJr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-gray-900">광고주 작업의뢰 상세</h4>
                <button type="button" onClick={() => { setDetailJr(null); setEstimateModal(null); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">✕</button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase mb-1">알바광고 신청제목</p>
                  <p className="text-lg font-black text-gray-900">{detailJr.title}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase mb-1">작업내용</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{detailJr.workContent}</p>
                </div>
                {(detailJr.exampleImages?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">원하는 예시 첨부 (클릭하면 크게 보기)</p>
                    <div className="flex flex-wrap gap-2">
                      {detailJr.exampleImages!.map((src, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setZoomedExampleImage(src)}
                          className="w-24 h-24 rounded-xl border-2 border-gray-200 overflow-hidden hover:border-emerald-400 focus:ring-2 focus:ring-emerald-300 focus:outline-none transition-all"
                        >
                          <img src={src} alt={`예시 ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase mb-1">플랫폼링크</p>
                  {(() => {
                    const links = detailJr.platformLinks?.length ? detailJr.platformLinks : (detailJr.platformLink ? detailJr.platformLink.split(',').map((s) => s.trim()).filter(Boolean) : []);
                    if (!links.length) return <p className="text-gray-400">-</p>;
                    return (
                      <div className="space-y-2">
                        {links.map((url, i) => (
                          <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="block text-emerald-600 font-bold hover:underline break-all text-sm">
                            {i + 1}. {url}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase mb-1">연락처</p>
                  <p className="font-bold text-gray-800">{detailJr.contact}</p>
                </div>
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase mb-1">작업기간</p>
                  <p className="font-bold text-gray-800">{detailJr.workPeriodStart} ~ {detailJr.workPeriodEnd}</p>
                </div>
              </div>
              <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3">
                <button type="button" onClick={() => { const m = members.find((mm) => mm.id === detailJr.applicantUserId); setEstimateModal(detailJr); const prevItems = detailJr.operatorEstimate?.items; const prevWorkPeriod = detailJr.operatorEstimate?.workPeriod?.split(' ~ '); setEstimateForm({ workName: detailJr.operatorEstimate?.workName ?? detailJr.title, recipientName: detailJr.operatorEstimate?.recipientName ?? m?.nickname ?? '', recipientContact: detailJr.operatorEstimate?.recipientContact ?? detailJr.contact, workPeriodStart: prevWorkPeriod?.[0] ?? detailJr.workPeriodStart, workPeriodEnd: prevWorkPeriod?.[1] ?? detailJr.workPeriodEnd, items: prevItems?.length ? prevItems.map((it: { content: string; unitPrice: number; quantity: number; remarks?: string }) => ({ content: it.content, unitPrice: String(it.unitPrice), quantity: String(it.quantity), remarks: it.remarks ?? '' })) : [{ content: detailJr.workContent, unitPrice: String(detailJr.operatorEstimate?.unitPrice ?? ''), quantity: String(detailJr.operatorEstimate?.quantity ?? 1), remarks: '' }], note: detailJr.operatorEstimate?.note ?? '' }); }} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">견적서넣기</button>
                <button type="button" onClick={() => { handleApproveJobRequest(detailJr); setDetailJr(null); }} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700">승인</button>
                <button type="button" onClick={() => { setDetailJr(null); handleRejectJobRequest(detailJr); }} className="px-6 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200">거절</button>
              </div>
            </div>
          </div>
        )}

        {/* 예시 이미지 크게 보기 (광고주 작업의뢰 상세에서 클릭 시) — 팝업 창 크기로 확대 */}
        {zoomedExampleImage && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
            onClick={() => setZoomedExampleImage(null)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && setZoomedExampleImage(null)}
            aria-label="닫기"
          >
            <button type="button" onClick={() => setZoomedExampleImage(null)} className="absolute top-4 right-4 z-10 w-14 h-14 rounded-full bg-white/95 text-gray-800 text-3xl font-black hover:bg-white shadow-xl leading-none">×</button>
            <div className="w-[95vw] h-[90vh] flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
              <img
                src={zoomedExampleImage}
                alt="예시 크게 보기"
                className="max-w-full max-h-full w-full h-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          </div>
        )}

        {estimateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-4">
                <h4 className="font-black text-gray-900 text-lg">견적서 발송</h4>
                <p className="text-sm text-gray-500 mt-1">광고주에게 견적서 형식으로 전송됩니다.</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-8 border-b border-gray-200 pb-6">
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">공급처</p>
                    <div className="text-sm text-gray-700 space-y-1 bg-gray-50 p-4 rounded-xl">
                      <p><strong>상호</strong> THEBESTSNS</p>
                      <p><strong>대표자</strong> 김나영</p>
                      <p><strong>주소</strong> 대구광역시 달성군 현풍로6길 5</p>
                      <p><strong>사업자번호</strong> 409-30-51469</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-2">수신처</p>
                    <input type="text" value={estimateForm.recipientName} onChange={(e) => setEstimateForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="업체명 또는 성함 (광고주 닉네임)" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm mb-2" />
                    <input type="text" value={estimateForm.recipientContact} onChange={(e) => setEstimateForm((f) => ({ ...f, recipientContact: e.target.value }))} placeholder="연락처" className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-600 mb-2">작업명</label>
                  <input type="text" value={estimateForm.workName} onChange={(e) => setEstimateForm((f) => ({ ...f, workName: e.target.value }))} placeholder="작업명 입력" className="w-full px-4 py-2.5 rounded-xl border border-gray-200" />
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase mb-1">작업기간 시작</label>
                      <input type="date" value={estimateForm.workPeriodStart} onChange={(e) => setEstimateForm((f) => ({ ...f, workPeriodStart: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-500 uppercase mb-1">작업기간 종료</label>
                      <input type="date" value={estimateForm.workPeriodEnd} onChange={(e) => setEstimateForm((f) => ({ ...f, workPeriodEnd: e.target.value }))} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">견적서일자: 전송 시점(오늘)으로 저장됩니다</p>
                  <p className="text-xs font-black text-gray-500 uppercase mb-3">견적항목</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-emerald-50 text-gray-700">
                          <th className="px-4 py-2 text-center font-black w-14">순번</th>
                          <th className="px-4 py-2 text-left font-black min-w-[280px]">내용</th>
                          <th className="px-4 py-2 text-right font-black w-24">단가</th>
                          <th className="px-4 py-2 text-center font-black w-20">수량</th>
                          <th className="px-4 py-2 text-right font-black w-28">금액</th>
                          <th className="px-4 py-2 text-left font-black min-w-[120px]">비고</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {estimateForm.items.map((it, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-center font-bold text-gray-700">{idx + 1}</td>
                            <td className="px-4 py-2">
                              <textarea value={it.content} onChange={(e) => setEstimateForm((f) => ({ ...f, items: f.items.map((item, i) => (i === idx ? { ...item, content: e.target.value } : item)) }))} placeholder="작업 내용" rows={2} className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm resize-y min-h-[60px]" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min={0} value={it.unitPrice} onChange={(e) => setEstimateForm((f) => ({ ...f, items: f.items.map((item, i) => (i === idx ? { ...item, unitPrice: e.target.value } : item)) }))} placeholder="0" className="w-full px-2 py-1.5 rounded border border-gray-200 text-right text-sm" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min={1} value={it.quantity} onChange={(e) => setEstimateForm((f) => ({ ...f, items: f.items.map((item, i) => (i === idx ? { ...item, quantity: e.target.value } : item)) }))} placeholder="1" className="w-full px-2 py-1.5 rounded border border-gray-200 text-center text-sm" />
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-gray-900">{(Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1)}</td>
                            <td className="px-4 py-2">
                              <input type="text" value={it.remarks} onChange={(e) => setEstimateForm((f) => ({ ...f, items: f.items.map((item, i) => (i === idx ? { ...item, remarks: e.target.value } : item)) }))} placeholder="비고" className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm" />
                            </td>
                            <td className="px-2 py-2">
                              {estimateForm.items.length > 1 && (
                                <button type="button" onClick={() => setEstimateForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))} className="p-1 text-red-500 hover:bg-red-50 rounded text-xs">삭제</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" onClick={() => setEstimateForm((f) => ({ ...f, items: [...f.items, { content: '', unitPrice: '', quantity: '1', remarks: '' }] }))} className="mt-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-black text-sm hover:bg-emerald-100">+ 항목 추가하기</button>
                  {(() => { const total = estimateForm.items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * Math.max(1, Number(it.quantity) || 1), 0); return <p className="mt-2 text-sm text-gray-600">총 금액: {total.toLocaleString()}원 / 수수료(25%+부가세10%): {calcJobRequestFee(total).toLocaleString()}원</p>; })()}
                </div>
                <div>
                  <label className="block text-sm font-black text-gray-600 mb-1">추가 안내사항 (선택)</label>
                  <textarea value={estimateForm.note} onChange={(e) => setEstimateForm((f) => ({ ...f, note: e.target.value }))} placeholder="참고사항, 추가 안내" rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                  <button onClick={() => setEstimateModal(null)} className="px-8 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">취소</button>
                  <button onClick={handleSendEstimate} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">견적서 전송</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
              <h4 className="font-black text-gray-900 text-lg">거절 사유 입력</h4>
              <p className="text-sm text-gray-500">거절 사유는 신청자에게 알림으로 전달됩니다.</p>
              <textarea
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                placeholder="예: 금액이 부적절합니다 / 불법적인 내용이 포함되어 있습니다"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-200 outline-none text-sm"
              />
              <div className="flex gap-3">
                <button onClick={() => setRejectModal(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">
                  취소
                </button>
                <button onClick={confirmReject} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-700">
                  거절 확정
                </button>
              </div>
            </div>
          </div>
        )}

      {revisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <h4 className="font-black text-gray-900 text-lg">수정요청 보내기 · {revisionModal.nickname}</h4>
            <p className="text-sm text-gray-500">수정 요청 내용은 프리랜서에게 알림으로 전달됩니다.</p>
            <textarea
              value={revisionModal.text}
              onChange={(e) => setRevisionModal({ ...revisionModal, text: e.target.value })}
              placeholder="예: 제목을 더 구체적으로 수정해 주세요"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
            />
            <div className="flex gap-3">
              <button onClick={() => setRevisionModal(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">
                취소
              </button>
              <button onClick={() => handleRevisionRequest(revisionModal.task, revisionModal.userId, revisionModal.text)} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black hover:bg-orange-600">
                수정요청 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartTimeAdmin;
