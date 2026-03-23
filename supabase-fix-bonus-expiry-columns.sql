-- ============================================================
-- 포인트 충전 보너스 이벤트 적용기간 컬럼 추가
-- profiles 테이블에 point_bonus_expiry_days, point_bonus_start_date 컬럼 추가
-- 관리자가 보너스 이벤트에 기간을 설정할 수 있도록 지원
-- Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS point_bonus_expiry_days  INTEGER  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS point_bonus_start_date   DATE     DEFAULT NULL;
