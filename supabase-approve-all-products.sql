-- ============================================================
-- store_products 전체 pending 상품 일괄 승인
-- Supabase SQL Editor에서 실행하세요.
-- 제목: store_products 전체 승인
-- ============================================================

-- 현재 pending/revision 상태인 상품을 모두 approved로 변경
UPDATE store_products
SET status = 'approved'
WHERE status IN ('pending', 'revision');

-- 결과 확인
SELECT id, title, status FROM store_products ORDER BY created_at DESC;
