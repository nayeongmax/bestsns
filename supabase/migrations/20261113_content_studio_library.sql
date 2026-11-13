begin;
alter table public.content_pixeling_requests add column reference_result_id uuid references public.content_pixeling_requests(id);
alter table public.content_studio_projects add column deleted_at timestamptz;
alter table public.content_pixeling_requests add column result_deleted_at timestamptz;
create table public.content_studio_personal_presets (
 id uuid primary key,
 owner_id text not null,
 request_id uuid not null references public.content_pixeling_requests(id),
 name text not null check(length(name) between 1 and 100),
 format text not null check(format in ('short','long')),
 created_at timestamptz not null default now(),
 unique(owner_id,request_id)
);
alter table public.content_studio_personal_presets enable row level security;
revoke all on public.content_studio_personal_presets from public,anon,authenticated;
grant all on public.content_studio_personal_presets to service_role;
commit;
