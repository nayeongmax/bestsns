import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PartTimeTask, PartTimeJobRequest } from '@/types';
import { NotificationType } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning, getPartTimeJobRequests, setPartTimeJobRequests, getFreelancerWithdrawRequests, updateFreelancerWithdrawRequestStatus, refundFreelancerWithdrawal, processAutoApprovals } from '@/constants';

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif', '작업링크', '작업안내'];

interface Props {
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const PartTimeAdmin: React.FC<Props> = ({ addNotif }) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [jobRequests, setJobRequests] = useState<PartTimeJobRequest[]>(() => getPartTimeJobRequests());
  const [withdrawRequests, setWithdrawRequests] = useState(() => getFreelancerWithdrawRequests());
  const [rejectModal, setRejectModal] = useState<{ jr: PartTimeJobRequest; reason: string } | null>(null);
  const [revisionModal, setRevisionModal] = useState<{ task: PartTimeTask; userId: string; nickname: string; text: string } | null>(null);
  const [parttimeDateOffset, setParttimeDateOffset] = useState(0);

  useEffect(() => {
    processAutoApprovals();
    setTasks(getPartTimeTasks());
    setJobRequests(getPartTimeJobRequests());
    setWithdrawRequests(getFreelancerWithdrawRequests());
  }, []);

  const refreshWithdrawRequests = () => setWithdrawRequests(getFreelancerWithdrawRequests());

  const pendingReviewsBase = jobRequests.filter((jr) => jr.status === 'pending_review');

  const handleApproveJobRequest = (jr: PartTimeJobRequest) => {
    const next = jobRequests.map((r) =>
      r.id === jr.id ? { ...r, status: 'pending' as const } : r
    );
    setPartTimeJobRequests(next);
    setJobRequests(next);
    if (jr.applicantUserId && addNotif) {
      addNotif(jr.applicantUserId, 'approval', '작업의뢰 승인', `[${jr.title}] 작업의뢰가 승인되었습니다. 프리랜서 워크페이스 → 알바의뢰 (광고주한정) 탭에서 결제를 진행해 주세요.`, '프리랜서 워크페이스 → 알바의뢰 탭에서 결제를 진행해 주세요.');
    }
    alert('승인되었습니다. 신청자에게 알림이 전송되었습니다.');
  };

  const handleRejectJobRequest = (jr: PartTimeJobRequest) => {
    setRejectModal({ jr, reason: '' });
  };

  const confirmReject = () => {
    if (!rejectModal) return;
    const { jr, reason } = rejectModal;
    if (!reason.trim()) {
      alert('거절 사유를 입력해 주세요.');
      return;
    }
    const next = jobRequests.map((r) =>
      r.id === jr.id ? { ...r, status: 'not_selected' as const, rejectReason: reason.trim() } : r
    );
    setPartTimeJobRequests(next);
    setJobRequests(next);
    if (jr.applicantUserId && addNotif) {
      addNotif(jr.applicantUserId, 'revision', '작업의뢰 거절', `[${jr.title}] 작업의뢰가 거절되었습니다. 사유: ${reason.trim()}`, reason.trim());
    }
    setRejectModal(null);
    alert('거절 처리되었습니다. 신청자에게 알림이 전송되었습니다.');
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

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) =>
    (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();

  const handleApprovePass = (task: PartTimeTask, userId: string) => {
    const a = task.applicants.find((ap) => ap.userId === userId && ap.selected && hasWorkLink(ap));
    if (!a) return;
    const now = new Date();
    const autoAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);
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
      addNotif(userId, 'freelancer', '작업 통과', `[${task.title}] 작업이 통과되었습니다. 3일 후 수익통장에 ${task.reward.toLocaleString()}원이 자동 적립됩니다.`, '3일 후 수익통장에 자동 적립됩니다.');
    }
    alert('통과 처리되었습니다. 3일 후 자동으로 수익통장에 지급됩니다.');
  };

  const handlePayPoints = (task: PartTimeTask, userId?: string) => {
    const target = userId
      ? task.applicants.filter((a) => a.userId === userId && a.selected && hasWorkLink(a))
      : task.applicants.filter((a) => a.selected && hasWorkLink(a));
    if (target.length === 0) {
      alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다.');
      return;
    }
    if (!confirm(`작업을 확인하셨나요? ${target.length}명에게 각 ${task.reward.toLocaleString()}원을 지급합니다.`)) return;
    target.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
    if (addNotif) {
      target.forEach((a) =>
        addNotif(a.userId, 'freelancer', '알바비 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`, `작업이 확인되어 수익통장에 ${task.reward.toLocaleString()}원이 적립되었습니다.`)
      );
    }
    const paidIds = target.map((a) => a.userId);
    const allPaid = [...(task.paidUserIds || []), ...paidIds];
    const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
    const pointPaid = selectedWithLink.every((a) => allPaid.includes(a.userId));
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, pointPaid, paidUserIds: allPaid }
    );
    saveTasks(next);
    alert('알바비가 지급되었습니다.');
  };

  const handleSelect = (task: PartTimeTask, userId: string) => {
    const applicant = task.applicants.find((a) => a.userId === userId);
    let updatedTask: PartTimeTask = { ...task, applicants: task.applicants.map((a) => (a.userId === userId ? { ...a, selected: true } : a)) };
    if (task.applicantUserId && !task.jobRequestId) {
      const jobReqs = getPartTimeJobRequests().filter((jr) => jr.applicantUserId === task.applicantUserId && (jr.paid || jr.status === 'pending'));
      const linkedIds = new Set(getPartTimeTasks().filter((t) => t.jobRequestId).map((t) => t.jobRequestId!));
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

  const pendingWithdrawals = withdrawRequests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-10">
      {/* 프리랜서 출금 신청 목록 */}
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
                          onClick={() => {
                            updateFreelancerWithdrawRequestStatus(r.id, 'completed');
                            refreshWithdrawRequests();
                            if (addNotif) addNotif(r.userId, 'freelancer', '출금 완료', `${r.amount.toLocaleString()}원이 ${r.bankName} ${r.accountNo} 계좌로 입금되었습니다.`);
                            alert('입금 완료로 표시했습니다.');
                          }}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700"
                        >
                          입금 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm('입금 실패로 표시하시겠습니까? 수익통장에 해당 금액이 다시 충전됩니다.')) return;
                            refundFreelancerWithdrawal(r.userId, r.amount, '출금 실패 환급');
                            updateFreelancerWithdrawRequestStatus(r.id, 'failed');
                            refreshWithdrawRequests();
                            if (addNotif) addNotif(r.userId, 'freelancer', '출금 실패', `출금 신청이 실패하여 ${r.amount.toLocaleString()}원이 수익통장에 환급되었습니다. 통장 정보를 확인 후 다시 출금 신청해 주세요.`);
                            alert('실패로 표시했습니다. 수익통장에 금액이 환급되었습니다.');
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

      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900 mb-1">누구나알바 · 작업의뢰 검토</h3>
            <p className="text-sm text-gray-500">광고주 신청 폼을 검토한 후, 금액·내용이 적절하면 승인하여 누구나알바 페이지에 업로드해 주세요.</p>
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
          <ul className="space-y-8">
            {pendingReviews.map((jr) => (
              <li key={jr.id} className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-amber-50 px-6 py-3 border-b border-amber-100">
                  <span className="text-xs font-black text-amber-700 uppercase">신청자가 작성한 작업의뢰신청 폼</span>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-1">알바광고 신청제목</p>
                    <p className="text-lg font-black text-gray-900">{jr.title}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-1">작업내용</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{jr.workContent}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase mb-1">플랫폼링크</p>
                    {(() => {
                      const links = jr.platformLinks?.length ? jr.platformLinks : (jr.platformLink ? jr.platformLink.split(',').map((s) => s.trim()).filter(Boolean) : []);
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
                    <p className="font-bold text-gray-800">{jr.contact}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-black text-gray-500 uppercase mb-1">작업기간</p>
                      <p className="font-bold text-gray-800">{jr.workPeriodStart} ~ {jr.workPeriodEnd}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-500 uppercase mb-1">광고금액 · 수수료</p>
                      <p className="font-bold text-gray-800">{jr.unitPrice != null && jr.quantity != null ? `단가 ${jr.unitPrice.toLocaleString()}원 × ${jr.quantity}개` : jr.adAmount.toLocaleString() + '원'} / 수수료 {jr.fee.toLocaleString()}원</p>
                    </div>
                  </div>
                </div>
                <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleApproveJobRequest(jr)}
                    className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectJobRequest(jr)}
                    className="px-8 py-3 rounded-xl bg-red-100 text-red-700 font-black hover:bg-red-200 transition-all"
                  >
                    거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
      </div>

      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-black text-gray-900 mb-2">프리랜서 작업 · 알바비 지급</h3>
            <p className="text-sm text-gray-500">작업 상세와 선정된 프리랜서 목록을 확인한 후, 링크를 클릭해 검토하고 수정요청 또는 포인트 지급해 주세요.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setParttimeDateOffset((o) => o - 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">←</button>
            <span className="text-sm font-black text-gray-600 min-w-[100px] text-center">{parttimeViewDate}</span>
            <button type="button" onClick={() => setParttimeDateOffset((o) => o + 1)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-black">→</button>
          </div>
        </div>

      {tasksWithSelected.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
          링크 확인 후 알바비 지급이 필요한 작업이 없습니다.
        </div>
      ) : (
        <ul className="space-y-10">
          {tasksWithSelected.map((task) => {
            const sections = task.sections || {};
            const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
            return (
              <li key={task.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="p-8 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase">{task.category}</span>
                      <h4 className="text-xl font-black text-gray-900 mt-1">{task.title}</h4>
                      <p className="text-gray-500 mt-1">{task.description}</p>
                      <p className="text-emerald-600 font-black text-lg mt-2">+{task.reward.toLocaleString()}원</p>
                    </div>
                    <Link to={`/part-time/${task.id}`} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200">
                      상세 페이지에서 관리 →
                    </Link>
                  </div>

                  <div className="grid gap-4">
                    <h4 className="text-sm font-black text-gray-500 uppercase">작업 내용 (작업자가 할 일)</h4>
                    {sections.게시글목록 && sections.게시글목록.length > 0 && (
                      <div className="space-y-4">
                        {sections.게시글목록.map((block: { 제목?: string; 내용?: string }, i: number) => (
                          <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">게시글 {i + 1}</p>
                            {block.제목 && <p className="font-black text-gray-800 mb-1">{block.제목}</p>}
                            {block.내용 && <p className="text-gray-800 whitespace-pre-wrap text-sm">{block.내용}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {sections.댓글목록 && sections.댓글목록.length > 0 && (
                      <div className="space-y-4">
                        {sections.댓글목록.map((text: string, i: number) => (
                          <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">댓글 {i + 1}</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {sections.작업링크목록 && sections.작업링크목록.length > 0 && (
                      <div className="space-y-4">
                        {sections.작업링크목록.map((text: string, i: number) => {
                          const isUrl = text.startsWith('http://') || text.startsWith('https://');
                          return (
                            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">작업링크 {i + 1}</p>
                              {isUrl ? (
                                <p><a href={text} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{text}</a></p>
                              ) : (
                                <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase">신청기간</p>
                      <p className="text-gray-800 font-bold">{task.applicationPeriod.start} ~ {task.applicationPeriod.end}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                      <p className="text-[10px] font-black text-amber-600 uppercase">작업기간</p>
                      <p className="text-gray-800 font-bold">{task.workPeriod.start} ~ {task.workPeriod.end}</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-lg font-black text-gray-800 mb-3">프리랜서 신청자 목록 (운영자 전용)</h4>
                    {task.applicants.length === 0 ? (
                      <p className="text-gray-500 py-4">아직 신청자가 없습니다.</p>
                    ) : (
                      <ul className="space-y-4">
                        {task.applicants.map((a) => {
                          const links = a.workLinks?.length ? a.workLinks : (a.workLink ? [a.workLink] : []);
                          const paid = task.paidUserIds?.includes(a.userId);
                          return (
                            <li key={a.userId} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-black text-gray-800">{a.nickname}</p>
                                  <p className="text-sm text-gray-500">{a.comment || '신청합니다'}</p>
                                  {a.contact && <p className="text-sm text-blue-600 font-bold">연락처: {a.contact}</p>}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {a.selected ? (
                                    <>
                                      <button type="button" onClick={() => handleDeselect(task, a.userId)} className="px-4 py-2 rounded-lg text-sm font-black bg-amber-100 text-amber-700 hover:bg-amber-200">
                                        선정취소
                                      </button>
                                      <span className="px-4 py-2 rounded-lg text-sm font-black bg-emerald-600 text-white">선정됨</span>
                                    </>
                                  ) : (
                                    <button type="button" onClick={() => handleSelect(task, a.userId)} className="px-4 py-2 rounded-lg text-sm font-black bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700">
                                      선정
                                    </button>
                                  )}
                                  <button type="button" onClick={() => navigate('/chat', { state: { targetUser: { id: a.userId, nickname: a.nickname, profileImage: '' } } })} className="px-4 py-2 rounded-lg text-sm font-black bg-blue-100 text-blue-700 hover:bg-blue-200">
                                    채팅하기
                                  </button>
                                </div>
                              </div>
                              {a.selected && (
                                <div className="text-sm space-y-2">
                                  {links.length > 0 ? (
                                    <div>
                                      <p className="text-gray-700 font-bold">작업 링크 ({links.length}개):</p>
                                      {links.map((url, i) => (
                                        <p key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{url}</a></p>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-amber-600 font-bold">작업 링크 미제출</p>
                                  )}
                                  {links.length > 0 && !paid && (
                                    <div className="flex gap-2 flex-wrap items-center">
                                      <button type="button" onClick={() => setRevisionModal({ task, userId: a.userId, nickname: a.nickname, text: a.revisionRequest || '' })} className="px-3 py-1.5 rounded-lg text-xs font-black bg-orange-100 text-orange-700 hover:bg-orange-200">
                                        수정요청
                                      </button>
                                      {a.deliveryAt && a.autoApproveAt ? (
                                        new Date(a.autoApproveAt) > new Date() ? (
                                          <span className="text-blue-600 font-bold text-xs">3일 후 자동 지급 ({new Date(a.autoApproveAt).toLocaleString('ko-KR')})</span>
                                        ) : (
                                          <span className="text-amber-600 font-bold text-xs">자동 지급 처리 중</span>
                                        )
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => handleApprovePass(task, a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700">
                                            통과
                                          </button>
                                          <button type="button" onClick={() => handlePayPoints(task, a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700">
                                            즉시 지급
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {paid && <span className="text-gray-500 font-bold text-xs">✓ 지급 완료</span>}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="text-sm text-gray-500 mt-3">링크를 클릭해 확인 후, 수정요청이 필요하면 수정요청 버튼으로 알림을 보내거나 포인트 지급해 주세요.</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
};

export default PartTimeAdmin;
