-- ============================================================
-- bestsns 전체 상품/주문/결제 테이블 완전 셋업 SQL
-- 대상: 이 사이트에서 판매하는 모든 상품 및 결제
--   1) SNS 활성화 상품 (smm_products / smm_orders)
--   2) 유튜브 채널판매 (channel_products / channel_orders)
--   3) N잡스토어 상품 (store_products / store_orders / reviews)
--   4) 누구나알바 광고주 견적결제 (parttime_job_requests / parttime_tasks)
--   5) 프리랜서 수익통장 (freelancer_balances / freelancer_earnings_history / freelancer_withdraw_requests)
--   6) 포인트 거래 (point_transactions)
--   7) 보조 테이블 (order_buyer_flags / seller_withdrawal_batches / parttime_task_completed_checks / smm_providers)
--
-- ※ 신규 DB: 모든 테이블을 CREATE TABLE IF NOT EXISTS 로 생성
-- ※ 기존 DB: ALTER TABLE ... ADD COLUMN IF NOT EXISTS 로 누락 컬럼 보완
-- ※ Supabase SQL Editor에서 한 번에 실행하세요.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. SMM (SNS 활성화) 공급처
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smm_providers (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL DEFAULT '',
  api_url    TEXT    NOT NULL DEFAULT '',
  is_hidden  BOOLEAN NOT NULL DEFAULT false
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE smm_providers
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;


-- ──────────────────────────────────────────────────────────────
-- 2. SMM (SNS 활성화) 상품
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smm_products (
  id             TEXT    PRIMARY KEY,
  name           TEXT    NOT NULL DEFAULT '',
  platform       TEXT    NOT NULL DEFAULT '',
  category       TEXT    NOT NULL DEFAULT '',
  selling_price  NUMERIC NOT NULL DEFAULT 0,
  min_quantity   INTEGER NOT NULL DEFAULT 0,
  max_quantity   INTEGER NOT NULL DEFAULT 100000,
  sources        JSONB   NOT NULL DEFAULT '[]',
  is_hidden      BOOLEAN NOT NULL DEFAULT false,
  sort_order     INTEGER NOT NULL DEFAULT 9999
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE smm_products
  ADD COLUMN IF NOT EXISTS is_hidden   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 9999;

-- selling_price 타입 보정 (INTEGER → NUMERIC, 소수점 지원)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_products'
      AND column_name = 'selling_price'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE smm_products
      ALTER COLUMN selling_price TYPE NUMERIC USING selling_price::NUMERIC;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- 3. SMM (SNS 활성화) 주문
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smm_orders (
  id                TEXT    PRIMARY KEY,
  user_id           TEXT    NOT NULL,
  user_nickname     TEXT    NOT NULL DEFAULT '',
  order_time        TEXT    NOT NULL,
  platform          TEXT    NOT NULL DEFAULT '',
  product_name      TEXT    NOT NULL DEFAULT '',
  link              TEXT    DEFAULT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  initial_count     INTEGER DEFAULT NULL,
  remains           INTEGER DEFAULT NULL,
  provider_name     TEXT    DEFAULT NULL,
  cost_price        NUMERIC NOT NULL DEFAULT 0,
  selling_price     NUMERIC NOT NULL DEFAULT 0,
  profit            NUMERIC NOT NULL DEFAULT 0,
  status            TEXT    NOT NULL DEFAULT '',
  external_order_id TEXT    DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE smm_orders
  ADD COLUMN IF NOT EXISTS initial_count     INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remains           INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider_name     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_order_id TEXT    DEFAULT NULL;

-- 가격 컬럼 타입 보정 (INTEGER → NUMERIC)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_orders'
      AND column_name = 'cost_price'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE smm_orders
      ALTER COLUMN cost_price    TYPE NUMERIC USING cost_price::NUMERIC,
      ALTER COLUMN selling_price TYPE NUMERIC USING selling_price::NUMERIC,
      ALTER COLUMN profit        TYPE NUMERIC USING profit::NUMERIC;
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- 4. 유튜브 채널판매 상품
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_products (
  id               TEXT    PRIMARY KEY,
  platform         TEXT    NOT NULL DEFAULT '',
  title            TEXT    NOT NULL,
  category         TEXT    NOT NULL DEFAULT '',
  subscribers      INTEGER NOT NULL DEFAULT 0,
  income           INTEGER NOT NULL DEFAULT 0,
  expense          INTEGER NOT NULL DEFAULT 0,
  price            INTEGER NOT NULL DEFAULT 0,
  thumbnail        TEXT    NOT NULL DEFAULT '',
  attached_images  JSONB   DEFAULT '[]',
  is_sold_out      BOOLEAN NOT NULL DEFAULT false,
  description      TEXT    DEFAULT NULL,
  is_approved      BOOLEAN DEFAULT NULL,
  is_hot           BOOLEAN DEFAULT NULL,
  source_link      TEXT    DEFAULT NULL,
  public_link      TEXT    DEFAULT NULL,
  seller_id        TEXT    DEFAULT NULL,
  seller_nickname  TEXT    DEFAULT NULL,
  seller_image     TEXT    DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE channel_products
  ADD COLUMN IF NOT EXISTS attached_images  JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_sold_out      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_approved      BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_hot           BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_link      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS public_link      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seller_id        TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seller_nickname  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seller_image     TEXT    DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 5. 유튜브 채널판매 주문 (결제 컬럼 포함)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channel_orders (
  id              TEXT    PRIMARY KEY,
  user_id         TEXT    NOT NULL,
  user_nickname   TEXT    NOT NULL,
  order_time      TEXT    NOT NULL,
  product_id      TEXT    NOT NULL,
  product_name    TEXT    NOT NULL,
  platform        TEXT    NOT NULL DEFAULT '',
  price           INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT '',
  payment_id      TEXT    DEFAULT NULL,
  payment_method  TEXT    DEFAULT NULL,
  payment_log     TEXT    DEFAULT NULL,
  buyer_account   TEXT    DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE channel_orders
  ADD COLUMN IF NOT EXISTS payment_id     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_log    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_account  TEXT DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 6. N잡스토어 상품
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_products (
  id               TEXT        PRIMARY KEY,
  store_type       TEXT        NOT NULL DEFAULT 'ebook',
  title            TEXT        NOT NULL,
  category         TEXT        NOT NULL,
  sub_category     TEXT        NOT NULL DEFAULT '',
  author           TEXT        NOT NULL,
  author_id        TEXT        NOT NULL DEFAULT '',
  thumbnail        TEXT        NOT NULL DEFAULT '',
  price            NUMERIC     NOT NULL DEFAULT 0,
  tiers            JSONB       NOT NULL DEFAULT '[]',
  description      TEXT        DEFAULT NULL,
  index_text       TEXT        DEFAULT NULL,
  service_method   TEXT        DEFAULT NULL,
  faqs             JSONB       DEFAULT '[]',
  attached_images  JSONB       DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_paused        BOOLEAN     NOT NULL DEFAULT false,
  is_prime         BOOLEAN     NOT NULL DEFAULT false,
  is_hot           BOOLEAN     NOT NULL DEFAULT false,
  is_new           BOOLEAN     NOT NULL DEFAULT false,
  rejection_reason TEXT        DEFAULT NULL,
  snapshot         JSONB       DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS store_type      TEXT    NOT NULL DEFAULT 'ebook',
  ADD COLUMN IF NOT EXISTS sub_category    TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS author_id       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiers           JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS index_text      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS service_method  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS faqs            JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS attached_images JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_paused       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_prime        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hot          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS snapshot        JSONB   DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 7. N잡스토어 주문 (결제 컬럼 포함)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_orders (
  id               TEXT    PRIMARY KEY,
  user_id          TEXT    NOT NULL,
  user_nickname    TEXT    NOT NULL,
  seller_nickname  TEXT    NOT NULL,
  order_time       TEXT    NOT NULL,
  confirmed_at     TEXT    DEFAULT NULL,
  product_id       TEXT    NOT NULL,
  product_name     TEXT    NOT NULL,
  tier_name        TEXT    DEFAULT NULL,
  price            NUMERIC NOT NULL DEFAULT 0,
  store_type       TEXT    NOT NULL DEFAULT 'ebook',
  status           TEXT    NOT NULL DEFAULT '결제완료',
  payment_id       TEXT    DEFAULT NULL,
  payment_method   TEXT    DEFAULT NULL,
  payment_log      TEXT    DEFAULT NULL,
  downloaded_at    TEXT    DEFAULT NULL,
  buyer_tax_info   TEXT    DEFAULT NULL,
  review_id        TEXT    DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS seller_nickname TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmed_at    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tier_name       TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS store_type      TEXT    NOT NULL DEFAULT 'ebook',
  ADD COLUMN IF NOT EXISTS payment_id      TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_method  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_log     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS downloaded_at   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_tax_info  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_id       TEXT    DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 8. N잡스토어 리뷰
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT    PRIMARY KEY,
  product_id  TEXT    NOT NULL,
  user_id     TEXT    NOT NULL,
  author      TEXT    NOT NULL,
  rating      INTEGER NOT NULL DEFAULT 5,
  content     TEXT    DEFAULT NULL,
  date        TEXT    NOT NULL DEFAULT '',
  reply       TEXT    DEFAULT NULL,
  reply_date  TEXT    DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reply      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reply_date TEXT DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 9. 구매자 확정/리뷰/다운로드 플래그 (N잡스토어·채널 공통)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_buyer_flags (
  id                   TEXT        PRIMARY KEY,
  order_id             TEXT        NOT NULL,
  user_id              TEXT        NOT NULL,
  order_type           TEXT        NOT NULL DEFAULT 'store',
  confirmed_at         TIMESTAMPTZ DEFAULT NULL,
  reviewed_at          TIMESTAMPTZ DEFAULT NULL,
  download_started_at  TIMESTAMPTZ DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE order_buyer_flags
  ADD COLUMN IF NOT EXISTS order_type          TEXT        NOT NULL DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS download_started_at TIMESTAMPTZ DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 10. 판매자 정산 출금 신청 (N잡스토어)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_withdrawal_batches (
  id              TEXT        PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  confirmed_date  TEXT        NOT NULL,
  amount          NUMERIC     NOT NULL DEFAULT 0,
  gross_amount    NUMERIC     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT '지급 예정',
  order_ids       JSONB       NOT NULL DEFAULT '[]',
  product_name    TEXT        DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE seller_withdrawal_batches
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_name TEXT    DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 11. 누구나알바 광고주 의뢰 / 견적결제
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parttime_job_requests (
  id                TEXT        PRIMARY KEY,
  applicant_user_id TEXT        DEFAULT NULL,
  title             TEXT        NOT NULL,
  work_content      TEXT        DEFAULT NULL,
  platform_links    JSONB       DEFAULT NULL,
  platform_link     TEXT        DEFAULT NULL,
  ad_amount         NUMERIC     NOT NULL DEFAULT 0,
  unit_price        NUMERIC     DEFAULT NULL,
  quantity          INTEGER     DEFAULT NULL,
  fee               NUMERIC     NOT NULL DEFAULT 0,
  work_period_start TEXT        DEFAULT NULL,
  work_period_end   TEXT        DEFAULT NULL,
  contact           TEXT        DEFAULT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending_review',
  paid              BOOLEAN     NOT NULL DEFAULT false,
  reject_reason     TEXT        DEFAULT NULL,
  example_images    JSONB       DEFAULT NULL,
  operator_estimate JSONB       DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted        BOOLEAN     NOT NULL DEFAULT false
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE parttime_job_requests
  ADD COLUMN IF NOT EXISTS applicant_user_id TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_links    JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unit_price        NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quantity          INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reject_reason     TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS example_images    JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS operator_estimate JSONB   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_deleted        BOOLEAN NOT NULL DEFAULT false;


-- ──────────────────────────────────────────────────────────────
-- 12. 누구나알바 작업 (프리랜서 작업 게시판)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parttime_tasks (
  id                          TEXT        PRIMARY KEY,
  title                       TEXT        NOT NULL,
  description                 TEXT        DEFAULT NULL,
  category                    TEXT        NOT NULL,
  reward                      NUMERIC     NOT NULL DEFAULT 0,
  max_applicants              INTEGER     DEFAULT NULL,
  sections                    JSONB       NOT NULL DEFAULT '{}',
  application_period_start    TEXT        DEFAULT NULL,
  application_period_end      TEXT        DEFAULT NULL,
  work_period_start           TEXT        DEFAULT NULL,
  work_period_end             TEXT        DEFAULT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                  TEXT        DEFAULT NULL,
  applicants                  JSONB       NOT NULL DEFAULT '[]',
  point_paid                  BOOLEAN     NOT NULL DEFAULT false,
  paid_user_ids               JSONB       NOT NULL DEFAULT '[]',
  applicant_user_id           TEXT        DEFAULT NULL,
  job_request_id              TEXT        DEFAULT NULL,
  project_no                  TEXT        DEFAULT NULL,
  sent_to_advertiser_at       TIMESTAMPTZ DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE parttime_tasks
  ADD COLUMN IF NOT EXISTS sections               JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS paid_user_ids          JSONB       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS applicant_user_id      TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS job_request_id         TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS project_no             TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sent_to_advertiser_at  TIMESTAMPTZ DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 13. 누구나알바 작업완료 체크 (프리랜서 캘린더)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parttime_task_completed_checks (
  user_id  TEXT NOT NULL,
  task_id  TEXT NOT NULL,
  PRIMARY KEY (user_id, task_id)
);


-- ──────────────────────────────────────────────────────────────
-- 14. 프리랜서 수익통장 잔액
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_balances (
  user_id     TEXT        PRIMARY KEY,
  balance     NUMERIC     NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
-- 15. 프리랜서 수익 내역 (적립/출금)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_earnings_history (
  id          TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'task',
  amount      NUMERIC     NOT NULL DEFAULT 0,
  label       TEXT        DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feh_user_id ON freelancer_earnings_history (user_id);


-- ──────────────────────────────────────────────────────────────
-- 16. 프리랜서 출금 신청
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_withdraw_requests (
  id            TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  nickname      TEXT        NOT NULL,
  amount        NUMERIC     NOT NULL DEFAULT 0,
  bank_name     TEXT        NOT NULL,
  account_no    TEXT        NOT NULL,
  owner_name    TEXT        NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT        NOT NULL DEFAULT 'pending',
  completed_at  TIMESTAMPTZ DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE freelancer_withdraw_requests
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;


-- ──────────────────────────────────────────────────────────────
-- 17. 포인트 거래 내역 (충전 / 사용 / 환불)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id              TEXT        PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  type            TEXT        NOT NULL CHECK (type IN ('charge', 'usage', 'refund')),
  description     TEXT        NOT NULL,
  amount          INTEGER     NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method  TEXT        DEFAULT NULL,
  payment_log     TEXT        DEFAULT NULL
);

-- 기존 테이블에 누락된 컬럼 보완
ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_log    TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pt_user_id ON point_transactions (user_id);


-- ──────────────────────────────────────────────────────────────
-- 18. 크레딧 충전 신청
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_applications (
  id             TEXT        PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  user_nickname  TEXT        NOT NULL,
  depositor_name TEXT        NOT NULL,
  amount         INTEGER     NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  note           TEXT
);

CREATE INDEX IF NOT EXISTS idx_ca_user_id ON credit_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_ca_status  ON credit_applications (status);

-- RLS 활성화 (anon은 INSERT만 허용, SELECT/UPDATE/DELETE는 service_role만)
ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert"  ON credit_applications;
DROP POLICY IF EXISTS "own_read"      ON credit_applications;
DROP POLICY IF EXISTS "own_insert"    ON credit_applications;
DROP POLICY IF EXISTS "admin_all"     ON credit_applications;

CREATE POLICY "allow_insert"
  ON credit_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- 스키마 캐시 갱신 (PostgREST 캐시 반영)
-- ──────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
