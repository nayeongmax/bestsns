begin;
create table public.content_subscriptions (
 owner_id text primary key,plan text not null check(plan in ('starter','pro','business')),
 valid_until timestamptz not null,auto_upload_opt_in boolean not null default false,
 payment_reference text not null,updated_at timestamptz not null default now()
);
alter table public.content_subscriptions enable row level security;
revoke all on public.content_subscriptions from public,anon,authenticated;
grant all on public.content_subscriptions to service_role;
alter table public.content_social_connections drop constraint content_social_connections_provider_check;
alter table public.content_social_connections add check(provider in ('youtube','instagram','tiktok'));
alter table public.content_social_posts drop constraint content_social_posts_provider_check;
alter table public.content_social_posts add check(provider in ('youtube','instagram','tiktok'));
alter table public.content_social_posts add column provider_publish_id text, add column public_url text;
alter table public.content_social_oauth add column provider text not null default 'youtube';
commit;
