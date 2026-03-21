-- ============================================================
-- Fix: channel_orders 테이블에 누락된 컬럼 추가
-- 에러: payment_id, payment_method, payment_log, buyer_account 컬럼 없어서
--        upsertChannelOrder 실패 → 채널 주문이 DB에 저장되지 않는 문제
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

ALTER TABLE channel_orders
  ADD COLUMN IF NOT EXISTS payment_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_log TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_account TEXT DEFAULT NULL;

-- 스키마 캐시 갱신 (컬럼 추가 후 PostgREST 캐시 반영)
NOTIFY pgrst, 'reload schema';
