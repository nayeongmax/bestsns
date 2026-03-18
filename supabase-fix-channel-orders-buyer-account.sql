-- ============================================================
-- Fix: channel_orders 테이블에 buyer_account 컬럼 추가
-- 에러: "Could not find the 'buyer_account' column of 'channel_orders' in the schema cache"
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

ALTER TABLE channel_orders
  ADD COLUMN IF NOT EXISTS buyer_account TEXT DEFAULT NULL;

-- 스키마 캐시 갱신 (컬럼 추가 후 PostgREST 캐시 반영)
NOTIFY pgrst, 'reload schema';
