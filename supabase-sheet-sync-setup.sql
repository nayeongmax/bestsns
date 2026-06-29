-- SNS 수집 시트 동기화 테이블
create table if not exists sheet_sync (
  code        text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 30일 이상 된 데이터 자동 정리 (선택사항)
-- create index if not exists sheet_sync_updated_at_idx on sheet_sync(updated_at);
