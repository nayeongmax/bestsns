-- freelancer_earnings_history 테이블에 task_id 컬럼 추가
-- 동일한 제목의 작업이 여러 개인 경우 작업을 ID로 식별하기 위해 필요

ALTER TABLE freelancer_earnings_history
  ADD COLUMN IF NOT EXISTS task_id text;
