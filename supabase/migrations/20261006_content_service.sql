create table if not exists public.content_service_requests (
 id uuid primary key default gen_random_uuid(), owner_id text not null,
 status text not null check(status in ('uploading','submitted','quoted','approved','producing','completed')),
 details jsonb not null, assets jsonb not null default '[]', results jsonb not null default '[]',
 quote_credits integer check(quote_credits>0), quote_note text,
 quote_version integer not null default 0, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.content_service_requests enable row level security;
revoke all on public.content_service_requests from anon,authenticated;
grant all on public.content_service_requests to service_role;
create index if not exists content_service_owner_created on public.content_service_requests(owner_id,created_at desc);
-- Uses the private content-test bucket created by 20261006_content_test.sql.
-- Credits are on hold: approval records the exact quotation but does not debit a wallet.
