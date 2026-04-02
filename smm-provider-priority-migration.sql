-- ============================================================
-- Migration: 공급처 우선순위 + 성공률 통계 테이블
-- 실행 위치: Supabase SQL Editor
-- ============================================================

-- 1. smm_providers 에 priority 컬럼 추가 (1=1순위, 2=2순위, ...)
ALTER TABLE smm_providers
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 99;

-- 2. 공급처별 주문 성공률 통계 테이블
CREATE TABLE IF NOT EXISTS smm_provider_stats (
  id              TEXT PRIMARY KEY,          -- 공급처 ID (smm_providers.id 참조)
  total_attempts  INTEGER NOT NULL DEFAULT 0, -- 총 시도 횟수
  success_count   INTEGER NOT NULL DEFAULT 0, -- 성공 횟수
  fail_count      INTEGER NOT NULL DEFAULT 0, -- 실패 횟수
  success_rate    NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- 성공률 (%)
  last_attempt_at TIMESTAMPTZ,               -- 마지막 시도 시각
  last_success_at TIMESTAMPTZ,               -- 마지막 성공 시각
  last_fail_at    TIMESTAMPTZ,               -- 마지막 실패 시각
  auto_disabled   BOOLEAN NOT NULL DEFAULT FALSE, -- 자동 비활성화 여부
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 공급처들에 대해 기본 통계 행 초기화
INSERT INTO smm_provider_stats (id, total_attempts, success_count, fail_count, success_rate)
  SELECT id, 0, 0, 0, 100.00 FROM smm_providers
  ON CONFLICT (id) DO NOTHING;

-- RLS 정책: service_role은 전체 접근, anon은 읽기 불가
ALTER TABLE smm_provider_stats ENABLE ROW LEVEL SECURITY;

-- 서비스 롤은 모든 작업 가능 (Netlify function용)
CREATE POLICY IF NOT EXISTS "service_role_all_stats"
  ON smm_provider_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
