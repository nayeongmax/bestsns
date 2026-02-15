import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { NotificationType } from '@/types';
import { getPartTimeTasks, setPartTimeTasks, addFreelancerEarning, processAutoApprovals, getPartTimeJobRequests } from '@/constants';

interface Props {
  user: UserProfile | null;
  members?: UserProfile[];
  onUpdateUser?: (updated: UserProfile) => void;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지', '동영상', 'gif', '작업링크', '작업안내'];

const PartTimeTaskDetail: React.FC<Props> = ({ user, members = [], addNotif }) => {
  const displayUser = useMemo(() => {
    if (!user) return null;
    const m = members.find((x) => x.id === user.id);
    return m ? { ...user, ...m } : user;
  }, [user, members]);
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const focusWorkLink = (location.state as { focusWorkLink?: boolean; fromAdmin?: boolean })?.focusWorkLink;
  const fromAdmin = (location.state as { fromAdmin?: boolean })?.fromAdmin;
  const [tasks, setTasks] = useState<PartTimeTask[]>(() => getPartTimeTasks());
  const [isEditingWorkLinks, setIsEditingWorkLinks] = useState(false);
  const [applyComment, setApplyComment] = useState('');
  const [applyContact, setApplyContact] = useState('');
  const [workLinks, setWorkLinks] = useState<string[]>(['']);
  const [revisionModal, setRevisionModal] = useState<{ userId: string; nickname: string; text: string } | null>(null);
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    processAutoApprovals();
    setTasks(getPartTimeTasks());
  }, [taskId]);

  /** 작업 링크 수정 모드: focusWorkLink 또는 수정요청 시 workLinks에 제출된 링크 채우기 */
  useEffect(() => {
    if (!task || !user) return;
    const me = task.applicants.find((a) => a.userId === user.id);
    if (!me?.selected) return;
    const submitted = me.workLinks?.length ? me.workLinks : (me.workLink ? [me.workLink] : []);
    if (submitted.length > 0 && (focusWorkLink || me.revisionRequest)) {
      setWorkLinks(submitted);
      setIsEditingWorkLinks(true);
    }
  }, [task?.id, user?.id, focusWorkLink, task?.applicants]);

  /** 작업일 이틀 전 / 작업당일 알림 (선정된 신청자에게 1회만) */
  useEffect(() => {
    if (!task || !addNotif || task.pointPaid) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const inTwo = new Date(today);
    inTwo.setDate(today.getDate() + 2);
    const twoDaysStr = `${inTwo.getFullYear()}-${String(inTwo.getMonth() + 1).padStart(2, '0')}-${String(inTwo.getDate()).padStart(2, '0')}`;
    const start = task.workPeriod?.start;
    if (!start) return;
    const selected = task.applicants.filter((a) => a.selected);
    if (selected.length === 0) return;

    const key2day = `parttime_reminder_${task.id}_2day`;
    const keyDay = `parttime_reminder_${task.id}_day`;
    if (start === twoDaysStr && !localStorage.getItem(key2day)) {
      localStorage.setItem(key2day, '1');
      selected.forEach((a) =>
        addNotif(a.userId, 'freelancer', '작업일 안내', `[${task.title}] 작업일까지 이틀 전입니다. 기한 내에 완료해 주세요.`, '작업일까지 이틀 전입니다. 기한 내에 완료해 주세요.')
      );
    }
    if (start === todayStr && !localStorage.getItem(keyDay)) {
      localStorage.setItem(keyDay, '1');
      selected.forEach((a) =>
        addNotif(a.userId, 'freelancer', '작업당일', `[${task.title}] 오늘이 작업일입니다. 완료 후 링크를 제출해 주세요.`, '오늘이 작업일입니다. 완료 후 링크를 제출해 주세요.')
      );
    }
  }, [task, addNotif]);

  const saveTasks = (next: PartTimeTask[]) => {
    setPartTimeTasks(next);
    setTasks(next);
  };

  const isApplicant = user && task?.applicants.some((a) => a.userId === user.id);
  const isOperator = user?.role === 'admin';

  const handleApply = () => {
    if (!user || !task) return;
    const effectiveUser = displayUser || user;
    if (effectiveUser.freelancerStatus !== 'approved') {
      if (window.confirm('누구나알바에 신청하려면 프리랜서 등록이 필요합니다.\n프리랜서 워크페이스에서 등록을 먼저 진행해 주세요.\n\n마이페이지로 이동할까요?')) {
        navigate('/mypage', { state: { activeTab: 'freelancer' } as any });
      }
      return;
    }
    if (task.applicants.some((a) => a.userId === user.id)) {
      alert('이미 신청하셨습니다.');
      return;
    }
    if (!agree1 || !agree2 || !agree3) {
      alert('필수 동의 항목에 모두 체크해 주세요.');
      return;
    }
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : {
            ...t,
            applicants: [
              ...t.applicants,
              { userId: user.id, nickname: user.nickname, comment: applyComment.trim() || '신청합니다', contact: applyContact.trim() || undefined, selected: false, appliedAt: new Date().toISOString() },
            ],
          }
    );
    saveTasks(next);
    setApplyComment('');
    setApplyContact('');
    alert('신청되었습니다.');
  };

  /** 운영자: 신청자 선정 → 선정자에게 알림, jobRequestId 자동 연결 */
  const handleSelect = (userId: string) => {
    if (!task) return;
    const applicant = task.applicants.find((a) => a.userId === userId);
    const now = new Date().toISOString();
    let updatedTask: PartTimeTask = { ...task, applicants: task.applicants.map((a) => (a.userId === userId ? { ...a, selected: true, selectedAt: now } : a)) };
    if (task.applicantUserId && !task.jobRequestId) {
      const jobReqs = getPartTimeJobRequests().filter((jr) => jr.applicantUserId === task!.applicantUserId && (jr.paid || jr.status === 'pending'));
      const linkedIds = new Set(getPartTimeTasks().filter((t) => t.jobRequestId).map((t) => t.jobRequestId));
      const unlinked = jobReqs.find((jr) => !linkedIds.has(jr.id));
      if (unlinked) updatedTask = { ...updatedTask, jobRequestId: unlinked.id };
    }
    const next = tasks.map((t) => (t.id !== task.id ? t : updatedTask));
    saveTasks(next);
    if (applicant && addNotif) {
      addNotif(
        userId,
        'freelancer',
        '프리랜서 선정',
        `[${task.title}]에 선정되었습니다. 작업 완료 후 작업 링크를 제출해 주세요.`,
        '작업 완료 후 작업 링크를 제출해 주세요.'
      );
    }
    if (task.applicantUserId && addNotif) {
      addNotif(task.applicantUserId, 'approval', '프리랜서 선정', `[${task.title}]에 프리랜서가 선정되었습니다.`, '프리랜서 선정이 완료되었습니다.');
    }
  };

  /** 운영자: 선정 취소 → 해당 신청자에게 알림 */
  const handleDeselect = (userId: string) => {
    if (!task) return;
    const applicant = task.applicants.find((a) => a.userId === userId);
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : { ...t, applicants: t.applicants.map((a) => (a.userId === userId ? { ...a, selected: false } : a)) }
    );
    saveTasks(next);
    if (applicant && addNotif) {
      addNotif(
        userId,
        'freelancer',
        '선정 취소',
        `[${task.title}] 작업에서 선정이 취소되었습니다. 일정이 맞지 않을 경우 다른 작업을 신청해 주세요.`,
        '선정이 취소되었습니다. 일정이 맞지 않을 경우 다른 작업을 신청해 주세요.'
      );
    }
  };

  /** 선정된 프리랜서: 작업링크 여러 개 제출 */
  const addWorkLinkInput = () => setWorkLinks((w) => [...w, '']);
  const removeWorkLinkInput = (index: number) => setWorkLinks((w) => (w.length <= 1 ? w : w.filter((_, i) => i !== index)));
  const updateWorkLinkInput = (index: number, value: string) => setWorkLinks((w) => w.map((v, i) => (i === index ? value : v)));

  const handleSubmitWorkLink = () => {
    if (!user || !task) return;
    const links = workLinks.map((s) => s.trim()).filter(Boolean);
    if (links.length === 0) {
      alert('작업 링크를 1개 이상 입력해 주세요.');
      return;
    }
    const now = new Date().toISOString();
    const next = tasks.map((t) =>
      t.id !== task.id
        ? t
        : {
            ...t,
            applicants: t.applicants.map((a) =>
              a.userId === user.id
                ? { ...a, workLinks: links, workLink: links[0], revisionRequest: undefined, workLinkSubmittedAt: now, reApprovalRequestedAt: a.revisionRequest ? now : undefined }
                : a
            ),
          }
    );
    saveTasks(next);
    setWorkLinks(['']);
    setIsEditingWorkLinks(false);
    if (addNotif) {
      addNotif(user.id, 'freelancer', '링크 제출 완료', '광고주 확인 후 4~7일이내 수익통장에 충전됩니다. 수고많으셨습니다.', '광고주 확인 후 4~7일이내 수익통장에 충전됩니다.');
    }
    if (task.applicantUserId && addNotif) {
      addNotif(task.applicantUserId, 'approval', '작업 완료', `[${task.title}] 프리랜서가 작업 링크를 제출했습니다. 마이페이지 → 알바의뢰에서 확인해 주세요.`);
    }
    if (task.createdBy && addNotif && task.applicantUserId) {
      addNotif(task.createdBy, 'approval', '작업이 완료되었습니다', `[${task.title}] 프리랜서가 작업 링크를 제출했습니다. 어드민 패널 수익탭에서 작업확인 버튼으로 링크를 확인해 주세요.`);
    }
    alert('작업링크가 제출되었습니다.\n제대로 작업이 되었는지 확인 후 수익통장에 충전됩니다.\n수고많으셨습니다.');
  };

  /** 운영자: 통과 (3일 후 자동 지급) */
  const hasWorkLink = (a: { workLink?: string; workLinks?: string[] }) =>
    (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();
  const handleApprovePass = (userId: string) => {
    if (!task) return;
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

  /** 운영자: 즉시 지급 (기존 포인트 지급) - 작업건당 1회만 수익통장 입금 */
  const handlePayPoints = (userId?: string) => {
    if (!task) return;
    const freshTasks = getPartTimeTasks();
    const freshTask = freshTasks.find((x) => x.id === task.id);
    const currentPaid = freshTask?.paidUserIds ?? task.paidUserIds ?? [];
    const base = userId
      ? task.applicants.filter((a) => a.userId === userId && a.selected && hasWorkLink(a))
      : task.applicants.filter((a) => a.selected && hasWorkLink(a));
    const target = base.filter((a) => !currentPaid.includes(a.userId));
    if (target.length === 0) {
      if (base.length > 0 && base.every((a) => currentPaid.includes(a.userId))) {
        alert('이미 수익통장에 지급 완료된 상태입니다. 이중 지급되지 않습니다.');
      } else {
        alert('선정된 인원 중 작업 링크를 제출한 사람이 없습니다.');
      }
      return;
    }
    if (!confirm(`작업 링크를 확인하셨나요? ${target.length}명에게 각 ${task.reward.toLocaleString()}원을 즉시 지급합니다.`)) return;
    target.forEach((a) => addFreelancerEarning(a.userId, task.reward, task.title));
    if (addNotif) {
      target.forEach((a) =>
        addNotif(a.userId, 'freelancer', '알바비 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`, `작업이 확인되어 수익통장에 ${task.reward.toLocaleString()}원이 적립되었습니다.`)
      );
    }
    const paidIds = target.map((a) => a.userId);
    const allPaid = [...(freshTask?.paidUserIds ?? task.paidUserIds ?? []), ...paidIds];
    const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
    const pointPaid = selectedWithLink.every((a) => allPaid.includes(a.userId));
    const next = freshTasks.map((t) =>
      t.id !== task.id ? t : { ...t, pointPaid, paidUserIds: allPaid }
    );
    setPartTimeTasks(next);
    setTasks(next);
    alert('알바비가 지급되었습니다.');
    if (!userId) navigate('/part-time');
  };

  /** 운영자: 수정요청 → 프리랜서에게 알림 */
  const handleRevisionRequest = (userId: string, text: string) => {
    if (!task || !text.trim()) return;
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

  if (!task) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <p className="text-gray-500 font-bold">작업을 찾을 수 없습니다.</p>
        <button onClick={() => { fromAdmin ? navigate(-1) : navigate('/part-time'); }} className="mt-4 text-emerald-600 font-black hover:underline">
          목록으로
        </button>
      </div>
    );
  }

  const sections = task.sections || {};

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 md:px-8 animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl border border-gray-100 space-y-8">
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-50 uppercase tracking-wider">{task.category}</span>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-2 tracking-tight">{task.title}</h1>
            <p className="text-gray-500 mt-2 leading-relaxed">{task.description}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-lg">+{task.reward.toLocaleString()}원</span>
            </div>
          </div>
          <button onClick={() => { fromAdmin ? navigate(-1) : navigate('/part-time'); }} className="shrink-0 px-4 py-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold text-sm transition-colors">
            {fromAdmin ? '← 이전' : '← 목록'}
          </button>
        </div>

        <div className="grid gap-4">
          <h3 className="text-sm font-black text-gray-500 uppercase">작업 내용 (작업자가 할 일)</h3>
          {(() => {
            const order = sections.sectionOrder;
            if (order && order.length > 0) {
              return order.map(({ type, index }, i) => {
                if (type === '게시글' && sections.게시글목록?.[index]) {
                  const block = sections.게시글목록[index];
                  return (
                    <div key={`${type}-${index}`} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">게시글 {index + 1}</p>
                      {block.제목 && <p className="font-black text-gray-800 mb-1">{block.제목}</p>}
                      {block.내용 && <p className="text-gray-800 whitespace-pre-wrap text-sm">{block.내용}</p>}
                    </div>
                  );
                }
                if (type === '댓글' && sections.댓글목록?.[index]) {
                  const text = sections.댓글목록[index];
                  return (
                    <div key={`${type}-${index}`} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">댓글 {index + 1}</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                    </div>
                  );
                }
                if (type === '작업링크' && sections.작업링크목록?.[index]) {
                  const text = sections.작업링크목록[index];
                  const isUrl = text.startsWith('http://') || text.startsWith('https://');
                  return (
                    <div key={`${type}-${index}`} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">작업링크 {index + 1}</p>
                      {isUrl ? (
                        <p className="text-gray-800 whitespace-pre-wrap"><a href={text} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{text}</a></p>
                      ) : (
                        <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                      )}
                    </div>
                  );
                }
                if (type === '제목' && sections.제목목록?.[index]) {
                  return (
                    <div key={`${type}-${index}`} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">제목 {index + 1}</p>
                      <p className="font-black text-gray-800">{sections.제목목록[index]}</p>
                    </div>
                  );
                }
                if (type === '내용' && sections.내용목록?.[index]) {
                  return (
                    <div key={`${type}-${index}`} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">내용 {index + 1}</p>
                      <p className="text-gray-800 whitespace-pre-wrap text-sm">{sections.내용목록[index]}</p>
                    </div>
                  );
                }
                return null;
              });
            }
            return (
              <>
                {sections.게시글목록 && sections.게시글목록.length > 0 && (
                  <div className="space-y-4">
                    {sections.게시글목록.map((block, i) => (
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
                    {sections.댓글목록.map((text, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">댓글 {i + 1}</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sections.제목목록 && sections.제목목록.length > 0 && (
                  <div className="space-y-4">
                    {sections.제목목록.map((text, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">제목 {i + 1}</p>
                        <p className="font-black text-gray-800">{text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sections.내용목록 && sections.내용목록.length > 0 && (
                  <div className="space-y-4">
                    {sections.내용목록.map((text, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">내용 {i + 1}</p>
                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sections.작업링크목록 && sections.작업링크목록.length > 0 && (
                  <div className="space-y-4">
                    {sections.작업링크목록.map((text, i) => {
                      const isUrl = text.startsWith('http://') || text.startsWith('https://');
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase mb-1">작업링크 {i + 1}</p>
                          {isUrl ? (
                            <p className="text-gray-800 whitespace-pre-wrap"><a href={text} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{text}</a></p>
                          ) : (
                            <p className="text-gray-800 whitespace-pre-wrap">{text}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
          {SECTIONS_ORDER.filter((key) => key !== '제목' && key !== '내용').map(
            (key) => {
              const hasImageList = key === '이미지' && sections.이미지목록?.length;
              const hasImageContent = key === '이미지' && (sections[key] || hasImageList);
              if (key === '이미지' && !hasImageContent) return null;
              if (key === '댓글' && (sections.댓글목록?.length || !sections.댓글)) return null;
              if (key === '작업링크' && (sections.작업링크목록?.length || !sections.작업링크)) return null;
              if (key !== '이미지' && key !== '댓글' && key !== '작업링크' && key !== '동영상' && key !== 'gif' && !sections[key]) return null;
              if (key === '동영상' && !sections.동영상) return null;
              if (key === 'gif' && !sections.gif) return null;
              const meSelected = user && task.applicants.some((a) => a.userId === user.id && a.selected);
              const downloadMedia = (src: string, filename: string) => {
                if (!meSelected) return;
                fetch(src).then((r) => r.blob()).then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }).catch(() => {
                  const a = document.createElement('a');
                  a.href = src;
                  a.download = filename;
                  a.click();
                });
              };
              return (
                <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{key}</p>
                  {key === '이미지' ? (
                    <>
                      {sections.이미지목록 && sections.이미지목록.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {sections.이미지목록.map((src, i) => (
                            <div key={i} className="relative">
                              <img src={src} alt={`참고 ${i + 1}`} className="max-h-32 rounded-lg object-contain border border-gray-200" />
                              {meSelected && (
                                <button type="button" onClick={() => downloadMedia(src, `이미지_${i + 1}.png`)} className="absolute bottom-1 right-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {sections.이미지?.startsWith('data:') && !sections.이미지목록?.length ? (
                        <div className="relative inline-block">
                          <img src={sections.이미지} alt="참고" className="max-h-40 rounded-lg object-contain border border-gray-200" />
                          {meSelected && (
                            <button type="button" onClick={() => downloadMedia(sections.이미지!, '이미지.png')} className="absolute bottom-2 right-2 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                          )}
                        </div>
                      ) : sections.이미지 ? (
                        <p className="text-gray-800 whitespace-pre-wrap">{sections.이미지}</p>
                      ) : null}
                    </>
                  ) : key === '동영상' && sections.동영상?.startsWith('data:') ? (
                    <div className="space-y-2">
                      <video src={sections.동영상} className="max-h-48 rounded-lg border border-gray-200" controls />
                      {meSelected && (
                        <button type="button" onClick={() => downloadMedia(sections.동영상!, '동영상.mp4')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                      )}
                    </div>
                  ) : key === 'gif' && sections.gif?.startsWith('data:') ? (
                    <div className="space-y-2">
                      <img src={sections.gif} alt="GIF 참고" className="max-h-40 rounded-lg border border-gray-200" />
                      {meSelected && (
                        <button type="button" onClick={() => downloadMedia(sections.gif!, '참고.gif')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                      )}
                    </div>
                  ) : key === '작업링크' && sections.작업링크 && (sections.작업링크.startsWith('http://') || sections.작업링크.startsWith('https://')) ? (
                    <p className="text-gray-800 whitespace-pre-wrap"><a href={sections.작업링크} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all">{sections.작업링크}</a></p>
                  ) : (key === '동영상' || key === 'gif') && sections[key] && !sections[key]?.startsWith('data:') ? (
                    <p className="text-gray-800 whitespace-pre-wrap">{sections[key]}</p>
                  ) : (
                    <p className="text-gray-800 whitespace-pre-wrap">{sections[key]}</p>
                  )}
                </div>
              );
            }
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
            <span className="text-[10px] font-black text-blue-600 uppercase">신청기간</span>
            <span className="text-gray-800 font-bold">{task.applicationPeriod.start} ~ {task.applicationPeriod.end}</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
            <span className="text-[10px] font-black text-amber-600 uppercase">작업기간</span>
            <span className="text-gray-800 font-bold">{task.workPeriod.start} ~ {task.workPeriod.end}</span>
          </div>
        </div>

        {/* 신청 댓글 — 운영자만 상세 목록 확인 가능 */}
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-lg font-black text-gray-800 mb-3">신청 댓글</h3>
          {!isOperator ? (
            <p className="text-gray-500 py-3">신청자 {task.applicants.length}명 · 운영자만 신청 목록을 확인할 수 있습니다.</p>
          ) : task.applicants.length === 0 ? (
            <p className="text-gray-500 py-3">아직 신청한 사람이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {task.applicants.map((a) => (
                <li key={a.userId} className="flex items-start gap-2 py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="font-black text-gray-800 shrink-0">{a.nickname}</span>
                  <span className="text-gray-600 text-sm">{a.comment || '신청합니다'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {user && !task.pointPaid && (
          <>
            {!isApplicant ? (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm font-bold text-gray-700 mb-2">내 신청 댓글 (선택)</p>
                <input
                  type="text"
                  value={applyComment}
                  onChange={(e) => setApplyComment(e.target.value)}
                  placeholder="신청합니다"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none mb-3"
                />
                <p className="text-sm font-bold text-gray-700 mb-2">연락처 (급할 때 연락 가능)</p>
                <input
                  type="tel"
                  value={applyContact}
                  onChange={(e) => setApplyContact(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none mb-3"
                />
                <div className="space-y-3 p-3 rounded-xl bg-amber-50 border border-amber-200 mb-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agree1} onChange={(e) => setAgree1(e.target.checked)} className="mt-1 rounded" />
                    <span className="text-sm">(필수) 본 건은 플랫폼으로부터 재위탁받은 업무이며, 광고주와 직접 계약 관계가 없음을 인지합니다.</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agree2} onChange={(e) => setAgree2(e.target.checked)} className="mt-1 rounded" />
                    <span className="text-sm">(필수) 본 작업과 관련된 게시글 및 대화 기록은 임의로 삭제할 수 없음에 동의합니다.</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agree3} onChange={(e) => setAgree3(e.target.checked)} className="mt-1 rounded" />
                    <span className="text-sm">(필수) 직거래 시도 시 거래액의 10배 위약벌 청구 및 영구 제명 조치에 동의합니다.</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleApply}
                  className="mt-3 px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all"
                >
                  신청하기
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-500 font-bold">신청 완료되었습니다. 선정 시 수익통장에 포인트가 적립됩니다.</p>
                {(() => {
                  const me = task.applicants.find((a) => a.userId === user?.id);
                  if (me?.selected) {
                    const submitted = me.workLinks?.length ? me.workLinks : (me.workLink ? [me.workLink] : []);
                    return (
                      <div className="border-t border-gray-100 pt-6 mt-4">
                        <h3 className="text-lg font-black text-gray-800 mb-2">작업 링크 제출</h3>
                        <p className="text-sm text-gray-500 mb-3">작업을 완료한 후 결과 링크를 남겨 주세요. 링크를 여러 개 제출할 수 있습니다. 운영자 확인 후 포인트가 지급됩니다.</p>
                        {submitted.length > 0 && !isEditingWorkLinks ? (
                          <div className="space-y-2">
                            <p className="text-gray-700 font-bold">제출된 링크:</p>
                            {submitted.map((url, i) => (
                              <p key={i} className="text-sm">
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline break-all">{url}</a>
                              </p>
                            ))}
                            <button type="button" onClick={() => setIsEditingWorkLinks(true)} className="mt-3 px-4 py-2 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600">
                              수정
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-2 mb-3">
                              {workLinks.map((url, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                  <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => updateWorkLinkInput(idx, e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none"
                                  />
                                  {workLinks.length > 1 && (
                                    <button type="button" onClick={() => removeWorkLinkInput(idx)} className="px-3 py-2 rounded-lg text-red-500 text-sm font-bold hover:bg-red-50">삭제</button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <button type="button" onClick={addWorkLinkInput} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">
                                + 링크 추가
                              </button>
                              <button type="button" onClick={handleSubmitWorkLink} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all">
                                {me.revisionRequest ? '재승인 요청' : '작업 링크 제출'}
                              </button>
                              {submitted.length > 0 && (
                                <button type="button" onClick={() => setIsEditingWorkLinks(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">
                                  취소
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}

            {isOperator && (
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-black text-gray-800 mb-3">프리랜서 신청자 목록 (운영자 전용)</h3>
                <p className="text-sm text-gray-500 mb-3">링크 확인 후 포인트 지급. 일반 회원은 이 목록·선정·지급 결과를 볼 수 없습니다.</p>
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
                              <button type="button" onClick={() => handleDeselect(a.userId)} className="px-4 py-2 rounded-lg text-sm font-black bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all">
                                선정취소
                              </button>
                              <span className="px-4 py-2 rounded-lg text-sm font-black bg-emerald-600 text-white">선정됨</span>
                            </>
                          ) : (
                            <button type="button" onClick={() => handleSelect(a.userId)} className="px-4 py-2 rounded-lg text-sm font-black bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all">
                              선정
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate('/chat', { state: { targetUser: { id: a.userId, nickname: a.nickname, profileImage: '' } } })}
                            className="px-4 py-2 rounded-lg text-sm font-black bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all"
                          >
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
                              <button type="button" onClick={() => setRevisionModal({ userId: a.userId, nickname: a.nickname, text: a.revisionRequest || '' })} className="px-3 py-1.5 rounded-lg text-xs font-black bg-orange-100 text-orange-700 hover:bg-orange-200">
                                수정요청
                              </button>
                              {a.deliveryAt && a.autoApproveAt ? (
                                new Date(a.autoApproveAt) > new Date() ? (
                                  <span className="text-blue-600 font-bold text-xs">3일 후 자동 지급 예정 ({new Date(a.autoApproveAt).toLocaleString('ko-KR')})</span>
                                ) : (
                                  <span className="text-amber-600 font-bold text-xs">자동 지급 처리 중...</span>
                                )
                              ) : (
                                <>
                                  <button type="button" onClick={() => handleApprovePass(a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700">
                                    통과
                                  </button>
                                  <button type="button" onClick={() => handlePayPoints(a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700">
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
                  );})}
                </ul>
                )}
                <p className="text-sm text-gray-500 mt-3">링크를 클릭해 확인 후, 수정요청이 필요하면 수정요청 버튼으로 알림을 보내거나 포인트 지급해 주세요.</p>
              </div>
            )}
          </>
        )}

        {task.pointPaid && (
          <p className="text-center text-gray-500 font-bold py-4">이 작업은 마감되었습니다.</p>
        )}

        {!user && (
          <p className="text-center text-gray-500 font-bold">로그인 후 신청할 수 있습니다.</p>
        )}
      </div>

      {revisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <h4 className="font-black text-gray-900 text-lg">수정요청 보내기 · {revisionModal.nickname}</h4>
            <p className="text-sm text-gray-500">수정 요청 내용은 프리랜서에게 알림으로 전달됩니다.</p>
            <textarea
              value={revisionModal.text}
              onChange={(e) => setRevisionModal({ ...revisionModal, text: e.target.value })}
              placeholder="예: 제목을 더 구체적으로 수정해 주세요 / 이미지 링크가 열리지 않습니다"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
            />
            <div className="flex gap-3">
              <button onClick={() => setRevisionModal(null)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">
                취소
              </button>
              <button onClick={() => handleRevisionRequest(revisionModal.userId, revisionModal.text)} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black hover:bg-orange-600">
                수정요청 전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartTimeTaskDetail;
