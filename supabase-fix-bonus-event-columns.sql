-- ============================================================
-- 포인트 충전 보너스 이벤트 컬럼 추가
-- profiles 테이블에 point_bonus_percent, point_bonus_active 컬럼이
-- 없어서 어드민에서 저장해도 DB 반영이 안 되는 문제를 수정합니다.
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS point_bonus_percent NUMERIC  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS point_bonus_active  BOOLEAN  NOT NULL DEFAULT false;
