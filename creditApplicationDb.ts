/**
 * 크레딧 충전 신청서 (credit_applications) Supabase 연동
 *
 * RLS 정책 (supabase-credit-applications-setup.sql 참고):
 *   - anon 키: INSERT만 허용 (사용자 신청 제출)
 *   - SELECT / UPDATE / DELETE: service_role 키만 허용
 *     → 관리자 조회/승인은 Supabase 대시보드 또는 service_role 키 사용
 */

import { supabase } from './supabase';

export interface CreditApplication {
  id: string;               // 신청번호
  user_id: string;
  user_nickname: string;
  depositor_name: string;   // 입금자명
  amount: number;           // 신청 금액 (원 = 크레딧)
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at?: string;
  note?: string;
}

/** 크레딧 신청번호 생성 */
export function generateCreditAppId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `CREDIT-${date}-${rand}`;
}

/** 크레딧 충전 신청서 INSERT */
export async function insertCreditApplication(app: CreditApplication): Promise<void> {
  const { error } = await supabase.from('credit_applications').insert(app);
  if (error) throw error;
}

/** 특정 유저의 신청 내역 조회 (최신순) */
export async function fetchCreditApplicationsByUser(userId: string): Promise<CreditApplication[]> {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditApplication[];
}

/** 전체 신청 내역 조회 - 관리자용 (최신순) */
export async function fetchAllCreditApplications(): Promise<CreditApplication[]> {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CreditApplication[];
}

/** 신청 상태 업데이트 - 관리자용 */
export async function updateCreditApplicationStatus(
  id: string,
  status: 'approved' | 'rejected',
  note?: string,
): Promise<void> {
  const patch: Partial<CreditApplication> = { status };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  if (note != null) patch.note = note;
  const { error } = await supabase.from('credit_applications').update(patch).eq('id', id);
  if (error) throw error;
}
