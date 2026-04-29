-- ============================================================
-- 프리랜서 수익통장 테이블 RLS 정책 설정
-- 대상: freelancer_balances, freelancer_earnings_history, freelancer_withdraw_requests
--
-- 적용 방법: Supabase Dashboard → SQL Editor에서 이 파일 내용 실행
--
-- 정책 설명:
--   - 로그인한 사용자(authenticated)는 모든 행 조회/수정/삽입/삭제 가능
--   - 운영자가 다른 프리랜서 잔액을 직접 수정해야 하므로 전체 허용
--   - 미로그인(anon)은 접근 불가
-- ============================================================

-- ─── freelancer_balances ────────────────────────────────────────────────
ALTER TABLE freelancer_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON freelancer_balances;
CREATE POLICY "authenticated_full_access" ON freelancer_balances
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─── freelancer_earnings_history ────────────────────────────────────────
ALTER TABLE freelancer_earnings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON freelancer_earnings_history;
CREATE POLICY "authenticated_full_access" ON freelancer_earnings_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─── freelancer_withdraw_requests ────────────────────────────────────────
ALTER TABLE freelancer_withdraw_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON freelancer_withdraw_requests;
CREATE POLICY "authenticated_full_access" ON freelancer_withdraw_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─── parttime_task_completed_checks ─────────────────────────────────────
ALTER TABLE parttime_task_completed_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON parttime_task_completed_checks;
CREATE POLICY "authenticated_full_access" ON parttime_task_completed_checks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
