-- ============================================================
-- SMM(SNS 활성화) 테이블 RLS 정책 설정
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================
--
-- 적용 전 확인사항:
--   - smm_orders, smm_products, smm_providers 테이블이 존재해야 함
--   - 어드민 DB 쓰기는 smm-admin Netlify 함수(service_role)를 통해 수행됨
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. smm_orders — 로그인 사용자는 자신의 주문만 접근 가능
--    어드민 전체 조회/수정은 smm-admin Netlify 함수(service_role) 사용
-- ──────────────────────────────────────────────────────────────
ALTER TABLE smm_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_select"  ON smm_orders;
DROP POLICY IF EXISTS "own_insert"  ON smm_orders;
DROP POLICY IF EXISTS "own_update"  ON smm_orders;
DROP POLICY IF EXISTS "anon_all"    ON smm_orders;

-- 로그인 사용자: 자기 주문만 조회
CREATE POLICY "own_select"
  ON smm_orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- 로그인 사용자: 자기 주문만 삽입
CREATE POLICY "own_insert"
  ON smm_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

-- 로그인 사용자: 자기 주문만 수정
CREATE POLICY "own_update"
  ON smm_orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text);


-- ──────────────────────────────────────────────────────────────
-- 2. smm_products — 상품 목록은 누구나 읽기 가능
--    쓰기(등록/수정/삭제)는 service_role(smm-admin 함수)만 가능
-- ──────────────────────────────────────────────────────────────
ALTER TABLE smm_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select" ON smm_products;

CREATE POLICY "public_select"
  ON smm_products FOR SELECT
  TO anon, authenticated
  USING (true);


-- ──────────────────────────────────────────────────────────────
-- 3. smm_providers — 공급처 정보는 관리자 전용
--    정책 없음 = service_role(smm-admin 함수)만 접근 가능
-- ──────────────────────────────────────────────────────────────
ALTER TABLE smm_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select" ON smm_providers;
DROP POLICY IF EXISTS "anon_select"   ON smm_providers;
-- 정책을 추가하지 않으면 service_role 외 접근 불가


-- ──────────────────────────────────────────────────────────────
-- 스키마 캐시 갱신
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
