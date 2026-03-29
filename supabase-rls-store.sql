-- ============================================================
-- N잡스토어(store_products) RLS 정책 설정
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================
--
-- 적용 전 확인사항:
--   - store_products 테이블이 존재해야 함
--   - 어드민 DB 쓰기(비밀 상품 포함)는 store-admin Netlify 함수(service_role)를 통해 수행됨
--   - 판매자 본인 상품 등록/수정/삭제는 authenticated anon key 사용 (RLS로 본인 상품만 허용)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. store_products — RLS 활성화
-- ──────────────────────────────────────────────────────────────
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

-- 기존 정책 초기화
DROP POLICY IF EXISTS "public_select"         ON store_products;
DROP POLICY IF EXISTS "own_select"            ON store_products;
DROP POLICY IF EXISTS "own_insert"            ON store_products;
DROP POLICY IF EXISTS "own_update"            ON store_products;
DROP POLICY IF EXISTS "own_delete"            ON store_products;


-- ──────────────────────────────────────────────────────────────
-- 2. SELECT: 비밀 상품(is_secret=true) 및 미승인 상품은 공개 불가
--    - anon(비로그인): 승인된 비비밀 상품만 조회 가능
--    - authenticated(로그인): 공개 상품 + 본인이 등록한 상품 모두 조회 가능
--    - service_role(어드민 Netlify 함수): RLS 우회, 전체 조회 가능
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "public_select"
  ON store_products FOR SELECT
  TO anon
  USING (is_secret = false AND status = 'approved');

CREATE POLICY "own_select"
  ON store_products FOR SELECT
  TO authenticated
  USING (
    (is_secret = false AND status = 'approved')
    OR author_id = auth.uid()::text
  );


-- ──────────────────────────────────────────────────────────────
-- 3. INSERT: 로그인 사용자만 본인 상품 등록 가능
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "own_insert"
  ON store_products FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid()::text);


-- ──────────────────────────────────────────────────────────────
-- 4. UPDATE: 로그인 사용자는 본인 상품만 수정 가능
--    (어드민 전체 수정은 service_role을 통한 store-admin Netlify 함수 사용)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "own_update"
  ON store_products FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid()::text);


-- ──────────────────────────────────────────────────────────────
-- 5. DELETE: 로그인 사용자는 본인 상품만 삭제 가능
--    (어드민 삭제는 service_role을 통한 store-admin Netlify 함수 사용)
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "own_delete"
  ON store_products FOR DELETE
  TO authenticated
  USING (author_id = auth.uid()::text);


-- ──────────────────────────────────────────────────────────────
-- 스키마 캐시 갱신
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
