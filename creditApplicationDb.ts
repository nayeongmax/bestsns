/**
 * 크레딧 충전 신청서 (credit_applications) Supabase 연동
 *
 * 필요한 Supabase 테이블 생성 SQL:
 * ----------------------------------------
 * CREATE TABLE IF NOT EXISTS credit_applications (
 *   id             text        PRIMARY KEY,           -- 신청번호 (e.g. CREDIT-20240327-ABC12)
 *   user_id        text        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *   user_nickname  text        NOT NULL,
 *   depositor_name text        NOT NULL,              -- 입금자명
 *   amount         integer     NOT NULL,              -- 신청 크레딧 금액 (원)
 *   status         text        NOT NULL DEFAULT 'pending'
 *                              CHECK (status IN ('pending', 'approved', 'rejected')),
 *   created_at     timestamptz NOT NULL DEFAULT now(),
 *   approved_at    timestamptz,                       -- 관리자 승인 시각
 *   note           text                               -- 관리자 메모
 * );
 * CREATE INDEX IF NOT EXISTS idx_ca_user_id ON credit_applications(user_id);
 * CREATE INDEX IF NOT EXISTS idx_ca_status  ON credit_applications(status);
 * ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;
 * -- 본인 신청 조회
 * CREATE POLICY "own_read"   ON credit_applications FOR SELECT USING (auth.uid()::text = user_id);
 * -- 본인 신청 등록
 * CREATE POLICY "own_insert" ON credit_applications FOR INSERT WITH CHECK (auth.uid()::text = user_id);
 * -- 관리자 전체 조회/수정
 * CREATE POLICY "admin_all"  ON credit_applications FOR ALL USING (
 *   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()::text AND role = 'admin')
 * );
 * ----------------------------------------
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
