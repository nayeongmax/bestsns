import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { PartTimeTask, PartTimeJobRequest } from '@/types';
import { NotificationType } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning, getPartTimeJobRequests, setPartTimeJobRequests } from '@/constants';

interface Props {
  addNotif: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const PartTimeAdmin: React.FC<Props> = ({ addNotif }) => {
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [jobRequests, setJobRequests] = useState<PartTimeJobRequest[]>(() => getPartTimeJobRequests());
  const [rejectModal, setRejectModal] = useState<{ jr: PartTimeJobRequest; reason: string } | null>(null);

  useEffect(() => {
    setTasks(getPartTimeTasks());
    setJobRequests(getPartTimeJobRequests());
  }, []);

  const pendingReviews = jobRequests.filter((jr) => jr.status === 'pending_review');

  const handleApproveJobRequest = (jr: PartTimeJobRequest) => {
    const next = jobRequests.map((r) =>
      r.id === jr.id ? { ...r, status: 'pending' as const } : r
    );
    setPartTimeJobRequests(next);
    setJobRequests(next);
    if (jr.applicantUserId && addNotif) {
      addNotif(jr.applicantUserId, 'approval', '작업의뢰 승인', `[${jr.title}] 작업의뢰가 승인되었습니다. 구매자 대시보드 > 알바의뢰 탭에서 결제를 진행해 주세요.`, jr.id);
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
      r.id === jr.id ? { ...r, status: 'not_selected' as const } : r
    );
    setPartTimeJobRequests(next);
    setJobRequests(next);
    if (jr.applicantUserId && addNotif) {
      addNotif(jr.applicantUserId, 'revision', '작업의뢰 거절', `[${jr.title}] 작업의뢰가 거절되었습니다. 사유: ${reason.trim()}`, jr.id);
    }
    setRejectModal(null);
    alert('거절 처리되었습니다. 신청자에게 알림이 전송되었습니다.');
  };

  const tasksWithSelected = tasks.filter(
    (t) => !t.pointPaid && t.applicants.some((a) => a.selected)
  );

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) =>
    (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();
  const handlePayPoints = (task: PartTimeTask) => {
    const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
    if (selectedWithLink.length === 0) {
      alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다.');
      return;
    }
    if (!confirm(`작업을 확인하셨나요? ${selectedWithLink.length}명에게 각 ${task.reward.toLocaleString()} P를 수익통장에 지급합니다.`)) return;
    selectedWithLink.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
    if (addNotif) {
      selectedWithLink.forEach((a) =>
        addNotif(a.userId, 'freelancer', '포인트 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()} P가 수익통장에 적립되었습니다.`, task.id)
      );
    }
    const paidIds = selectedWithLink.map((a) => a.userId);
    const next = tasks.map((t) =>
      t.id !== task.id ? t : { ...t, pointPaid: true, paidUserIds: [...(t.paidUserIds || []), ...paidIds] }
    );
    saveTasks(next);
    alert('포인트가 지급되었습니다.');
  };

  return (
    <div className="space-y-10">
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 mb-1">누구나알바 · 작업의뢰 검토</h3>
        <p className="text-sm text-gray-500 mb-6">광고주 신청 폼을 검토한 후, 금액·내용이 적절하면 승인하여 누구나알바 페이지에 업로드해 주세요.</p>

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
                    {jr.platformLink ? (
                      <a href={jr.platformLink} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold hover:underline break-all">{jr.platformLink}</a>
                    ) : (
                      <p className="text-gray-400">-</p>
                    )}
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
                      <p className="font-bold text-gray-800">{jr.adAmount.toLocaleString()} P / 수수료 {jr.fee.toLocaleString()} P</p>
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
        <h3 className="text-xl font-black text-gray-900 mb-2">프리랜서 작업 · 포인트 지급</h3>
        <p className="text-sm text-gray-500 mb-6">선정된 프리랜서의 작업 링크를 확인한 후, 작업이 잘 되었으면 포인트 지급 버튼을 눌러 수익통장에 적립해 주세요.</p>

      {tasksWithSelected.length === 0 ? (
        <div className="py-12 text-center text-gray-500 font-bold rounded-2xl bg-gray-50 border border-gray-100">
          링크 확인 후 포인트 지급이 필요한 작업이 없습니다.
        </div>
      ) : (
        <ul className="space-y-6">
          {tasksWithSelected.map((task) => {
            const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
            const selectedNoLink = task.applicants.filter((a) => a.selected && !hasWorkLink(a));
            return (
              <li key={task.id} className="p-6 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h4 className="font-black text-gray-900">{task.title}</h4>
                    <p className="text-sm text-gray-500">+{task.reward.toLocaleString()} P · <Link to={`/part-time/${task.id}`} className="text-emerald-600 font-bold hover:underline">작업 상세 보기</Link></p>
                  </div>
                  {selectedWithLink.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handlePayPoints(task)}
                      className="px-6 py-3 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-all"
                    >
                      작업 확인 후 포인트 지급 ({selectedWithLink.length}명)
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {task.applicants.filter((a) => a.selected).map((a) => {
                    const links = a.workLinks?.length ? a.workLinks : (a.workLink ? [a.workLink] : []);
                    return (
                      <div key={a.userId} className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-white border border-gray-100">
                        <span className="font-bold text-gray-800">{a.nickname}</span>
                        {links.length > 0 ? (
                          <a href={links[0]} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold text-sm truncate max-w-[280px] hover:underline">
                            작업 링크 확인 {links.length > 1 ? `(${links.length}개)` : ''}
                          </a>
                        ) : (
                          <span className="text-amber-600 text-sm font-bold">링크 미제출</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedNoLink.length > 0 && (
                  <p className="text-xs text-gray-500">링크 미제출 {selectedNoLink.length}명은 링크 제출 후 지급 가능합니다.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
};

export default PartTimeAdmin;
