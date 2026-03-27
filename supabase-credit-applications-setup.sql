-- credit_applications 테이블 생성 및 RLS 보안 설정
-- Supabase SQL Editor에서 실행하세요.
--
-- ※ 이 앱은 Supabase Auth 대신 커스텀 로그인을 사용하므로
--    auth.uid()가 항상 null입니다.
--    따라서 RLS 정책은 역할(role) 기반으로만 설정합니다.
--
--  보안 전략:
--    - anon  키(클라이언트): INSERT만 허용 → 사용자 신청 제출
--    - SELECT / UPDATE / DELETE: 모두 차단 (정책 없음)
--      → 관리자 조회/승인은 Netlify 서버리스 함수(service_role 키)를 통해서만 처리
--      → service_role 은 RLS 를 우회하므로 별도 정책 불필요
--    - 결과: 클라이언트에서 직접 신청 목록 조회 불가 → 데이터 유출 방지

-- ──────────────────────────────────────────────────────────────────
-- 1. 테이블 생성
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_applications (
  id             text        PRIMARY KEY,
  user_id        text        NOT NULL,
  user_nickname  text        NOT NULL,
  depositor_name text        NOT NULL,
  amount         integer     NOT NULL CHECK (amount > 0),
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz,
  note           text
);

-- ──────────────────────────────────────────────────────────────────
-- 2. 인덱스
-- ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ca_user_id   ON credit_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_ca_status    ON credit_applications(status);
CREATE INDEX IF NOT EXISTS idx_ca_created   ON credit_applications(created_at);

-- ──────────────────────────────────────────────────────────────────
-- 3. RLS 활성화
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────
-- 4. 기존 정책 제거 후 재생성
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own_read"     ON credit_applications;
DROP POLICY IF EXISTS "own_insert"   ON credit_applications;
DROP POLICY IF EXISTS "admin_all"    ON credit_applications;
DROP POLICY IF EXISTS "allow_insert" ON credit_applications;

-- anon(클라이언트)은 INSERT만 허용 (신청 제출)
-- SELECT / UPDATE / DELETE 는 정책 없음 → anon 완전 차단
CREATE POLICY "allow_insert"
  ON credit_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ※ service_role 키는 RLS 를 자동으로 우회합니다.
--   따라서 관리자용 SELECT / UPDATE 는 Netlify 함수(credit-admin.js)가
--   SUPABASE_SERVICE_ROLE_KEY 를 사용해 직접 처리합니다.
--   클라이언트(브라우저)에서는 credit_applications 를 읽거나 수정할 수 없습니다.

-- ──────────────────────────────────────────────────────────────────
-- 5. profiles 테이블 — 포인트 충전을 위한 UPDATE 허용 확인
--    (service_role 로 처리하므로 별도 정책 불필요.
--     아래는 참고용 주석입니다.)
-- ──────────────────────────────────────────────────────────────────
-- credit-admin.js Netlify 함수가 service_role 키로 profiles.points 를 UPDATE 합니다.
-- profiles 테이블에 RLS 가 활성화되어 있어도 service_role 은 우회하므로 동작합니다.
