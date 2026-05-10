-- ============================================================
-- parttime_tasks 테이블: 누락된 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

ALTER TABLE parttime_tasks
  ADD COLUMN IF NOT EXISTS work_time_slot text,
  ADD COLUMN IF NOT EXISTS daily_limit integer,
  ADD COLUMN IF NOT EXISTS video_uploads jsonb DEFAULT '[]'::jsonb;
