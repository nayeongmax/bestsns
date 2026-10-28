begin;
create table public.content_social_connections (
 owner_id text not null,provider text not null check(provider='youtube'),channel_id text not null,channel_name text not null,
 tokens jsonb not null,updated_at timestamptz not null default now(),primary key(owner_id,provider)
);
create table public.content_social_oauth (
 state_hash text primary key,owner_id text not null,cookie_hash text not null,verifier jsonb not null,expires_at timestamptz not null
);
create table public.content_social_posts (
 id uuid primary key,owner_id text not null,chat_id uuid not null,provider text not null check(provider='youtube'),
 channel_id text not null,result_path text not null,metadata jsonb not null,status text not null default 'queued'
 check(status in ('queued','running','uploaded','failed','needs_review')),
 session_url text,video_id text,privacy text,message text not null default '',updated_at timestamptz not null default now(),
 unique(owner_id,provider,result_path),foreign key(chat_id,owner_id) references public.content_ai_chats(id,owner_id)
);
alter table public.content_social_connections enable row level security;
alter table public.content_social_oauth enable row level security;
alter table public.content_social_posts enable row level security;
revoke all on public.content_social_connections,public.content_social_oauth,public.content_social_posts from public,anon,authenticated;
grant all on public.content_social_connections,public.content_social_oauth,public.content_social_posts to service_role;
commit;
