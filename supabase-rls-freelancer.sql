-- ============================================================
-- 프리랜서 수익통장 테이블 RLS 정책 설정 (보안 버전)
--
-- 구조:
--   - 일반 유저: 자신의 행만 조회/수정 가능
--   - 관리자 서버 함수(service_role): 모든 행 접근 가능 (RLS 자동 우회)
--   - anon(미로그인): 접근 불가
--
-- 적용 방법: Supabase Dashboard → SQL Editor에서 실행
-- ============================================================

-- ─── freelancer_balances ────────────────────────────────────────────────
ALTER TABLE freelancer_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON freelancer_balances;
DROP POLICY IF EXISTS "own_balance"               ON freelancer_balances;

-- 본인 잔액만 조회/수정 (출금 신청 시 자신 잔액 차감 포함)
CREATE POLICY "own_balance" ON freelancer_balances
  FOR ALL TO authenticated
  USING   (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- ─── freelancer_earnings_history ────────────────────────────────────────
ALTER TABLE freelancer_earnings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access"  ON freelancer_earnings_history;
DROP POLICY IF EXISTS "own_earnings"               ON freelancer_earnings_history;

-- 본인 수익 내역만 조회/추가 (출금 신청 시 내역 기록 포함)
CREATE POLICY "own_earnings" ON freelancer_earnings_history
  FOR ALL TO authenticated
  USING   (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- ─── freelancer_withdraw_requests ────────────────────────────────────────
ALTER TABLE freelancer_withdraw_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access"  ON freelancer_withdraw_requests;
DROP POLICY IF EXISTS "own_withdraw"               ON freelancer_withdraw_requests;

-- 본인 출금 신청만 조회/생성 (계좌번호 등 민감정보 본인만 접근)
CREATE POLICY "own_withdraw" ON freelancer_withdraw_requests
  FOR ALL TO authenticated
  USING   (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);


-- ─── parttime_task_completed_checks ─────────────────────────────────────
ALTER TABLE parttime_task_completed_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access"  ON parttime_task_completed_checks;
DROP POLICY IF EXISTS "own_checks"                 ON parttime_task_completed_checks;

CREATE POLICY "own_checks" ON parttime_task_completed_checks
  FOR ALL TO authenticated
  USING   (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================
-- 주의: 관리자 즉시지급, 출금완료/실패 처리는
--       netlify/functions/freelancer-admin.js 에서
--       service_role 키로 처리하므로 RLS 우회됨.
-- ============================================================
