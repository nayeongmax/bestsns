-- credit_applications 테이블 생성 및 RLS 정책 설정
-- Supabase SQL Editor에서 실행하세요.

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

ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 오류 방지)
DROP POLICY IF EXISTS "own_read"   ON credit_applications;
DROP POLICY IF EXISTS "own_insert" ON credit_applications;
DROP POLICY IF EXISTS "admin_all"  ON credit_applications;

-- 본인 신청 조회
CREATE POLICY "own_read" ON credit_applications
  FOR SELECT USING (auth.uid()::text = user_id);

-- 본인 신청 등록
CREATE POLICY "own_insert" ON credit_applications
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- 관리자 전체 조회/수정
CREATE POLICY "admin_all" ON credit_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()::text AND role = 'admin'
    )
  );
