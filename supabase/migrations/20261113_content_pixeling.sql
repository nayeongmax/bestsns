begin;
create table public.content_pixeling_requests (
 id uuid primary key,
 owner_id text not null,
 preset_id text not null,
 preset_name text not null,
 preset_version integer not null,
 text text not null check(length(text) between 1 and 5000),
 parent_id uuid references public.content_pixeling_requests(id),
 state text not null default 'submitted' check(state in ('submitted','working','completed','failed')),
 result_path text,
 result_size bigint,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index on public.content_pixeling_requests(owner_id,created_at desc);
alter table public.content_pixeling_requests enable row level security;
revoke all on public.content_pixeling_requests from public,anon,authenticated;
grant all on public.content_pixeling_requests to service_role;
commit;
