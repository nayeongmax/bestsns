/**
 * 포인트 거래 내역 (point_transactions) Supabase 연동
 *
 * 필요한 Supabase 테이블 생성 SQL:
 * ----------------------------------------
 * CREATE TABLE IF NOT EXISTS point_transactions (
 *   id          text        PRIMARY KEY,
 *   user_id     text        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *   type        text        NOT NULL CHECK (type IN ('charge', 'usage', 'refund')),
 *   description text        NOT NULL,
 *   amount      integer     NOT NULL,
 *   created_at  timestamptz NOT NULL DEFAULT now()
 * );
 * CREATE INDEX IF NOT EXISTS idx_pt_user_id ON point_transactions(user_id);
 * ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "own_read"   ON point_transactions FOR SELECT USING (auth.uid()::text = user_id);
 * CREATE POLICY "own_insert" ON point_transactions FOR INSERT WITH CHECK (auth.uid()::text = user_id);
 * ----------------------------------------
 */

import { supabase } from './supabase';

export interface PointTransaction {
  id: string;
  user_id: string;
  type: 'charge' | 'usage' | 'refund';
  description: string;
  amount: number;
  created_at: string;
}

/** 포인트 거래 내역 1건 INSERT */
export async function insertPointTransaction(tx: PointTransaction): Promise<void> {
  const { error } = await supabase.from('point_transactions').insert(tx);
  if (error) throw error;
}

/** 특정 유저의 포인트 거래 내역 조회 (최신순) */
export async function fetchPointTransactions(
  userId: string,
  type?: 'charge' | 'usage' | 'refund'
): Promise<PointTransaction[]> {
  let query = supabase
    .from('point_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PointTransaction[];
}
