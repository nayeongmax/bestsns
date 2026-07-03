-- ============================================================
-- 가맹점 파트너 기능 — 필요 컬럼/테이블 생성
-- "가맹점선택" 저장 실패 문제와 구독플랜/마케팅상품 영구 저장을
-- 위해 Supabase SQL Editor에서 한 번 실행하세요.
-- ============================================================

-- 1. profiles 테이블에 is_franchise 컬럼 추가
--    (가맹점 파트너 관리 화면의 "가맹점선택" 토글이 저장되는 컬럼)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_franchise BOOLEAN NOT NULL DEFAULT false;

-- 2. franchise_plans — 가맹점 구독 플랜 (어드민패널에서 관리)
CREATE TABLE IF NOT EXISTS franchise_plans (
  id             TEXT PRIMARY KEY,
  name           TEXT    NOT NULL,
  price          NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  period         TEXT    NOT NULL DEFAULT '월',
  features       JSONB   NOT NULL DEFAULT '[]'::jsonb,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE franchise_plans
  ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- 3. franchise_products — 가맹점 전용 마케팅프로그램 상품 (어드민패널에서 관리)
CREATE TABLE IF NOT EXISTS franchise_products (
  id             TEXT PRIMARY KEY,
  name           TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  price          NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC,
  min_quantity   INTEGER NOT NULL DEFAULT 1,
  max_quantity   INTEGER NOT NULL DEFAULT 10000,
  category       TEXT    NOT NULL DEFAULT '',
  is_hidden      BOOLEAN NOT NULL DEFAULT false,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE franchise_products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC;

-- 4. RLS 비활성화 — 플랜/상품은 개인정보 없으므로 anon key로 읽기/쓰기 허용
--    (어드민패널이 Supabase Auth 미사용, anon key로만 동작하기 때문)
ALTER TABLE franchise_plans    DISABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_products DISABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- 스키마 캐시 갱신
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
