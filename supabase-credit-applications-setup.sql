-- credit_applications 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
--
-- ※ 이 앱은 Supabase Auth 대신 커스텀 로그인을 사용하므로
--    auth.uid()가 항상 null입니다. 다른 테이블과 동일하게 RLS를 사용하지 않습니다.

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

-- RLS 비활성화 (다른 테이블과 동일한 방식 — 보안은 애플리케이션 레이어에서 처리)
ALTER TABLE credit_applications DISABLE ROW LEVEL SECURITY;

-- 기존에 RLS가 활성화되어 있었다면 정책 제거
DROP POLICY IF EXISTS "own_read"   ON credit_applications;
DROP POLICY IF EXISTS "own_insert" ON credit_applications;
DROP POLICY IF EXISTS "admin_all"  ON credit_applications;
