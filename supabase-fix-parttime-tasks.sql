-- ============================================================
-- 누구나알바 parttime_tasks 신규 컬럼 추가 + RLS 전체 허용
-- ============================================================
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 실행
--
-- 이 스크립트가 필요한 이유:
--   관리자는 Supabase Auth 세션 없이 로그인하므로, RLS가 켜져 있으면
--   anon 역할로 INSERT/UPDATE가 막혀 "작업 등록에 실패했습니다" 오류가 발생합니다.
--   아래 정책으로 모든 역할(anon, authenticated, service_role)이
--   parttime_tasks 테이블에 읽기·쓰기 가능하도록 설정합니다.
-- ============================================================

-- 1. 신규 컬럼 추가 (이미 있으면 무시)
ALTER TABLE parttime_tasks
  ADD COLUMN IF NOT EXISTS signup_link    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS post_visibility TEXT DEFAULT NULL;

-- 2. RLS 활성화
ALTER TABLE parttime_tasks ENABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 제거 후 재생성
DROP POLICY IF EXISTS "parttime_tasks_select_all" ON parttime_tasks;
DROP POLICY IF EXISTS "parttime_tasks_insert_all" ON parttime_tasks;
DROP POLICY IF EXISTS "parttime_tasks_update_all" ON parttime_tasks;
DROP POLICY IF EXISTS "parttime_tasks_delete_all" ON parttime_tasks;

-- 누구나 조회 가능
CREATE POLICY "parttime_tasks_select_all"
  ON parttime_tasks FOR SELECT USING (true);

-- 누구나 등록 가능 (관리자 세션 없이도 INSERT 허용)
CREATE POLICY "parttime_tasks_insert_all"
  ON parttime_tasks FOR INSERT WITH CHECK (true);

-- 누구나 수정 가능
CREATE POLICY "parttime_tasks_update_all"
  ON parttime_tasks FOR UPDATE USING (true);

-- 누구나 삭제 가능
CREATE POLICY "parttime_tasks_delete_all"
  ON parttime_tasks FOR DELETE USING (true);

-- 4. PostgREST 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
