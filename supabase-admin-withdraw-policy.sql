-- freelancer_withdraw_requests 어드민 접근 정책
-- 어드민(nayeong6542@gmail.com)이 모든 회원의 출금 신청을 조회·처리할 수 있도록 허용
--
-- 기존 own_withdraw 정책(FOR ALL, user_id 본인만)은 그대로 유지하고
-- 어드민 전용 SELECT · UPDATE 정책을 추가합니다.

-- 어드민 조회 정책
DROP POLICY IF EXISTS "admin_read_withdraw" ON freelancer_withdraw_requests;
CREATE POLICY "admin_read_withdraw" ON freelancer_withdraw_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR auth.email() = 'nayeong6542@gmail.com'
  );

-- 어드민 상태 변경 정책 (출금완료 / 실패 처리)
DROP POLICY IF EXISTS "admin_update_withdraw" ON freelancer_withdraw_requests;
CREATE POLICY "admin_update_withdraw" ON freelancer_withdraw_requests
  FOR UPDATE TO authenticated
  USING   (auth.email() = 'nayeong6542@gmail.com')
  WITH CHECK (auth.email() = 'nayeong6542@gmail.com');
