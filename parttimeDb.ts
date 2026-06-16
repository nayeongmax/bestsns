/**
 * 누구나알바 / 프리랜서 워크페이스 Supabase DB 연동
 * - parttime_tasks, parttime_job_requests, freelancer_balances, freelancer_earnings_history, freelancer_withdraw_requests, parttime_task_completed_checks
 */
import { supabase } from './supabase';
import type {
  PartTimeTask,
  PartTimeJobRequest,
  FreelancerEarningEntry,
  PartTimeApplicant,
  PartTimeTaskSections,
} from '@/types';
import type { FreelancerWithdrawRequest } from '@/constants';
import { FREELANCER_FEE_RATE } from '@/constants';

// ─── parttime_tasks ─────────────────────────────────────────────────────
/** sections JSON이 너무 크면 DB/전송 한계로 실패할 수 있어, 용량 제한 적용 */
const MAX_SECTIONS_BYTES = 700 * 1024; // 약 700KB
const MAX_SINGLE_STRING_BYTES = 80 * 1024; // 항목당 약 80KB

function shrinkSections(sections: PartTimeTaskSections): PartTimeTaskSections {
  const str = JSON.stringify(sections);
  if (str.length <= MAX_SECTIONS_BYTES) return sections;
  const out: PartTimeTaskSections = {};
  for (const [key, value] of Object.entries(sections)) {
    if (value == null) { out[key as keyof PartTimeTaskSections] = value; continue; }
    if (typeof value === 'string') {
      out[key as keyof PartTimeTaskSections] = value.length <= MAX_SINGLE_STRING_BYTES
        ? value
        : value.slice(0, MAX_SINGLE_STRING_BYTES) + '...[용량 제한으로 잘림]';
      continue;
    }
    if (Array.isArray(value)) {
      const arr = value.map((item) =>
        typeof item === 'string' && item.length > MAX_SINGLE_STRING_BYTES
          ? item.slice(0, MAX_SINGLE_STRING_BYTES) + '...[잘림]'
          : item
      );
      (out as Record<string, unknown>)[key] = arr;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      (out as Record<string, unknown>)[key] = value;
      continue;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

function taskToRow(t: PartTimeTask): Record<string, unknown> {
  const sections = t.sections ?? {};
  const sectionsSafe = shrinkSections(sections);
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    category: t.category,
    reward: t.reward ?? 0,
    max_applicants: t.maxApplicants ?? null,
    sections: sectionsSafe,
    application_period_start: t.applicationPeriod?.start ?? null,
    application_period_end: t.applicationPeriod?.end ?? null,
    work_period_start: t.workPeriod?.start ?? null,
    work_period_end: t.workPeriod?.end ?? null,
    created_at: t.createdAt ?? new Date().toISOString(),
    created_by: t.createdBy ?? null,
    applicants: (t.applicants ?? []) as unknown[],
    point_paid: t.pointPaid ?? false,
    paid_user_ids: (t.paidUserIds ?? []) as unknown[],
    applicant_user_id: t.applicantUserId ?? null,
    job_request_id: t.jobRequestId ?? null,
    project_no: t.projectNo ?? null,
    sent_to_advertiser_at: t.sentToAdvertiserAt ?? null,
    signup_link: t.signupLink ?? null,
    post_visibility: t.postVisibility ?? null,
    work_time_slot: t.workTimeSlot ?? null,
    daily_limit: t.dailyLimit ?? null,
    video_uploads: (t.videoUploads ?? []) as unknown[],
  };
}

function rowToTask(row: Record<string, unknown>): PartTimeTask {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description != null ? String(row.description) : '',
    category: String(row.category),
    reward: Number(row.reward ?? 0),
    maxApplicants: row.max_applicants != null ? Number(row.max_applicants) : undefined,
    sections: (row.sections as PartTimeTaskSections) ?? {},
    applicationPeriod: {
      start: String(row.application_period_start ?? ''),
      end: String(row.application_period_end ?? ''),
    },
    workPeriod: {
      start: String(row.work_period_start ?? ''),
      end: String(row.work_period_end ?? ''),
    },
    createdAt: row.created_at != null ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
    createdBy: row.created_by != null ? String(row.created_by) : undefined,
    applicants: (Array.isArray(row.applicants) ? row.applicants : []).map((a: Record<string, unknown>) => ({
      ...a,
      selected: Boolean((a as { selected?: unknown })?.selected),
    })) as PartTimeApplicant[],
    pointPaid: Boolean(row.point_paid),
    paidUserIds: Array.isArray(row.paid_user_ids) ? (row.paid_user_ids as string[]) : [],
    applicantUserId: row.applicant_user_id != null ? String(row.applicant_user_id) : undefined,
    jobRequestId: row.job_request_id != null ? String(row.job_request_id) : undefined,
    projectNo: row.project_no != null ? String(row.project_no) : undefined,
    sentToAdvertiserAt: row.sent_to_advertiser_at != null ? new Date(row.sent_to_advertiser_at as string).toISOString() : undefined,
    signupLink: row.signup_link != null ? String(row.signup_link) : undefined,
    postVisibility: row.post_visibility != null ? (String(row.post_visibility) as '전체공개' | '멤버공개') : undefined,
    workTimeSlot: row.work_time_slot != null ? String(row.work_time_slot) : undefined,
    dailyLimit: row.daily_limit != null ? Number(row.daily_limit) : undefined,
    videoUploads: Array.isArray(row.video_uploads) ? (row.video_uploads as import('@/types').VideoUpload[]) : [],
  };
}

export async function fetchPartTimeTasks(): Promise<PartTimeTask[]> {
  const { data, error } = await supabase.from('parttime_tasks').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToTask(row as Record<string, unknown>));
}

/** 목록 페이지용 경량 조회 — sections(이미지 등 대용량 데이터) 제외하여 빠른 로드 */
export async function fetchPartTimeTasksList(): Promise<PartTimeTask[]> {
  const cols = 'id,title,description,category,reward,max_applicants,application_period_start,application_period_end,work_period_start,work_period_end,applicants,point_paid,paid_user_ids,applicant_user_id,job_request_id,project_no,created_at,created_by,sent_to_advertiser_at,signup_link,post_visibility,work_time_slot,daily_limit,video_uploads';
  const { data, error } = await supabase.from('parttime_tasks').select(cols).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToTask(row as Record<string, unknown>));
}

export async function upsertPartTimeTask(task: PartTimeTask): Promise<void> {
  const row = taskToRow(task);
  const { error } = await supabase.from('parttime_tasks').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertPartTimeTasks(tasks: PartTimeTask[]): Promise<void> {
  if (tasks.length === 0) return;
  const rows = tasks.map((t) => taskToRow(t));
  const { error } = await supabase.from('parttime_tasks').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function deletePartTimeTask(id: string): Promise<void> {
  const { error } = await supabase.from('parttime_tasks').delete().eq('id', id);
  if (error) throw error;
}

// ─── parttime_job_requests ──────────────────────────────────────────────
function jobRequestToRow(r: PartTimeJobRequest): Record<string, unknown> {
  return {
    id: r.id,
    applicant_user_id: r.applicantUserId ?? null,
    title: r.title,
    work_content: r.workContent ?? null,
    platform_links: r.platformLinks ?? null,
    platform_link: r.platformLink ?? null,
    ad_amount: r.adAmount ?? 0,
    unit_price: r.unitPrice ?? null,
    quantity: r.quantity ?? null,
    fee: r.fee ?? 0,
    work_period_start: r.workPeriodStart ?? null,
    work_period_end: r.workPeriodEnd ?? null,
    contact: r.contact ?? null,
    status: r.status ?? 'pending_review',
    paid: r.paid ?? false,
    receipt_url: r.receiptUrl ?? null,
    reject_reason: r.rejectReason ?? null,
    example_images: (r.exampleImages ?? null) as unknown,
    operator_estimate: r.operatorEstimate ?? null,
    created_at: r.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function rowToJobRequest(row: Record<string, unknown>): PartTimeJobRequest {
  return {
    id: String(row.id),
    title: String(row.title),
    workContent: row.work_content != null ? String(row.work_content) : '',
    platformLink: row.platform_link != null ? String(row.platform_link) : '',
    platformLinks: Array.isArray(row.platform_links) ? (row.platform_links as string[]) : undefined,
    contact: row.contact != null ? String(row.contact) : '',
    workPeriodStart: String(row.work_period_start ?? ''),
    workPeriodEnd: String(row.work_period_end ?? ''),
    adAmount: Number(row.ad_amount ?? 0),
    unitPrice: row.unit_price != null ? Number(row.unit_price) : undefined,
    quantity: row.quantity != null ? Number(row.quantity) : undefined,
    fee: Number(row.fee ?? 0),
    applicantUserId: row.applicant_user_id != null ? String(row.applicant_user_id) : undefined,
    status: (row.status as PartTimeJobRequest['status']) ?? 'pending_review',
    rejectReason: row.reject_reason != null ? String(row.reject_reason) : undefined,
    paid: Boolean(row.paid),
    receiptUrl: row.receipt_url != null ? String(row.receipt_url) : undefined,
    exampleImages: Array.isArray(row.example_images) ? (row.example_images as string[]) : undefined,
    operatorEstimate: row.operator_estimate as PartTimeJobRequest['operatorEstimate'] | undefined,
    createdAt: row.created_at != null ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
  };
}

export async function fetchPartTimeJobRequests(): Promise<PartTimeJobRequest[]> {
  const { data, error } = await supabase.from('parttime_job_requests').select('*').neq('is_deleted', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToJobRequest(row as Record<string, unknown>));
}

export async function upsertPartTimeJobRequest(req: PartTimeJobRequest): Promise<void> {
  const row = jobRequestToRow(req);
  const { error } = await supabase.from('parttime_job_requests').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function upsertPartTimeJobRequests(requests: PartTimeJobRequest[]): Promise<void> {
  if (requests.length === 0) return;
  const rows = requests.map((r) => jobRequestToRow(r));
  const { error } = await supabase.from('parttime_job_requests').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function deletePartTimeJobRequest(id: string): Promise<void> {
  const { error } = await supabase.from('parttime_job_requests').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}

// ─── freelancer_balances ────────────────────────────────────────────────
export async function fetchFreelancerBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from('freelancer_balances').select('balance').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.balance != null ? Number(data.balance) : 0;
}

export async function setFreelancerBalance(userId: string, balance: number): Promise<void> {
  const value = Math.max(0, Math.round(balance));
  const { error } = await supabase.from('freelancer_balances').upsert(
    { user_id: userId, balance: value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

// ─── freelancer_earnings_history ────────────────────────────────────────
function rowToEarningEntry(row: Record<string, unknown>): FreelancerEarningEntry {
  const at = row.created_at != null ? new Date(row.created_at as string).toISOString() : new Date().toISOString();
  return {
    id: String(row.id),
    type: (row.type as 'task' | 'withdraw') ?? 'task',
    amount: Number(row.amount ?? 0),
    label: row.label != null ? String(row.label) : '',
    at,
    taskId: row.task_id != null ? String(row.task_id) : undefined,
  };
}

export async function fetchFreelancerHistory(userId: string): Promise<FreelancerEarningEntry[]> {
  const { data, error } = await supabase
    .from('freelancer_earnings_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => rowToEarningEntry(row as Record<string, unknown>));
}

export async function addFreelancerEarningToDb(
  userId: string,
  id: string,
  type: 'task' | 'withdraw',
  amount: number,
  label: string,
  taskId?: string
): Promise<void> {
  const { error } = await supabase.from('freelancer_earnings_history').insert({
    id,
    user_id: userId,
    type,
    amount,
    label: label || null,
    task_id: taskId ?? null,
  });
  if (error) throw error;
}

// ─── freelancer_withdraw_requests ────────────────────────────────────────
function rowToWithdrawRequest(row: Record<string, unknown>): FreelancerWithdrawRequest {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    nickname: String(row.nickname),
    amount: Number(row.amount ?? 0),
    bankName: String(row.bank_name),
    accountNo: String(row.account_no),
    ownerName: String(row.owner_name),
    requestedAt: row.requested_at != null ? new Date(row.requested_at as string).toISOString() : new Date().toISOString(),
    status: (row.status as 'pending' | 'completed' | 'failed') ?? 'pending',
  };
}

export async function fetchFreelancerWithdrawRequests(): Promise<FreelancerWithdrawRequest[]> {
  const { data, error } = await supabase.from('freelancer_withdraw_requests').select('*').order('requested_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => rowToWithdrawRequest(row as Record<string, unknown>));
}

export async function addFreelancerWithdrawRequestToDb(req: Omit<FreelancerWithdrawRequest, 'id' | 'requestedAt' | 'status'>): Promise<string> {
  const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('freelancer_withdraw_requests').insert({
    id,
    user_id: req.userId,
    nickname: req.nickname,
    amount: req.amount,
    bank_name: req.bankName,
    account_no: req.accountNo,
    owner_name: req.ownerName,
    status: 'pending',
  });
  if (error) throw error;
  return id;
}

export async function updateFreelancerWithdrawRequestStatusToDb(id: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
  const { error } = await supabase
    .from('freelancer_withdraw_requests')
    .update({ status, completed_at: status !== 'pending' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

/** 출금 실패 시 수익통장 환급 */
export async function refundFreelancerWithdrawalInDb(userId: string, amount: number, label: string): Promise<void> {
  const cur = await fetchFreelancerBalance(userId);
  await setFreelancerBalance(userId, cur + Math.max(0, amount));
  const id = `refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await addFreelancerEarningToDb(userId, id, 'task', amount, label);
}

/** 출금 신청: 신청 기록 먼저 저장 → 잔액 차감 (순서 중요: 잔액 차감 전에 기록 없어지는 버그 방지) */
export async function withdrawFreelancerEarningsInDb(
  userId: string,
  amount: number,
  req: { nickname: string; bankName: string; accountNo: string; ownerName: string }
): Promise<{ success: boolean; newBalance: number }> {
  const cur = await fetchFreelancerBalance(userId);
  const minWithdraw = 5000; // MIN_WITHDRAW_FREELANCER
  if (amount < minWithdraw || amount > cur) {
    return { success: false, newBalance: cur };
  }

  // 1. 출금 신청 기록 먼저 저장 (이 단계에서 실패하면 잔액은 그대로)
  const reqId = await addFreelancerWithdrawRequestToDb({
    userId, nickname: req.nickname, amount,
    bankName: req.bankName, accountNo: req.accountNo, ownerName: req.ownerName,
  });

  // 2. 잔액 차감 + 내역 기록 (실패 시 출금 신청 취소 후 throw)
  const next = cur - amount;
  try {
    await setFreelancerBalance(userId, next);
    const entryId = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await addFreelancerEarningToDb(userId, entryId, 'withdraw', -amount, '출금 신청');
  } catch (e) {
    await supabase.from('freelancer_withdraw_requests').delete().eq('id', reqId);
    throw e;
  }

  return { success: true, newBalance: next };
}

// ─── parttime_task_completed_checks (캘린더 완료 체크) ─────────────────────
export async function fetchPartTimeCompletedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('parttime_task_completed_checks').select('task_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.task_id)));
}

export async function addPartTimeCompletedCheck(userId: string, taskId: string): Promise<void> {
  const { error } = await supabase.from('parttime_task_completed_checks').upsert(
    { user_id: userId, task_id: taskId },
    { onConflict: 'user_id,task_id' }
  );
  if (error) throw error;
}

export async function removePartTimeCompletedCheck(userId: string, taskId: string): Promise<void> {
  const { error } = await supabase.from('parttime_task_completed_checks').delete().eq('user_id', userId).eq('task_id', taskId);
  if (error) throw error;
}

// ─── 자동 승인 (통과 후 4일 경과 시 수익통장 지급) - DB 버전 ────────────────────────
/** 4일 경과 자동 승인: autoApproveAt 지난 선정자에게 대금 지급. DB에서 tasks/balance/history 반영 */
export async function processAutoApprovalsInDb(): Promise<boolean> {
  const tasks = await fetchPartTimeTasks();
  const now = Date.now();
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  let changed = false;
  const next: PartTimeTask[] = [];

  for (const t of tasks) {
    const selectedWithLink = t.applicants.filter((a) => a.selected && ((a.workLinks?.length ?? 0) > 0 || !!(a.workLink || '').trim()));
    if (selectedWithLink.length === 0) {
      next.push(t);
      continue;
    }
    const updated = { ...t, paidUserIds: [...(t.paidUserIds ?? [])] };
    for (const a of selectedWithLink) {
      if (updated.paidUserIds?.includes(a.userId)) continue;
      let shouldPay = false;
      if (a.autoApproveAt) {
        if (new Date(a.autoApproveAt).getTime() <= now) shouldPay = true;
      } else if (t.applicantUserId && a.workLinkSubmittedAt) {
        if (now >= new Date(a.workLinkSubmittedAt).getTime() + fourDaysMs) shouldPay = true;
      }
      if (shouldPay) {
        const grossAmount = t.reward;
        const netAmount = Math.round(grossAmount * (1 - FREELANCER_FEE_RATE));
        const curBalance = await fetchFreelancerBalance(a.userId);
        await setFreelancerBalance(a.userId, curBalance + Math.max(0, netAmount));
        const entryId = `earn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await addFreelancerEarningToDb(a.userId, entryId, 'task', grossAmount, t.title, t.id);
        const paidAtIso = new Date().toISOString();
        updated.paidUserIds = [...(updated.paidUserIds ?? []), a.userId];
        updated.applicants = updated.applicants.map((ap) =>
          ap.userId === a.userId ? { ...ap, paidAt: paidAtIso } : ap
        );
        const allSelected = updated.applicants.filter((ap) => ap.selected && ((ap.workLinks?.length ?? 0) > 0 || !!(ap.workLink || '').trim()));
        updated.pointPaid = allSelected.every((ap) => updated.paidUserIds?.includes(ap.userId));
        changed = true;
      }
    }
    next.push(updated);
  }

  if (changed) await upsertPartTimeTasks(next);
  return changed;
}

// ─── 어드민 전용: Netlify freelancer-admin 함수 호출 ────────────────────────
const ADMIN_FN_URL = '/.netlify/functions/freelancer-admin';

function getAdminKey(): string {
  return (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PANEL_PASSWORD
    ?? (import.meta as unknown as { env: Record<string, string> }).env?.VITE_ADMIN_PASSWORD
    ?? '';
}

async function callFreelancerAdmin(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(ADMIN_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': getAdminKey() },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`서버 함수 응답 없음 (HTTP ${res.status}) — Netlify 배포 또는 함수 로그를 확인해 주세요`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`서버 응답 파싱 오류 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error((json as { error?: string })?.error || `freelancer-admin ${res.status}`);
  return json;
}

/** 어드민: 즉시지급 */
export async function adminPayFreelancers(
  applicants: Array<{ userId: string; reward: number; taskTitle: string }>
): Promise<void> {
  await callFreelancerAdmin({ action: 'pay', applicants });
}

/** 어드민: 출금 신청 목록 조회 — Netlify 함수 대신 직접 Supabase 조회 (RLS 정책에 admin_read_withdraw 필요) */
export async function adminFetchWithdrawals(status = 'pending'): Promise<FreelancerWithdrawRequest[]> {
  let query = supabase.from('freelancer_withdraw_requests').select('*').order('requested_at', { ascending: false });
  if (status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => rowToWithdrawRequest(row as Record<string, unknown>));
}

/** 어드민: 출금 완료 처리 */
export async function adminCompleteWithdrawal(id: string): Promise<void> {
  await updateFreelancerWithdrawRequestStatusToDb(id, 'completed');
}

/** 어드민: 출금 실패 + 잔액 환급 */
export async function adminFailWithdrawal(id: string, userId: string, amount: number): Promise<void> {
  await updateFreelancerWithdrawRequestStatusToDb(id, 'failed');
  await refundFreelancerWithdrawalInDb(userId, amount, '출금 실패 환급');
}
