-- ============================================================
-- store_products INSERT/UPDATE/DELETE RLS 정책 수정
--
-- 문제: 앱의 user.id(커스텀 ID)가 Supabase Auth UUID와 달라서
--       author_id = auth.uid()::text 조건을 만족하지 못함 → 저장 실패
--
-- 수정: 로그인(authenticated)한 사용자는 쓰기 허용
--       SELECT 정책(is_secret 비밀 상품 보호)은 그대로 유지
-- ============================================================

-- 기존 쓰기 정책 삭제
DROP POLICY IF EXISTS "own_insert" ON store_products;
DROP POLICY IF EXISTS "own_update" ON store_products;
DROP POLICY IF EXISTS "own_delete" ON store_products;

-- INSERT: 로그인 사용자라면 등록 허용
CREATE POLICY "own_insert"
  ON store_products FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: 로그인 사용자라면 수정 허용
CREATE POLICY "own_update"
  ON store_products FOR UPDATE
  TO authenticated
  USING (true);

-- DELETE: 로그인 사용자라면 삭제 허용
CREATE POLICY "own_delete"
  ON store_products FOR DELETE
  TO authenticated
  USING (true);

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
