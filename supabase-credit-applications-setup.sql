-- credit_applications 테이블 생성 및 RLS 설정
-- Supabase SQL Editor에서 실행하세요.
--
-- ※ 이 앱은 Supabase Auth 대신 커스텀 로그인을 사용하므로
--    auth.uid()가 항상 null입니다.
--    따라서 RLS 정책은 역할(role) 기반으로만 설정합니다.
--    - anon 키: INSERT만 허용 (사용자 신청 제출)
--    - SELECT / UPDATE / DELETE: service_role 키만 허용
--      → 관리자는 Supabase 대시보드 또는 service_role 키 사용

CREATE TABLE IF NOT EXISTS credit_applications (
  id             text        PRIMARY KEY,
  user_id        text        NOT NULL,
  user_nickname  text        NOT NULL,
  depositor_name text        NOT NULL,
  amount         integer     NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz,
  note           text
);

CREATE INDEX IF NOT EXISTS idx_ca_user_id ON credit_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_ca_status  ON credit_applications(status);

-- RLS 활성화
ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성
DROP POLICY IF EXISTS "own_read"    ON credit_applications;
DROP POLICY IF EXISTS "own_insert"  ON credit_applications;
DROP POLICY IF EXISTS "admin_all"   ON credit_applications;
DROP POLICY IF EXISTS "allow_insert" ON credit_applications;

-- anon(클라이언트)은 INSERT만 허용 (신청 제출)
-- SELECT / UPDATE / DELETE는 service_role만 접근 가능 (정책 없음 = 차단)
CREATE POLICY "allow_insert"
  ON credit_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);
