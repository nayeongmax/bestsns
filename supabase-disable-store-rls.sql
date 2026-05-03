-- ============================================================
-- store_products RLS 비활성화
-- Supabase SQL Editor에서 실행하세요.
--
-- 이유: 앱이 Supabase Auth 세션 없이 동작하는 경우(어드민, 커스텀 로그인)
--       RLS 정책이 INSERT/UPDATE를 차단하여 상품 저장 실패가 발생함
-- ============================================================

ALTER TABLE store_products DISABLE ROW LEVEL SECURITY;

-- 스키마 캐시 갱신
NOTIFY pgrst, 'reload schema';
