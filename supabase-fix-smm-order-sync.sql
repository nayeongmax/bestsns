-- ============================================================
-- Fix: smm_orders 가격 컬럼 타입 INTEGER → NUMERIC (소수 지원)
--      smm_products selling_price NUMERIC + sort_order 컬럼 추가
--      channel_orders buyer_account 컬럼 추가
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- smm_orders 가격 컬럼 타입 INTEGER → NUMERIC (소수 지원)
ALTER TABLE smm_orders
ALTER COLUMN cost_price TYPE NUMERIC USING cost_price::NUMERIC,
ALTER COLUMN selling_price TYPE NUMERIC USING selling_price::NUMERIC,
ALTER COLUMN profit TYPE NUMERIC USING profit::NUMERIC;

ALTER TABLE smm_products
ALTER COLUMN selling_price TYPE NUMERIC USING selling_price::NUMERIC;

ALTER TABLE smm_products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 9999;

ALTER TABLE channel_orders ADD COLUMN IF NOT EXISTS buyer_account TEXT DEFAULT NULL;

-- 스키마 캐시 갱신 (컬럼 변경 후 PostgREST 캐시 반영)
NOTIFY pgrst, 'reload schema';
