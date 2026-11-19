begin;
-- Supports the current studio deployment, where the older member SNS tables
-- may not have been provisioned. Existing subscriptions and posts are retained.
create table if not exists public.content_social_connections (
 owner_id text not null, provider text not null check(provider in ('youtube','instagram','tiktok')),
 channel_id text not null, channel_name text not null, tokens jsonb not null,
 updated_at timestamptz not null default now(), primary key(owner_id,provider)
);
create table if not exists public.content_social_oauth (
 state_hash text primary key, owner_id text not null, cookie_hash text not null,
 verifier jsonb not null, expires_at timestamptz not null,
 provider text not null default 'youtube'
);
create table if not exists public.content_subscriptions (
 owner_id text primary key, plan text not null check(plan in ('starter','pro','business')),
 valid_until timestamptz not null, auto_upload_opt_in boolean not null default false,
 payment_reference text not null, updated_at timestamptz not null default now()
);
create table if not exists public.content_social_posts (
 id uuid primary key, owner_id text not null, chat_id uuid,
 provider text not null check(provider in ('youtube','instagram','tiktok')),
 channel_id text not null, result_path text not null, metadata jsonb not null,
 status text not null default 'queued' check(status in ('queued','running','uploaded','failed','needs_review')),
 session_url text, video_id text, privacy text, message text not null default '',
 updated_at timestamptz not null default now(), provider_publish_id text, public_url text,
 unique(owner_id,provider,result_path)
);
alter table public.content_social_posts alter column chat_id drop not null;
alter table public.content_social_posts add column if not exists request_id uuid references public.content_pixeling_requests(id);
alter table public.content_social_posts add constraint content_social_result_source check ((chat_id is not null)::int + (request_id is not null)::int = 1);
create index if not exists content_social_request on public.content_social_posts(request_id) where request_id is not null;
alter table public.content_social_connections enable row level security;
alter table public.content_social_oauth enable row level security;
alter table public.content_social_posts enable row level security;
alter table public.content_subscriptions enable row level security;
revoke all on public.content_social_connections,public.content_social_oauth,public.content_social_posts,public.content_subscriptions from public,anon,authenticated;
grant all on public.content_social_connections,public.content_social_oauth,public.content_social_posts,public.content_subscriptions to service_role;
commit;
