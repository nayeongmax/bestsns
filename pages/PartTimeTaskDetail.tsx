import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from '@/types';
import type { PartTimeTask } from '@/types';
import { NotificationType } from '@/types';
import {
  fetchPartTimeTaskById,
  fetchPartTimeTasks,
  fetchPartTimeJobRequests,
  upsertPartTimeTasks,
  processAutoApprovalsInDb,
  fetchFreelancerBalance,
  setFreelancerBalance,
  addFreelancerEarningToDb,
} from '../parttimeDb';
import { supabase } from '../supabase';
import { updateProfile } from '../profileDb';
import { FREELANCER_FEE_RATE } from '@/constants';

interface Props {
  user: UserProfile | null;
  members?: UserProfile[];
  onUpdateUser?: (updated: UserProfile) => void;
  addNotif?: (userId: string, type: NotificationType, title: string, message: string, reason?: string) => void;
}

const SECTIONS_ORDER: (keyof NonNullable<PartTimeTask['sections']>)[] = ['제목', '내용', '댓글', '키워드', '이미지', 'gif', '작업링크', '작업안내'];

const PartTimeTaskDetail: React.FC<Props> = ({ user, members = [], onUpdateUser, addNotif }) => {
  const displayUser = useMemo(() => {
    if (!user) return null;
    const m = members.find((x) => x.id === user.id);
    return m ? { ...user, ...m } : user;
  }, [user, members]);
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const focusWorkLink = (location.state as { focusWorkLink?: boolean; fromAdmin?: boolean; selectedDate?: string; initialTask?: PartTimeTask })?.focusWorkLink;
  const fromAdmin = (location.state as { fromAdmin?: boolean })?.fromAdmin;
  const passedDate = (location.state as { selectedDate?: string } | null)?.selectedDate;
  const initialTask = (location.state as { initialTask?: PartTimeTask } | null)?.initialTask;
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeDate = passedDate || todayStr;
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomedImagePng, setZoomedImagePng] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PartTimeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobRequests, setJobRequests] = useState<Awaited<ReturnType<typeof fetchPartTimeJobRequests>>>([]);
  const [isEditingWorkLinks, setIsEditingWorkLinks] = useState(false);
  const [applyComment, setApplyComment] = useState('');
  const [applyContact, setApplyContact] = useState('');
  const [applyCafeId, setApplyCafeId] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [workLinks, setWorkLinks] = useState<string[]>(['']);
  const [revisionModal, setRevisionModal] = useState<{ userId: string; nickname: string; text: string } | null>(null);
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [agree4, setAgree4] = useState(false);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoLocation, setVideoLocation] = useState('');
  const [videoStoreName, setVideoStoreName] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);
  const [showApplyWarning, setShowApplyWarning] = useState(false);
  const [rejectVideoModal, setRejectVideoModal] = useState<{ videoId: string; fileName: string; userId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [replaceVideoFile, setReplaceVideoFile] = useState<File | null>(null);
  const [isReplacingVideo, setIsReplacingVideo] = useState(false);

  const task = tasks.find((t) => t.id === taskId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 해당 작업 하나만 조회 (전체 목록 대신) → sections 포함하면서도 빠르게 로드
        const [single, jrList] = await Promise.all([fetchPartTimeTaskById(taskId!), fetchPartTimeJobRequests()]);
        if (!cancelled) {
          setTasks(single ? [single] : []);
          setJobRequests(jrList);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { console.error('PartTimeTaskDetail load:', e); setLoading(false); }
      }
      // auto-approval은 백그라운드에서 실행 (작업 데이터 로딩을 막지 않음)
      processAutoApprovalsInDb().catch(() => {});
    })();
    return () => { cancelled = true; };
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

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const saveTasks = (next: PartTimeTask[]) => {
    setTasks(next);
    upsertPartTimeTasks(next).catch((e) => console.error('saveTasks:', e));
  };

  const isApplicant = user && task?.applicants.some((a) => a.userId === user.id);
  const isOperator = user?.role === 'admin' || user?.role === 'manager';
  const myApplication = user ? task?.applicants.find((a) => a.userId === user.id) : null;
  const isSelected = !!myApplication?.selected;

  const handleApply = () => {
    if (!user || !task) return;
    const effectiveUser = displayUser || user;
    if (effectiveUser.freelancerStatus !== 'approved') {
      if (window.confirm('누구나알바에 신청하려면 프리랜서 등록이 필요합니다.\n프리랜서 워크스페이스에서 등록을 먼저 진행해 주세요.\n\n마이페이지로 이동할까요?')) {
        navigate('/mypage', { state: { activeTab: 'freelancer' } as any });
      }
      return;
    }
    if (task.applicants.some((a) => a.userId === user.id)) {
      alert('이미 신청하셨습니다.');
      return;
    }
    if (!agree1 || !agree2 || !agree3 || !agree4) {
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
              { userId: user.id, nickname: user.nickname, comment: applyComment.trim() || '신청합니다', contact: applyContact.trim() || undefined, cafeId: applyCafeId.trim() || undefined, selected: false, appliedAt: new Date().toISOString() },
            ],
          }
    );
    saveTasks(next);
    setApplyComment('');
    setApplyContact('');
    setApplyCafeId('');
    setShowApplyWarning(true);
  };

  /** 운영자: 신청자 선정 → 선정자에게 알림, jobRequestId 자동 연결 */
  const handleSelect = (userId: string) => {
    if (!taskId) return;
    const now = new Date().toISOString();
    setTasks((prev) => {
      const currentTask = prev.find((t) => t.id === taskId);
      if (!currentTask) return prev;
      const applicant = currentTask.applicants.find((a) => a.userId === userId);
      let updatedTask: PartTimeTask = {
        ...currentTask,
        applicants: currentTask.applicants.map((a) =>
          a.userId === userId ? { ...a, selected: true, selectedAt: now } : a
        ),
      };
      if (currentTask.applicantUserId && !currentTask.jobRequestId) {
        const jobReqs = jobRequests.filter((jr) => jr.applicantUserId === currentTask.applicantUserId && (jr.paid || jr.status === 'pending'));
        const linkedIds = new Set(prev.filter((t) => t.jobRequestId).map((t) => t.jobRequestId!));
        const unlinked = jobReqs.find((jr) => !linkedIds.has(jr.id));
        if (unlinked) updatedTask = { ...updatedTask, jobRequestId: unlinked.id };
      }
      const next = prev.map((t) => (t.id !== taskId ? t : updatedTask));
      upsertPartTimeTasks(next).catch((e) => {
        console.error('선정 저장 실패:', e);
        alert('선정은 반영됐으나 저장에 실패했습니다. 새로고침 시 되돌아갈 수 있습니다.');
      });
      if (applicant && addNotif) {
        addNotif(userId, 'freelancer', '프리랜서 선정', `[${currentTask.title}]에 선정되었습니다. 작업 완료 후 작업 링크를 제출해 주세요.`, '작업 완료 후 작업 링크를 제출해 주세요.');
      }
      if (currentTask.applicantUserId && addNotif) {
        addNotif(currentTask.applicantUserId, 'approval', '프리랜서 선정', `[${currentTask.title}]에 프리랜서가 선정되었습니다.`, '프리랜서 선정이 완료되었습니다.');
      }
      return next;
    });
  };

  /** 운영자: 선정 취소 (경고 부여 여부 선택) */
  const handleDeselect = (userId: string) => {
    if (!taskId) return;
    const memberProfile = members.find((m) => m.id === userId);
    const currentWarnings = memberProfile?.violationCount ?? 0;
    const giveWarning = window.confirm(
      `선정 취소 시 이 프리랜서에게 경고를 부여하시겠습니까?\n현재 경고: ${currentWarnings}회 → ${currentWarnings + 1}회\n\n확인: 경고 부여 + 선정 취소\n취소: 경고 없이 선정 취소`
    );
    setTasks((prev) => {
      const currentTask = prev.find((t) => t.id === taskId);
      if (!currentTask) return prev;
      const applicant = currentTask.applicants.find((a) => a.userId === userId);
      const next = prev.map((t) =>
        t.id !== taskId
          ? t
          : { ...t, applicants: t.applicants.map((a) => (a.userId === userId ? { ...a, selected: false } : a)) }
      );
      upsertPartTimeTasks(next).catch((e) => {
        console.error('선정취소 저장 실패:', e);
        alert('선정 취소가 저장에 실패했습니다. 새로고침 후 다시 시도해 주세요.');
      });
      if (applicant && addNotif) {
        addNotif(userId, 'freelancer', '선정 취소', `[${currentTask.title}] 작업에서 선정이 취소되었습니다.`, '선정이 취소되었습니다.');
      }
      return next;
    });
    if (giveWarning && memberProfile) {
      const newCount = currentWarnings + 1;
      const updated = { ...memberProfile, violationCount: newCount };
      updateProfile(userId, { violationCount: newCount }).catch((e) => console.error('경고 저장 실패:', e));
      onUpdateUser?.(updated);
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
      addNotif(user.id, 'freelancer', '링크 제출 완료', '광고주 확인 후 4일 이내 수익통장에 충전됩니다. 수고많으셨습니다.', '광고주 확인 후 4일 이내 수익통장에 충전됩니다.');
    }
    if (task.applicantUserId && addNotif) {
      addNotif(task.applicantUserId, 'approval', '작업 완료', `[${task.title}] 프리랜서가 작업 링크를 제출했습니다. 마이페이지 → 알바의뢰에서 확인해 주세요.`);
    }
    if (task.createdBy && addNotif && task.applicantUserId) {
      addNotif(task.createdBy, 'approval', '작업이 완료되었습니다', `[${task.title}] 프리랜서가 작업 링크를 제출했습니다. 어드민 패널 수익탭에서 작업확인 버튼으로 링크를 확인해 주세요.`);
    }
    alert('작업링크가 제출되었습니다.\n제대로 작업이 되었는지 확인 후 수익통장에 충전됩니다.\n수고많으셨습니다.');
  };

  /** 영상제공: 여러 영상 파일 동시 업로드 (일별 인원 제한 적용) */
  const handleSubmitVideo = async () => {
    if (!user || !task || videoFiles.length === 0) return;
    if (!videoLocation.trim()) { alert('촬영 지역을 입력해 주세요.'); return; }
    if (!videoStoreName.trim()) { alert('매장명을 입력해 주세요.'); return; }
    const uploads = task.videoUploads ?? [];
    const activeDateUploaderIds = new Set(uploads.filter((v) => v.date === activeDate).map((v) => v.userId));
    if (!activeDateUploaderIds.has(user.id) && task.dailyLimit && activeDateUploaderIds.size >= task.dailyLimit) {
      setShowDailyLimitModal(true);
      return;
    }
    setIsUploadingVideo(true);
    const newUploads: typeof uploads = [];
    try {
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        setUploadProgressText(`업로드 중... (${i + 1} / ${videoFiles.length})`);
        const ext = file.name.split('.').pop() ?? 'mp4';
        const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const path = `${task.id}/${user.id}_${uploadId}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('parttime-videos')
          .upload(path, file, { upsert: false, cacheControl: '3600' });
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);
        const { data: { publicUrl } } = supabase.storage.from('parttime-videos').getPublicUrl(uploadData.path);
        newUploads.push({
          id: uploadId, userId: user.id, nickname: user.nickname,
          videoUrl: publicUrl, fileName: file.name,
          uploadedAt: new Date().toISOString(), date: activeDate,
          location: videoLocation.trim(), storeName: videoStoreName.trim(),
        });
      }
      const next = tasks.map((t) =>
        t.id !== task.id ? t : { ...t, videoUploads: [...(t.videoUploads ?? []), ...newUploads] }
      );
      saveTasks(next);
      setVideoFiles([]);
      if (addNotif) addNotif(user.id, 'freelancer', '영상 제출 완료', `[${task.title}] ${newUploads.length}개 영상이 제출되었습니다. 확인 후 포인트가 지급됩니다.`);
      if (task.createdBy && addNotif) addNotif(task.createdBy, 'approval', '새 영상이 제출됐습니다', `[${task.title}] ${user.nickname}님이 영상 ${newUploads.length}개(${videoStoreName.trim()})를 제출했습니다.`);
      alert(`${newUploads.length}개 영상이 모두 제출되었습니다!\n확인 후 포인트가 지급됩니다 :)`);
    } catch (err) {
      alert('영상 업로드에 실패했습니다.\n' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsUploadingVideo(false);
      setUploadProgressText('');
    }
  };

  /** 프리랜서: 검토중 영상 파일 교체 */
  const handleReplaceVideo = async (oldVideoId: string) => {
    if (!user || !task || !replaceVideoFile) return;
    const oldVideo = (task.videoUploads ?? []).find((v) => v.id === oldVideoId);
    if (!oldVideo) return;
    setIsReplacingVideo(true);
    try {
      const file = replaceVideoFile;
      const ext = file.name.split('.').pop() ?? 'mp4';
      const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const path = `${task.id}/${user.id}_${uploadId}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('parttime-videos')
        .upload(path, file, { upsert: false, cacheControl: '3600' });
      if (uploadError) throw new Error(uploadError.message);
      const { data: { publicUrl } } = supabase.storage.from('parttime-videos').getPublicUrl(uploadData.path);
      const next = tasks.map((t) =>
        t.id !== task.id ? t : {
          ...t,
          videoUploads: (t.videoUploads ?? []).map((v) =>
            v.id !== oldVideoId ? v : {
              ...v, videoUrl: publicUrl, fileName: file.name,
              uploadedAt: new Date().toISOString(), status: undefined,
            }
          ),
        }
      );
      saveTasks(next);
      setEditingVideoId(null);
      setReplaceVideoFile(null);
      alert('영상이 교체되었습니다. 검토 후 포인트가 지급됩니다.');
    } catch (err) {
      alert('영상 교체에 실패했습니다.\n' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsReplacingVideo(false);
    }
  };

  /** 운영자: 통과 (4일 후 자동 지급) */
  const hasWorkLink = (a: { workLink?: string; workLinks?: string[]; videoUrl?: string }) =>
    task?.category === '영상제공'
      ? !!a.videoUrl
      : (a.workLinks?.length ?? 0) > 0 || !!a.workLink?.trim();
  const handleApprovePass = (userId: string) => {
    if (!task) return;
    const a = task.applicants.find((ap) => ap.userId === userId && ap.selected && hasWorkLink(ap));
    if (!a) return;
    const now = new Date();
    const autoAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4일 후 자동 지급
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
      addNotif(userId, 'freelancer', '작업 통과', `[${task.title}] 작업이 통과되었습니다. 4일 이내 수익통장에 ${task.reward.toLocaleString()}원이 적립됩니다.`, '4일 이내 수익통장에 적립됩니다.');
    }
    alert('통과 처리되었습니다. 4일 이내 자동으로 수익통장에 지급됩니다.');
  };

  /** 운영자: 즉시 지급 (기존 포인트 지급) - 작업건당 1회만 수익통장 입금 */
  const handlePayPoints = async (userId?: string) => {
    if (!task) return;
    const freshTask = tasks.find((x) => x.id === task.id);
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
    try {
      const netAmount = Math.round(task.reward * (1 - FREELANCER_FEE_RATE));
      for (const a of target) {
        const cur = await fetchFreelancerBalance(a.userId);
        await setFreelancerBalance(a.userId, cur + netAmount);
        await addFreelancerEarningToDb(a.userId, `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'task', task.reward, task.title, task.id);
      }
      if (addNotif) {
        target.forEach((a) =>
          addNotif(a.userId, 'freelancer', '알바비 지급 완료', `[${task.title}] 작업 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`, `작업이 확인되어 수익통장에 ${task.reward.toLocaleString()}원이 적립되었습니다.`)
        );
      }
      const paidIds = target.map((a) => a.userId);
      const allPaid = [...(freshTask?.paidUserIds ?? task.paidUserIds ?? []), ...paidIds];
      const paidAtIso = new Date().toISOString();
      const selectedWithLink = task.applicants.filter((a) => a.selected && hasWorkLink(a));
      const pointPaid = selectedWithLink.every((a) => allPaid.includes(a.userId));
      const next = tasks.map((t) =>
        t.id !== task.id ? t : {
          ...t,
          pointPaid,
          paidUserIds: allPaid,
          applicants: t.applicants.map((ap) =>
            paidIds.includes(ap.userId) ? { ...ap, paidAt: paidAtIso } : ap
          ),
        }
      );
      setTasks(next);
      await upsertPartTimeTasks(next);
      alert('알바비가 지급되었습니다.');
      if (!userId) navigate('/part-time');
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`지급 처리 중 오류가 발생했습니다.\n${msg}`);
    }
  };

  /** 운영자: 영상제공 - 반려 모달 열기 */
  const handleRejectVideo = (videoId: string) => {
    if (!task) return;
    const targetVideo = task.videoUploads?.find((v) => v.id === videoId);
    if (!targetVideo) return;
    setRejectReason('');
    setRejectVideoModal({ videoId, fileName: targetVideo.fileName, userId: targetVideo.userId });
  };

  /** 운영자: 영상제공 - 반려 확정 (사유 포함) */
  const handleRejectVideoConfirm = () => {
    if (!task || !rejectVideoModal) return;
    const reason = rejectReason.trim();
    const next = tasks.map((t) =>
      t.id !== task.id ? t : {
        ...t,
        videoUploads: (t.videoUploads ?? []).map((v) =>
          v.id === rejectVideoModal.videoId
            ? { ...v, status: 'rejected' as const, rejectionReason: reason || undefined }
            : v
        ),
      }
    );
    saveTasks(next);
    if (addNotif) {
      const reasonText = reason ? ` 반려 사유: ${reason}` : '';
      addNotif(rejectVideoModal.userId, 'revision', '영상 반려 안내', `[${task.title}] 제출하신 영상(${rejectVideoModal.fileName})이 반려되었습니다.${reasonText} 영상을 다시 확인하고 재제출해 주세요.`);
    }
    setRejectVideoModal(null);
    setRejectReason('');
  };

  /** 운영자: 영상제공 - 반려 취소 (실수 시 복구) */
  const handleUnrejectVideo = (videoId: string) => {
    if (!task) return;
    const next = tasks.map((t) =>
      t.id !== task.id ? t : {
        ...t,
        videoUploads: (t.videoUploads ?? []).map((v) =>
          v.id === videoId ? { ...v, status: 'pending' as const } : v
        ),
      }
    );
    saveTasks(next);
  };

  /** 운영자: 영상제공 - 해당 날짜에 제출한 영상 전체 지급 (1인 1일 1회) */
  const handlePayVideoUploader = async (userId: string, nickname: string, date: string) => {
    if (!task) return;
    const freshTask = tasks.find((x) => x.id === task.id);
    const dateVideos = (freshTask?.videoUploads ?? task.videoUploads ?? []).filter(
      (v) => v.userId === userId && v.date === date
    );
    if (dateVideos.some((v) => v.status === 'paid')) { alert('이미 지급 완료된 상태입니다.'); return; }
    const toPay = dateVideos.filter((v) => v.status !== 'rejected');
    if (toPay.length === 0) { alert('지급할 영상이 없습니다. (전부 반려됨)'); return; }
    if (!confirm(`${nickname}님의 ${date} 제출 영상 ${toPay.length}개에 대해\n${task.reward.toLocaleString()}원을 지급합니다.`)) return;
    try {
      const netAmount = Math.round(task.reward * (1 - FREELANCER_FEE_RATE));
      const cur = await fetchFreelancerBalance(userId);
      await setFreelancerBalance(userId, cur + netAmount);
      await addFreelancerEarningToDb(userId, `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, 'task', task.reward, task.title, task.id);
      if (addNotif) addNotif(userId, 'freelancer', '포인트 지급 완료', `[${task.title}] 영상 확인 후 ${task.reward.toLocaleString()}원이 수익통장에 적립되었습니다.`);
      const next = tasks.map((t) => t.id !== task.id ? t : {
        ...t,
        videoUploads: (t.videoUploads ?? []).map((v) =>
          v.userId === userId && v.date === date && v.status !== 'rejected'
            ? { ...v, status: 'paid' as const }
            : v
        ),
      });
      setTasks(next);
      await upsertPartTimeTasks(next);
      alert('포인트가 지급되었습니다.');
    } catch (err) {
      console.error(err);
      alert(`지급 처리 중 오류가 발생했습니다.\n${err instanceof Error ? err.message : String(err)}`);
    }
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

  // 줌 모달 이미지 → PNG 변환 (다른이름으로저장 시 .jfif 대신 .png로 저장되도록)
  // 반드시 조기 return 이전에 위치해야 Hooks 규칙 준수
  useEffect(() => {
    if (!zoomedImage) { setZoomedImagePng(null); return; }
    if (zoomedImage.startsWith('data:image/png')) { setZoomedImagePng(zoomedImage); return; }
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setZoomedImagePng(zoomedImage); return; }
        ctx.drawImage(img, 0, 0);
        setZoomedImagePng(canvas.toDataURL('image/png'));
      } catch { setZoomedImagePng(zoomedImage); }
    };
    img.onerror = () => { if (!cancelled) setZoomedImagePng(zoomedImage); };
    img.src = zoomedImage;
    return () => { cancelled = true; };
  }, [zoomedImage]);

  if (!task) {
    if (loading) {
      return (
        <div className="max-w-3xl mx-auto py-12 px-4 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-400 font-bold">로딩 중...</p>
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <p className="text-gray-500 font-bold">작업을 찾을 수 없습니다.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-emerald-600 font-black hover:underline">
          목록으로
        </button>
      </div>
    );
  }

  const sections = task.sections || {};
  const meSelected = user && task.applicants.some((a) => a.userId === user.id && a.selected);
  const getImgExt = (mimeOrSrc: string): string => {
    const m = mimeOrSrc.toLowerCase();
    if (m.includes('png')) return '.png';
    if (m.includes('gif')) return '.gif';
    if (m.includes('webp')) return '.webp';
    return '.jpg'; // jpeg / jfif / 기타 모두 .jpg
  };
  const downloadMedia = (src: string, filename: string) => {
    if (!meSelected) return;
    const baseName = filename.replace(/\.[^.]+$/, '');
    if (src.startsWith('data:')) {
      // data URL: MIME 타입을 헤더에서 직접 추출
      const mime = src.split(';')[0].split(':')[1] ?? '';
      const ext = getImgExt(mime);
      const a = document.createElement('a');
      a.href = src; a.download = baseName + ext; a.click();
    } else {
      fetch(src).then((r) => r.blob()).then((blob) => {
        const ext = getImgExt(blob.type);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = baseName + ext; a.click();
        URL.revokeObjectURL(url);
      }).catch(() => {
        const a = document.createElement('a');
        a.href = src; a.download = baseName + '.jpg'; a.click();
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-12 px-3 md:px-8 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl md:rounded-[32px] p-3 md:p-10 shadow-xl border border-gray-100 space-y-4 md:space-y-8 overflow-hidden">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-emerald-600 bg-emerald-50 uppercase tracking-wider">{task.category}</span>
              <span className="inline-flex items-center gap-0.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-sm">+{task.reward.toLocaleString()}원</span>
            </div>
            <h1 className="text-lg md:text-3xl font-black text-gray-900 mt-2 leading-snug">{task.title}</h1>
            {task.description && task.description !== task.title && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
            )}
          </div>
          <button onClick={() => navigate(-1)} className="shrink-0 px-3 py-1.5 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-bold text-sm transition-colors whitespace-nowrap">
            ← 목록
          </button>
        </div>

        {/* ── 영상제공 전용: 직접 업로드 UI ─────────────────── */}
        {task.category === '영상제공' && (() => {
          const uploads = task.videoUploads ?? [];
          const activeDateUploaderIds = new Set(uploads.filter((v) => v.date === activeDate).map((v) => v.userId));
          const myUploads = uploads.filter((v) => v.userId === user?.id && v.date === activeDate);
          const canUpload = !user ? false : !task.dailyLimit || activeDateUploaderIds.has(user.id) || activeDateUploaderIds.size < task.dailyLimit;
          return (
            <div className="space-y-6">
              {/* 날짜별 제출 현황 */}
              {task.dailyLimit ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-black text-gray-600">{activeDate} 제출 현황</span>
                  <span className={`px-3 py-1 rounded-full font-black text-xs ${activeDateUploaderIds.size >= task.dailyLimit ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {activeDateUploaderIds.size} / {task.dailyLimit}명
                  </span>
                </div>
              ) : null}

              {/* 내 제출 영상 목록 (이 날짜) */}
              {myUploads.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-black text-gray-700">내가 제출한 영상 ({myUploads.length}개)</p>
                  <div className="space-y-2">
                    {myUploads.map((v) => {
                      const isPaid = v.status === 'paid';
                      const isRejected = v.status === 'rejected';
                      const isPending = !v.status || v.status === 'pending';
                      const isEditing = editingVideoId === v.id;
                      return (
                        <div key={v.id} className={`flex flex-col gap-2 p-3 rounded-xl border ${isRejected ? 'bg-red-50 border-red-200' : isPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-gray-800 truncate">🎬 {v.fileName}</p>
                              {(v.location || v.storeName) && (
                                <p className="text-xs font-bold text-gray-600">📍 {[v.location, v.storeName].filter(Boolean).join(' · ')}</p>
                              )}
                              <p className="text-[10px] text-gray-400">{v.date} {v.uploadedAt.slice(11, 16)}</p>
                              {isPaid ? (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">✅ 포인트 지급 완료</span>
                              ) : isRejected ? (
                                <div className="mt-1 space-y-1">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600">❌ 반려됨</span>
                                  {v.rejectionReason && (
                                    <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">반려 사유: {v.rejectionReason}</p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">🔍 검토중</span>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap">
                              {!isRejected && (
                                <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" download={v.fileName}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-700">
                                  ⬇ 다운로드
                                </a>
                              )}
                              {isPending && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => { setEditingVideoId(v.id); setReplaceVideoFile(null); }}
                                  className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-black hover:bg-amber-200"
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          </div>
                          {/* 영상 교체 폼 */}
                          {isPending && isEditing && (
                            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                              <p className="text-xs font-black text-amber-700">교체할 영상 파일을 선택하세요</p>
                              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-amber-300 cursor-pointer hover:border-amber-500 bg-white">
                                <span className="text-sm font-bold text-gray-700 truncate">{replaceVideoFile ? replaceVideoFile.name : '파일 선택 (MP4, MOV 등)'}</span>
                                <input type="file" accept="video/*" className="hidden"
                                  onChange={(e) => setReplaceVideoFile(e.target.files?.[0] ?? null)} />
                                <span className="shrink-0 text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">파일 선택</span>
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReplaceVideo(v.id)}
                                  disabled={!replaceVideoFile || isReplacingVideo}
                                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                                >
                                  {isReplacingVideo ? '교체 중...' : '영상 교체하기'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingVideoId(null); setReplaceVideoFile(null); }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          )}
                          {/* 반려됨: 재제출 안내 */}
                          {isRejected && (
                            <p className="text-xs text-red-600 font-bold">아래 제출 양식에서 새 영상을 제출해 주세요.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 업로드 섹션 */}
              {user ? (
                canUpload ? (
                  <div className="border-2 border-rose-200 rounded-2xl p-5 bg-rose-50/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center shrink-0">📹</div>
                      <div>
                        <h3 className="font-black text-gray-900">촬영 영상 제출하기</h3>
                        <p className="text-xs text-gray-500 mt-0.5">지역, 매장명, 영상 파일을 입력 후 제출해 주세요.</p>
                      </div>
                    </div>
                    {/* 지역 입력 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-black text-gray-600 mb-1">촬영 지역 <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={videoLocation}
                          onChange={(e) => setVideoLocation(e.target.value)}
                          placeholder="예: 서울 강남구"
                          className="w-full px-3 py-2.5 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-200 outline-none text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-600 mb-1">매장명 <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={videoStoreName}
                          onChange={(e) => setVideoStoreName(e.target.value)}
                          placeholder="예: OO식당"
                          className="w-full px-3 py-2.5 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-200 outline-none text-sm bg-white"
                        />
                      </div>
                    </div>
                    {/* 파일 선택 (여러 개) */}
                    <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-rose-300 cursor-pointer hover:border-rose-500 transition-all bg-white">
                      <span className="text-2xl">🎬</span>
                      <div className="min-w-0 flex-1">
                        {videoFiles.length === 0 ? (
                          <>
                            <p className="text-sm font-black text-gray-800">영상 파일 선택 (MP4, MOV 등)</p>
                            <p className="text-xs text-gray-400">여러 개 동시 선택 가능 · 용량 제한 없음</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-black text-gray-800">{videoFiles.length}개 선택됨</p>
                            <p className="text-xs text-gray-400">총 {(videoFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB</p>
                          </>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">파일 선택</span>
                      <input type="file" accept="video/*" multiple className="hidden"
                        onChange={(e) => setVideoFiles(Array.from(e.target.files ?? []))} />
                    </label>
                    {/* 선택된 파일 목록 */}
                    {videoFiles.length > 0 && (
                      <div className="space-y-1">
                        {videoFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-rose-100 text-xs">
                            <span className="font-bold text-gray-700 truncate">🎬 {f.name}</span>
                            <span className="shrink-0 text-gray-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {myUploads.length > 0 && (
                      <p className="text-xs text-emerald-600 font-bold">✅ {activeDate} {myUploads.length}개 제출 완료 · 추가 영상도 제출 가능합니다</p>
                    )}
                    <button type="button" onClick={handleSubmitVideo} disabled={videoFiles.length === 0 || isUploadingVideo}
                      className="w-full py-3 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                      {isUploadingVideo ? (uploadProgressText || '업로드 중...') : videoFiles.length > 1 ? `영상 ${videoFiles.length}개 모두 제출하기` : '영상 제출하기'}
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-orange-50 border-2 border-orange-200 text-center space-y-2">
                    <p className="text-lg">⏰</p>
                    <p className="font-black text-orange-800">오늘 영상 제출 마감</p>
                    <p className="text-sm text-orange-600">{activeDate} 최대 {task.dailyLimit}명이 이미 제출했습니다.<br />다른 날짜를 선택해 주세요!</p>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">로그인 후 영상을 제출할 수 있습니다.</p>
              )}
            </div>
          );
        })()}

        {/* ── 영상제공 전용: 작업 안내 내용 표시 ──────────── */}
        {task.category === '영상제공' && (() => {
          const hasSections =
            (sections.내용목록?.length ?? 0) > 0 ||
            (sections.게시글목록?.length ?? 0) > 0 ||
            (sections.댓글목록?.length ?? 0) > 0 ||
            (sections.이미지목록?.length ?? 0) > 0 ||
            !!sections.작업안내 || !!sections.이미지 || !!sections.gif;
          if (!hasSections) return null;
          return (
            <div className="border-2 border-blue-100 rounded-2xl p-5 md:p-6 bg-blue-50/20 space-y-4">
              <h3 className="font-black text-gray-900">📋 작업 안내</h3>
              {sections.내용목록 && sections.내용목록.length > 0 && (
                <div className="space-y-3">
                  {sections.내용목록.map((text, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                      {sections.내용목록!.length > 1 && <p className="text-[10px] font-black text-gray-400 uppercase mb-1">내용 {i + 1}</p>}
                      <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              )}
              {sections.게시글목록 && sections.게시글목록.length > 0 && (
                <div className="space-y-3">
                  {sections.게시글목록.map((block, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                      {block.제목 && <p className="font-black text-gray-800 mb-1">{block.제목}</p>}
                      {block.내용 && <p className="text-gray-800 whitespace-pre-wrap text-sm">{block.내용}</p>}
                    </div>
                  ))}
                </div>
              )}
              {sections.댓글목록 && sections.댓글목록.length > 0 && sections.댓글목록.map((text, i) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">댓글 {i + 1}</p>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm">{text}</p>
                </div>
              ))}
              {sections.이미지목록 && sections.이미지목록.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sections.이미지목록.map((src, i) => (
                    <img key={i} src={src} alt={`참고 ${i + 1}`} className="max-h-40 rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-90" onClick={() => setZoomedImage(src)} />
                  ))}
                </div>
              )}
              {sections.작업안내 && (
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-1">작업안내</p>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm">{sections.작업안내}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 3단계 진행 안내 (영상제공 외 카테고리) ──────── */}
        {task.category !== '영상제공' && <div className="space-y-0">

          {/* STEP 1 ─ 회원가입하기 */}
          <div className="border-2 border-emerald-200 rounded-2xl p-4 md:p-6 bg-emerald-50/30">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">1</div>
              <div>
                <h3 className="font-black text-gray-900 text-sm md:text-base">회원가입하기</h3>
                <p className="text-xs font-black text-emerald-700 mt-0.5">작업링크에 접속해서 카페 회원가입 양식에 맞춰 작성 후 가입 하세요!</p>
              </div>
            </div>
          </div>

          {/* 화살표 */}
          <div className="flex justify-center py-1.5">
            <svg className="w-5 h-6 text-gray-300" fill="currentColor" viewBox="0 0 20 32">
              <path d="M9 0h2v22H9zM4.5 17.5l5.5 8 5.5-8H4.5z" />
            </svg>
          </div>

          {/* STEP 2 ─ 원본 글 작성 (선정자·운영자만) */}
          {!(isSelected || isOperator) ? (
            <div className="border-2 border-gray-100 rounded-2xl p-4 md:p-6 bg-gray-50 flex items-center gap-3">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-200 text-gray-400 font-black text-sm flex items-center justify-center shrink-0">2</div>
              <div>
                <p className="font-black text-gray-400 text-sm md:text-base">아래 원본 내용으로 게시글 작성하기</p>
                <p className="text-xs text-gray-400 mt-0.5">🔒 선정된 후 작업 내용이 공개됩니다.</p>
              </div>
            </div>
          ) : (
          <>{/* STEP 2 ─ 원본 글 작성 */}
          <div className="border-2 border-blue-200 rounded-2xl p-3 md:p-6 bg-blue-50/20">
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">2</div>
                <div>
                  <h3 className="font-black text-gray-900 text-sm md:text-base">아래 원본 내용으로 게시글 작성하기</h3>
                  <p className="text-xs text-gray-500 mt-0.5">원본 글을 그대로 복사해서 작성해 주세요</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 ml-9">
                <span className={`px-2.5 py-1 rounded-full text-xs font-black border shadow-sm ${(task.postVisibility ?? '전체공개') === '멤버공개' ? 'bg-amber-400 text-white border-amber-500' : 'bg-blue-500 text-white border-blue-600'}`}>
                  {task.postVisibility ?? '전체공개'}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-500 text-white border border-purple-600 shadow-sm">1분간 체류</span>
                {task.workTimeSlot && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500 text-white border border-indigo-600 shadow-sm whitespace-nowrap">
                    🕐 {task.workTimeSlot}
                  </span>
                )}
              </div>
            </div>
            {/* 필수 안내 배너 */}
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-1.5 mb-2">
              <span className="shrink-0 text-xs">⚠️</span>
              <p className="text-[11px] font-black text-amber-800 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="text-amber-600">{task.postVisibility ?? '전체공개'}</span> 설정 · <span className="text-purple-700">1분 체류</span> 필수
              </p>
            </div>
            <div className="grid gap-2 md:gap-4">
          <h3 className="text-sm font-black text-gray-500 uppercase">작업 내용 (작업자가 할 일)</h3>
          {(() => {
            const order = sections.sectionOrder;
            if (order && order.length > 0) {
              return order.map(({ type, index }, i) => {
                if (type === '게시글' && sections.게시글목록?.[index]) {
                  const block = sections.게시글목록[index];
                  const blockText = [block.제목, block.내용].filter(Boolean).join('\n\n');
                  const blockKey = `게시글-${index}`;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase">게시글 {index + 1}</p>
                        <button type="button" onClick={() => copyText(blockText, blockKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                          {copiedSection === blockKey ? '✓ 복사됨' : '📋 복사'}
                        </button>
                      </div>
                      {block.제목 && <p className="font-black text-gray-900 text-sm leading-snug break-words">{block.제목}</p>}
                      {block.내용 && <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed break-words">{block.내용}</p>}
                    </div>
                  );
                }
                if (type === '댓글' && sections.댓글목록?.[index]) {
                  const text = sections.댓글목록[index];
                  const commentKey = `댓글-${index}`;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase">댓글 {index + 1}</p>
                        <button type="button" onClick={() => copyText(text, commentKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                          {copiedSection === commentKey ? '✓ 복사됨' : '📋 복사'}
                        </button>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap text-xs break-words">{text}</p>
                    </div>
                  );
                }
                if (type === '작업링크' && sections.작업링크목록?.[index]) {
                  const text = sections.작업링크목록[index];
                  const isUrl = text.startsWith('http://') || text.startsWith('https://');
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">작업링크 {index + 1}</p>
                      {isUrl ? (
                        <div className="flex items-center gap-1.5 w-full min-w-0">
                          <a href={text} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 flex-1 min-w-0 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 transition-colors">
                            <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <span className="text-emerald-700 font-bold text-xs truncate min-w-0 flex-1">{text}</span>
                          </a>
                          <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopiedUrl(text); setTimeout(() => setCopiedUrl(null), 2000); }}
                            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-gray-50 hover:bg-gray-100 border-gray-200">
                            {copiedUrl === text
                              ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              : <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            }
                          </button>
                        </div>
                      ) : (
                        <p className="text-gray-800 text-xs break-words">{text}</p>
                      )}
                    </div>
                  );
                }
                if (type === '제목' && sections.제목목록?.[index]) {
                  const titleKey = `제목-${index}`;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[9px] font-black text-gray-400 uppercase">제목 {index + 1}</p>
                        <button type="button" onClick={() => copyText(sections.제목목록![index], titleKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                          {copiedSection === titleKey ? '✓ 복사됨' : '📋 복사'}
                        </button>
                      </div>
                      <p className="font-black text-gray-900 text-sm">{sections.제목목록[index]}</p>
                    </div>
                  );
                }
                if (type === '내용' && sections.내용목록?.[index]) {
                  const contentKey = `내용-${index}`;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[9px] font-black text-gray-400 uppercase">내용 {index + 1}</p>
                        <button type="button" onClick={() => copyText(sections.내용목록![index], contentKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                          {copiedSection === contentKey ? '✓ 복사됨' : '📋 복사'}
                        </button>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed">{sections.내용목록[index]}</p>
                    </div>
                  );
                }
                if (type === '이미지') {
                  const sec = sections.이미지섹션목록?.[index];
                  if (!sec) return null;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-[10px] font-black text-gray-400 uppercase mb-2">이미지 {index + 1}</p>
                      {sec.text && <p className="text-gray-800 whitespace-pre-wrap text-sm mb-2">{sec.text}</p>}
                      {sec.images && sec.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {sec.images.map((src, imgIdx) => (
                            <div key={imgIdx} className="relative">
                              <img src={src} alt={`참고 ${imgIdx + 1}`} className="max-h-32 rounded-lg object-contain border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(src)} />
                              {meSelected && <button type="button" onClick={() => downloadMedia(src, `이미지${index + 1}_${imgIdx + 1}.png`)} className="absolute bottom-1 right-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                if (type === '작업안내') {
                  const text = sections.작업안내목록?.[index];
                  if (!text) return null;
                  const guideKey = `작업안내-${index}`;
                  return (
                    <div key={`${type}-${index}`} className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase">작업안내</p>
                        <button type="button" onClick={() => copyText(text, guideKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                          {copiedSection === guideKey ? '✓ 복사됨' : '📋 복사'}
                        </button>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap text-sm">{text}</p>
                    </div>
                  );
                }
                return null;
              });
            }
            return (
              <>
                {/* 작업세트목록 (링크 + 게시글 + 링크확인) */}
                {sections.작업세트목록 && sections.작업세트목록.length > 0 && (
                  <div className="space-y-4">
                    {sections.작업세트목록.map((ws, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border border-emerald-200 space-y-3">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">세트 {i + 1}</p>
                        {ws.링크 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">🔗 링크</p>
                            <a href={ws.링크} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline break-all text-sm">{ws.링크}</a>
                          </div>
                        )}
                        {ws.제목 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">📝 게시글 제목</p>
                            <p className="font-black text-gray-800">{ws.제목}</p>
                          </div>
                        )}
                        {ws.내용 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">📄 게시글 내용</p>
                            <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">{ws.내용}</p>
                          </div>
                        )}
                        {ws.링크확인 && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">✅ 링크확인</p>
                            <p className="text-gray-700 text-sm">{ws.링크확인}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {sections.게시글목록 && sections.게시글목록.length > 0 && !sections.작업세트목록?.length && (
                  <div className="space-y-2">
                    {sections.게시글목록.map((block, i) => {
                      const bText = [block.제목, block.내용].filter(Boolean).join('\n\n');
                      const bKey = `fb-게시글-${i}`;
                      return (
                        <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-black text-gray-400 uppercase">게시글 {i + 1}</p>
                            <button type="button" onClick={() => copyText(bText, bKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                              {copiedSection === bKey ? '✓ 복사됨' : '📋 복사'}
                            </button>
                          </div>
                          {block.제목 && <p className="font-black text-gray-900 text-sm leading-snug break-words">{block.제목}</p>}
                          {block.내용 && <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed break-words">{block.내용}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {sections.댓글목록 && sections.댓글목록.length > 0 && (
                  <div className="space-y-2">
                    {sections.댓글목록.map((text, i) => {
                      const cKey = `fb-댓글-${i}`;
                      return (
                        <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-black text-gray-400 uppercase">댓글 {i + 1}</p>
                            <button type="button" onClick={() => copyText(text, cKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                              {copiedSection === cKey ? '✓ 복사됨' : '📋 복사'}
                            </button>
                          </div>
                          <p className="text-gray-800 whitespace-pre-wrap text-xs break-words">{text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {sections.제목목록 && sections.제목목록.length > 0 && (
                  <div className="space-y-2">
                    {sections.제목목록.map((text, i) => {
                      const tKey = `fb-제목-${i}`;
                      return (
                        <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[9px] font-black text-gray-400 uppercase">제목 {i + 1}</p>
                            <button type="button" onClick={() => copyText(text, tKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                              {copiedSection === tKey ? '✓ 복사됨' : '📋 복사'}
                            </button>
                          </div>
                          <p className="font-black text-gray-900 text-sm break-words">{text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {sections.내용목록 && sections.내용목록.length > 0 && (
                  <div className="space-y-2">
                    {sections.내용목록.map((text, i) => {
                      const nKey = `fb-내용-${i}`;
                      return (
                        <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[9px] font-black text-gray-400 uppercase">내용 {i + 1}</p>
                            <button type="button" onClick={() => copyText(text, nKey)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                              {copiedSection === nKey ? '✓ 복사됨' : '📋 복사'}
                            </button>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed break-words">{text}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {sections.작업링크목록 && sections.작업링크목록.length > 0 && (
                  <div className="space-y-2">
                    {sections.작업링크목록.map((text, i) => {
                      const isUrl = text.startsWith('http://') || text.startsWith('https://');
                      return (
                        <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                          <p className="text-[9px] font-black text-gray-400 uppercase mb-1.5">작업링크 {i + 1}</p>
                          {isUrl ? (
                            <a href={text} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 w-full min-w-0 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 transition-colors">
                              <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              <span className="text-emerald-700 font-bold text-xs truncate min-w-0 flex-1">{text}</span>
                            </a>
                          ) : (
                            <p className="text-gray-800 text-xs break-words">{text}</p>
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
              // 이미지·작업안내는 sectionOrder에 포함된 경우 위에서 이미 렌더링됨 → 스킵
              if (key === '이미지' && sections.이미지섹션목록?.length) return null;
              if (key === '작업안내' && sections.작업안내목록?.length) return null;
              const hasImageList = key === '이미지' && sections.이미지목록?.length;
              const hasImageContent = key === '이미지' && (sections[key] || hasImageList);
              if (key === '이미지' && !hasImageContent) return null;
              if (key === '댓글' && (sections.댓글목록?.length || !sections.댓글)) return null;
              if (key === '작업링크' && (sections.작업링크목록?.length || !sections.작업링크)) return null;
              if (key !== '이미지' && key !== '댓글' && key !== '작업링크' && key !== 'gif' && !sections[key]) return null;
              if (key === 'gif' && !sections.gif) return null;
              return (
                <div key={key} className="bg-white rounded-xl p-3 border border-gray-100 overflow-hidden">
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-1">{key}</p>
                  {key === '이미지' ? (
                    <>
                      {sections.이미지목록 && sections.이미지목록.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {sections.이미지목록.map((src, i) => (
                            <div key={i} className="relative">
                              <img
                                src={src}
                                alt={`참고 ${i + 1}`}
                                className="max-h-32 rounded-lg object-contain border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                                onClick={() => setZoomedImage(src)}
                              />
                              {meSelected && (
                                <button type="button" onClick={() => downloadMedia(src, `이미지_${i + 1}.png`)} className="absolute bottom-1 right-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {sections.이미지?.startsWith('data:') && !sections.이미지목록?.length ? (
                        <div className="relative inline-block">
                          <img src={sections.이미지} alt="참고" className="max-h-40 rounded-lg object-contain border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(sections.이미지!)} />
                          {meSelected && (
                            <button type="button" onClick={() => downloadMedia(sections.이미지!, '이미지.png')} className="absolute bottom-2 right-2 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                          )}
                        </div>
                      ) : sections.이미지 ? (
                        <p className="text-gray-700 text-xs">{sections.이미지}</p>
                      ) : null}
                    </>
                  ) : key === 'gif' && sections.gif?.startsWith('data:') ? (
                    <div className="space-y-2">
                      <img
                        src={sections.gif}
                        alt="GIF 참고"
                        className="max-h-40 rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-90 transition-opacity"
                        onClick={() => setZoomedImage(sections.gif!)}
                      />
                      {meSelected && (
                        <button type="button" onClick={() => downloadMedia(sections.gif!, '참고.gif')} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-black">다운로드</button>
                      )}
                    </div>
                  ) : key === '작업링크' && sections.작업링크 && (sections.작업링크.startsWith('http://') || sections.작업링크.startsWith('https://')) ? (
                    <div className="flex items-center gap-1.5 w-full min-w-0">
                      <a href={sections.작업링크} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 flex-1 min-w-0 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 transition-colors">
                        <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        <span className="text-emerald-700 font-bold text-xs truncate min-w-0 flex-1">{sections.작업링크}</span>
                      </a>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(sections.작업링크!); setCopiedUrl(sections.작업링크!); setTimeout(() => setCopiedUrl(null), 2000); }}
                        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-gray-50 hover:bg-gray-100 border-gray-200">
                        {copiedUrl === sections.작업링크
                          ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        }
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="text-gray-700 text-xs whitespace-pre-wrap break-words flex-1">{sections[key]}</p>
                      <button type="button" onClick={() => copyText(sections[key] as string, `sec-${key}`)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors">
                        {copiedSection === `sec-${key}` ? '✓ 복사됨' : '📋 복사'}
                      </button>
                    </div>
                  )}
                </div>
              );
            }
          )}
            </div>{/* close grid gap-2 md:gap-4 (sections) */}
          </div>{/* close Step 2 box */}
          </>)}

          {/* 화살표 */}
          <div className="flex justify-center py-2">
            <svg className="w-5 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 32">
              <path d="M9 0h2v22H9zM4.5 17.5l5.5 8 5.5-8H4.5z" />
            </svg>
          </div>

          {/* STEP 3 ─ 업로드한 링크 제출하기 */}
          <div className="border-2 border-rose-200 rounded-2xl p-5 md:p-6 bg-rose-50/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">3</div>
              <div>
                <h3 className="font-black text-gray-900">{task.category === '영상제공' ? '촬영 영상 제출하기' : '업로드한 링크 제출하기'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{task.category === '영상제공' ? '촬영한 영상 파일을 선택하고 제출 버튼을 눌러주세요' : '링크를 복사해서 아래에 붙여넣고 제출 버튼을 눌러주세요'}</p>
              </div>
            </div>
            {user ? (() => {
              const me = task.applicants.find((a) => a.userId === user.id);
              if (!me?.selected || task.pointPaid) {
                return (
                  <p className="text-sm text-gray-400 italic">
                    {task.pointPaid ? '✓ 지급 완료된 작업입니다.' : me ? '선정된 후 이 곳에서 제출할 수 있습니다.' : '신청 후 선정되면 이 곳에서 제출할 수 있습니다.'}
                  </p>
                );
              }

              /* ── 영상제공 카테고리: 영상 파일 업로드 ── */
              if (task.category === '영상제공') {
                return (
                  <div className="space-y-3">
                    {me.videoUrl ? (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                        <p className="text-sm font-black text-emerald-700">✅ 영상이 제출되었습니다</p>
                        <a href={me.videoUrl} target="_blank" rel="noopener noreferrer" download
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 underline font-bold">
                          ⬇ 영상 다운로드
                        </a>
                        <p className="text-xs text-gray-400">영상을 다시 제출하려면 아래에서 새 파일을 선택하세요.</p>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-rose-200 cursor-pointer hover:border-rose-400 transition-all bg-rose-50">
                        <span className="text-2xl">🎬</span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-gray-800">{videoFiles[0] ? videoFiles[0].name : '영상 파일 선택'}</p>
                          <p className="text-xs text-gray-400">{videoFiles[0] ? `${(videoFiles[0].size / 1024 / 1024).toFixed(1)} MB` : 'MP4, MOV, AVI 등 지원'}</p>
                        </div>
                        <input type="file" accept="video/*" multiple className="hidden"
                          onChange={(e) => setVideoFiles(Array.from(e.target.files ?? []))} />
                      </label>
                      <button type="button" onClick={handleSubmitVideo}
                        disabled={videoFiles.length === 0 || isUploadingVideo}
                        className="px-6 py-3 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isUploadingVideo ? '업로드 중...' : me.videoUrl ? '영상 재제출' : '영상 제출'}
                      </button>
                    </div>
                  </div>
                );
              }

              /* ── 일반 카테고리: 작업 링크 제출 ── */
              const submitted = me.workLinks?.length ? me.workLinks : (me.workLink ? [me.workLink] : []);
              return (
                <div className="space-y-3">
                  {me.revisionRequest && (
                    <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                      <p className="text-xs font-black text-orange-700 mb-1">수정 요청 사항</p>
                      <p className="text-sm text-orange-800 whitespace-pre-wrap">{me.revisionRequest}</p>
                    </div>
                  )}
                  {submitted.length > 0 && !isEditingWorkLinks ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700 font-bold">제출된 링크:</p>
                      {submitted.map((url, i) => (
                        <p key={i} className="text-sm break-all">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">{url}</a>
                        </p>
                      ))}
                      <button type="button" onClick={() => setIsEditingWorkLinks(true)} className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition-all">수정</button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {workLinks.map((url, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="url"
                              value={url}
                              onChange={(e) => updateWorkLinkInput(idx, e.target.value)}
                              placeholder="https://..."
                              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-rose-200 outline-none"
                            />
                            {workLinks.length > 1 && (
                              <button type="button" onClick={() => removeWorkLinkInput(idx)} className="px-3 py-2 rounded-lg text-red-500 text-sm font-bold hover:bg-red-50">삭제</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={addWorkLinkInput} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">+ 링크 추가</button>
                        <button type="button" onClick={handleSubmitWorkLink} className="px-6 py-3 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all">
                          {me.revisionRequest ? '재승인 요청' : '작업 링크 제출'}
                        </button>
                        {submitted.length > 0 && (
                          <button type="button" onClick={() => setIsEditingWorkLinks(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">취소</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })() : (
              <p className="text-sm text-gray-400 italic">로그인 후 신청 및 선정되면 제출할 수 있습니다.</p>
            )}
          </div>

        </div>}{/* close space-y-0 (3단계 flow) */}

        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
            <span className="text-[10px] font-black text-amber-600 uppercase">작업기간</span>
            <span className="text-gray-800 font-bold">{task.workPeriod.start} ~ {task.workPeriod.end}</span>
          </div>
          {task.workTimeSlot && (
            <div className="inline-flex items-center gap-2 bg-purple-50 rounded-xl px-4 py-3 border border-purple-100">
              <span className="text-[10px] font-black text-purple-600 uppercase">작업시간</span>
              <span className="text-gray-800 font-bold">{task.workTimeSlot}</span>
            </div>
          )}
        </div>

        {task.workTimeSlot && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
            <span className="text-purple-400 text-lg shrink-0">🕐</span>
            <div>
              <p className="font-black text-purple-800 text-sm mb-1">작업 시간 안내 — {task.workTimeSlot}</p>
              <p className="text-sm text-purple-700 leading-relaxed">
                본 작업은 지정된 시간대 내에 완료해 주세요. 시간 약속은 광고주와의 신뢰를 바탕으로 하며,
                <span className="font-black"> 해당 시간 내에 작업이 완료되지 않을 경우 부득이하게 작업 건수에 포함되지 않을 수 있습니다.</span>
              </p>
              <p className="text-xs text-purple-500 mt-1.5">소중한 시간 약속을 지켜 주셔서 감사합니다 🙏</p>
            </div>
          </div>
        )}

        {/* 신청 댓글 — 영상제공 외 카테고리만 표시 */}
        {task.category !== '영상제공' && (
        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-lg font-black text-gray-800 mb-3">신청 댓글</h3>
          {task.applicants.length === 0 ? (
            <p className="text-gray-500 py-3">아직 신청한 사람이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {task.applicants.map((a, idx) => {
                const isMe = user?.id === a.userId;
                const displayName = isMe
                  ? (a.nickname || '나')
                  : `신청자 ${idx + 1}`;
                return (
                  <li key={a.userId} className="flex items-start gap-2 py-2 px-3 rounded-xl bg-gray-50 border border-gray-100">
                    <span className={`font-black shrink-0 ${isMe ? 'text-emerald-700' : 'text-gray-800'}`}>{displayName}</span>
                    <span className="text-gray-600 text-sm">{a.comment || '신청합니다'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}

        {/* 신청하기 — 영상제공 외, 미신청자 전용 */}
        {task.category !== '영상제공' && user && !task.pointPaid && !isApplicant && (
          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm font-bold text-gray-700 mb-2">내 신청 댓글 (선택)</p>
            <input
              type="text"
              value={applyComment}
              onChange={(e) => setApplyComment(e.target.value)}
              placeholder="신청합니다"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-200 outline-none mb-3"
            />
            <p className="text-sm font-bold text-gray-700 mb-1">네이버 아이디 <span className="text-red-500">*</span></p>
            <p className="text-xs text-gray-400 mb-2">게시글을 작성할 네이버 아이디를 입력해 주세요. 운영자가 게시글 확인 시 사용합니다.</p>
            <input
              type="text"
              value={applyCafeId}
              onChange={(e) => setApplyCafeId(e.target.value)}
              placeholder="예) naver_id123"
              className="w-full px-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-200 outline-none mb-3 bg-emerald-50/40"
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
              <label className="flex items-center gap-3 cursor-pointer border-b border-amber-200 pb-3">
                <input
                  type="checkbox"
                  checked={agree1 && agree2 && agree3 && agree4}
                  ref={(el) => { if (el) el.indeterminate = (agree1 || agree2 || agree3 || agree4) && !(agree1 && agree2 && agree3 && agree4); }}
                  onChange={(e) => { setAgree1(e.target.checked); setAgree2(e.target.checked); setAgree3(e.target.checked); setAgree4(e.target.checked); }}
                  className="mt-0.5 rounded"
                />
                <span className="text-sm font-black text-amber-800">전체 동의</span>
              </label>
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
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agree4} onChange={(e) => setAgree4(e.target.checked)} className="mt-1 rounded" />
                <span className="text-sm">(필수) 본 작업에서 알게 된 광고주 정보, 작업 내용, 작업 결과물은 제3자에게 공개·누설·제공할 수 없습니다.<br />비밀유지 의무 위반 시 민·형사상 책임을 질 수 있음에 동의합니다.</span>
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
        )}
        {/* 신청 완료 상태 메시지 — 영상제공 외 */}
        {task.category !== '영상제공' && user && isApplicant && !task.pointPaid && (() => {
          const me = task.applicants.find((a) => a.userId === user?.id);
          if (!me?.selected) {
            return (
              <div className="border-t border-gray-100 pt-6">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xl">⏳</div>
                  <div>
                    <p className="font-black text-amber-800 text-base mb-1">신청이 완료되었습니다</p>
                    <p className="text-sm font-bold text-amber-700">현재 선정 진행 중이니 잠시 기다려 주세요.</p>
                    <p className="text-xs text-amber-500 mt-1">선정 결과는 마이페이지 알림에서 확인할 수 있습니다.</p>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="border-t border-gray-100 pt-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 text-xl">✅</div>
                <div>
                  <p className="font-black text-emerald-800 text-base mb-1">선정되셨습니다!</p>
                  <p className="text-sm font-bold text-emerald-700">위 Step 3에서 링크를 제출해 주세요.</p>
                  <p className="text-xs text-emerald-600 mt-1">운영자와 광고주 확인 후 수익통장에 적립됩니다.</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 운영자 전용 목록 */}
        {user && isOperator && (
          <div className="border-t border-gray-100 pt-6">
            {task.category === '영상제공' ? (
              <>
                <h3 className="text-lg font-black text-gray-800 mb-1">제출된 영상 목록 (운영자 전용)</h3>
                <p className="text-sm text-gray-500 mb-1">영상을 확인하고 포인트를 지급하세요.</p>
                <p className="text-xs text-blue-600 font-bold mb-3">📅 {activeDate} 날짜 제출분만 표시됩니다.</p>
                {(task.videoUploads ?? []).filter((v) => v.date === activeDate).length === 0 ? (
                  <p className="text-gray-500 py-4">해당 날짜({activeDate})에 제출된 영상이 없습니다.</p>
                ) : (
                  <ul className="space-y-4">
                    {(() => {
                      const dateVideos = (task.videoUploads ?? []).filter((v) => v.date === activeDate);
                      const userMap = new Map<string, typeof dateVideos>();
                      for (const v of dateVideos) {
                        if (!userMap.has(v.userId)) userMap.set(v.userId, []);
                        userMap.get(v.userId)!.push(v);
                      }
                      return [...userMap.entries()].map(([uid, videos]) => {
                        const nickname = videos[0].nickname;
                        const isPaid = videos.some((v) => v.status === 'paid');
                        const hasPending = videos.some((v) => !v.status || v.status === 'pending');
                        return (
                          <li key={uid} className="p-4 rounded-xl border bg-gray-50 border-gray-100">
                            {/* 사용자 헤더 + 지급 버튼 */}
                            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-black text-gray-800">{nickname}</p>
                                  {isPaid ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">✅ 지급완료</span>
                                  ) : hasPending ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">🔍 검토중</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-600">❌ 전부 반려됨</span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">영상 {videos.length}개 제출 · 지급액 {task.reward.toLocaleString()}원 (1일 1회)</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                {!isPaid && hasPending && (
                                  <button type="button"
                                    onClick={() => handlePayVideoUploader(uid, nickname, activeDate)}
                                    className="px-4 py-2 rounded-lg text-sm font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
                                    포인트 지급 ({task.reward.toLocaleString()}원)
                                  </button>
                                )}
                                {isPaid && (
                                  <span className="px-3 py-2 rounded-lg text-xs font-black bg-gray-100 text-gray-500">✓ {task.reward.toLocaleString()}원 지급 완료</span>
                                )}
                              </div>
                            </div>
                            {/* 영상 목록 */}
                            <div className="space-y-2 border-t border-gray-200 pt-3">
                              {videos.map((v) => {
                                const isRejected = v.status === 'rejected';
                                const vPaid = v.status === 'paid';
                                return (
                                  <div key={v.id} className={`flex items-start justify-between gap-3 p-2.5 rounded-lg ${isRejected ? 'bg-red-50 border border-red-100' : vPaid ? 'bg-emerald-50 border border-emerald-100' : 'bg-white border border-gray-100'}`}>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-gray-700 truncate">🎬 {v.fileName}</p>
                                      {(v.location || v.storeName) && (
                                        <p className="text-xs text-gray-500">📍 {[v.location, v.storeName].filter(Boolean).join(' · ')}</p>
                                      )}
                                      <p className="text-[10px] text-gray-400">{v.uploadedAt.slice(11, 16)}</p>
                                      {isRejected && (
                                        <div>
                                          <span className="text-[10px] font-black text-red-500">❌ 반려됨</span>
                                          {v.rejectionReason && <p className="text-[10px] text-red-400 mt-0.5">사유: {v.rejectionReason}</p>}
                                        </div>
                                      )}
                                      {vPaid && <span className="text-[10px] font-black text-emerald-600">✅ 지급됨</span>}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" download={v.fileName}
                                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-all">
                                        ⬇ 다운로드
                                      </a>
                                      {!isRejected && !vPaid && (
                                        <button type="button" onClick={() => handleRejectVideo(v.id)}
                                          className="px-3 py-1.5 rounded-lg text-xs font-black bg-red-100 text-red-600 hover:bg-red-200 transition-all">
                                          반려
                                        </button>
                                      )}
                                      {isRejected && (
                                        <button type="button" onClick={() => handleUnrejectVideo(v.id)}
                                          className="px-3 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                                          반려 취소
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-gray-800 mb-3">프리랜서 신청자 목록 (운영자 전용)</h3>
                <p className="text-sm text-gray-500 mb-3">링크 확인 후 포인트 지급. 일반 회원은 이 목록·선정·지급 결과를 볼 수 없습니다.</p>
                {task.applicants.length === 0 ? (
                  <p className="text-gray-500 py-4">아직 신청자가 없습니다.</p>
                ) : (
                  <ul className="space-y-4">
                    {task.applicants.map((a) => {
                      const links = a.workLinks?.length ? a.workLinks : (a.workLink ? [a.workLink] : []);
                      const paid = task.paidUserIds?.includes(a.userId);
                      const memberProfile = members.find((m) => m.id === a.userId);
                      const warnings = memberProfile?.violationCount ?? 0;
                      const isBanned = warnings >= 5;
                      return (
                        <li key={a.userId} className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-3">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-black text-gray-800">{a.nickname}</p>
                                {warnings === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-white">✅ 인증회원</span>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${isBanned ? 'bg-red-600 text-white' : warnings >= 3 ? 'bg-orange-500 text-white' : 'bg-yellow-400 text-gray-900'}`}>
                                    경고 {warnings}회{isBanned ? ' 🚫 선정 불가' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{a.comment || '신청합니다'}</p>
                              {a.cafeId && <p className="text-sm text-emerald-700 font-bold">네이버 아이디: {a.cafeId}</p>}
                              {a.contact && <p className="text-sm text-blue-600 font-bold">연락처: {a.contact}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSelect(a.userId)}
                                disabled={!!a.selected || isBanned}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${a.selected || isBanned ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700'}`}
                                title={isBanned ? '경고 5회로 선정이 불가합니다' : undefined}
                              >
                                선정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeselect(a.userId)}
                                disabled={!a.selected}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${!a.selected ? 'bg-amber-50 text-amber-300 cursor-not-allowed' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                              >
                                선정취소
                              </button>
                              {a.selected && (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white whitespace-nowrap">선정됨</span>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate('/chat', { state: { targetUser: { id: a.userId, nickname: a.nickname, profileImage: '' } } })}
                                className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all whitespace-nowrap"
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
                                <div className="flex gap-1.5 flex-wrap items-center mt-1">
                                  <button type="button" onClick={() => setRevisionModal({ userId: a.userId, nickname: a.nickname, text: a.revisionRequest || '' })} className="px-3 py-1.5 rounded-lg text-xs font-black bg-orange-100 text-orange-700 hover:bg-orange-200 whitespace-nowrap">
                                    수정요청
                                  </button>
                                  {a.deliveryAt && a.autoApproveAt ? (
                                    new Date(a.autoApproveAt) > new Date() ? (
                                      <span className="text-blue-600 font-bold text-xs">
                                        자동지급 예정 ({new Date(a.autoApproveAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })})
                                      </span>
                                    ) : (
                                      <span className="text-amber-600 font-bold text-xs">자동 지급 처리 중...</span>
                                    )
                                  ) : (
                                    <button type="button" onClick={() => handleApprovePass(a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                                      통과
                                    </button>
                                  )}
                                  <button type="button" onClick={() => handlePayPoints(a.userId)} className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap">
                                    즉시지급
                                  </button>
                                </div>
                              )}
                              {paid && (
                                <span className="text-gray-500 font-bold text-xs">
                                  ✓ 지급 완료{a.paidAt ? ` (적립일: ${new Date(a.paidAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })})` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {task.applicants.length > 0 && (
                  <p className="text-sm text-gray-500 mt-3">링크를 클릭해 확인 후, 수정요청이 필요하면 수정요청 버튼으로 알림을 보내거나 포인트 지급해 주세요.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* 운영자 전용 원고 디버그 패널 */}
        {isOperator && (
          <details className="border border-dashed border-gray-300 rounded-xl p-4">
            <summary className="text-xs font-black text-gray-400 cursor-pointer select-none">🔧 관리자: 원고 데이터 확인 (클릭해서 펼치기)</summary>
            <div className="mt-3">
              {Object.keys(sections).length === 0 ? (
                <p className="text-red-600 font-black text-sm">⚠️ DB에 원고 데이터가 없습니다. 수정 버튼을 눌러 원고를 다시 입력해주세요.</p>
              ) : (
                <pre className="text-[10px] text-gray-600 overflow-auto max-h-60 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap break-all">
                  {JSON.stringify(sections, null, 2)}
                </pre>
              )}
            </div>
          </details>
        )}

        {task.pointPaid && (
          <p className="text-center text-gray-500 font-bold py-4">이 작업은 마감되었습니다.</p>
        )}

        {!user && (
          <p className="text-center text-gray-500 font-bold">로그인 후 신청할 수 있습니다.</p>
        )}
      </div>

      {showDailyLimitModal && task && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDailyLimitModal(false)}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-5xl">⏰</p>
            <h4 className="font-black text-gray-900 text-xl">오늘 제출 마감</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              오늘 최대 <span className="font-black text-rose-600">{task.dailyLimit}명</span>이 이미 영상을 제출했습니다.<br />
              내일 다시 방문하여 제출해 주세요!
            </p>
            <button onClick={() => setShowDailyLimitModal(false)} className="w-full py-3 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-600 transition-all">
              확인
            </button>
          </div>
        </div>
      )}

      {rejectVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl space-y-5">
            <h4 className="font-black text-gray-900 text-lg">영상 반려</h4>
            <p className="text-sm text-gray-600 truncate">🎬 {rejectVideoModal.fileName}</p>
            <div>
              <label className="text-sm font-black text-gray-700 block mb-2">반려 사유 <span className="text-gray-400 font-normal">(선택사항)</span></label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="예: 영상이 너무 짧습니다 / 매장이 다릅니다 / 화질이 불량합니다"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-200 outline-none text-sm resize-none"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">입력하면 회원 알림과 마이페이지에 사유가 표시됩니다.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRejectVideoModal(null); setRejectReason(''); }} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black hover:bg-gray-200">
                취소
              </button>
              <button onClick={handleRejectVideoConfirm} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-black hover:bg-red-600">
                반려 처리
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

      {/* 신청 완료 후 경고 안내 모달 */}
      {showApplyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center space-y-5">
            <p className="text-4xl">⚠️</p>
            <h4 className="font-black text-gray-900 text-lg">신청이 완료되었습니다</h4>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl px-5 py-4 text-left space-y-1">
              <p className="text-sm font-black text-red-700 leading-relaxed">
                시간약속을 어기거나 노쇼 하게되면<br />
                추후 신청 불가, 사이트 내 수익출금 불가입니다.
              </p>
              <p className="text-xs font-black text-red-500">(경고 3회)</p>
            </div>
            <button
              type="button"
              onClick={() => setShowApplyWarning(false)}
              className="w-full py-3 rounded-xl bg-gray-900 text-white font-black text-base hover:bg-red-600 transition-all"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 이미지 원본 크게 보기 팝업 */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 overflow-y-auto"
          onClick={() => setZoomedImage(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setZoomedImage(null)}
          aria-label="닫기"
        >
          <div className="sticky top-4 z-10 flex justify-end gap-2 px-4 float-right" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                const src = zoomedImagePng || zoomedImage;
                if (!src) return;
                const a = document.createElement('a');
                a.href = src;
                a.download = '이미지.png';
                a.click();
              }}
              className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 shadow-xl"
            >
              ⬇ .png 저장
            </button>
            <button type="button" onClick={() => setZoomedImage(null)} className="w-12 h-12 rounded-full bg-white/95 text-gray-800 text-2xl font-black hover:bg-white shadow-xl leading-none">×</button>
          </div>
          <div className="flex justify-center p-6 pt-2 min-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomedImagePng || zoomedImage}
              alt="이미지 크게 보기"
              className="block w-auto h-auto max-w-[95vw] rounded-lg shadow-2xl self-start"
              style={{ imageRendering: 'crisp-edges' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PartTimeTaskDetail;
