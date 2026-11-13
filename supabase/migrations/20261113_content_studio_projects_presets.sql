begin;
create table public.content_studio_projects (
 id uuid primary key,
 owner_id text not null,
 title text not null check(length(title) between 1 and 100),
 created_at timestamptz not null default now()
);
alter table public.content_studio_projects enable row level security;
revoke all on public.content_studio_projects from public,anon,authenticated;
grant all on public.content_studio_projects to service_role;
alter table public.content_pixeling_requests add column project_id uuid references public.content_studio_projects(id);
create index on public.content_pixeling_requests(owner_id,project_id,created_at);
create table public.content_studio_presets (
 id uuid primary key,
 source_preset_id text unique,
 name text not null check(length(name) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 format text not null check(format in ('short','long')),
 private_prompt text not null check(length(private_prompt) between 1 and 20000),
 video_path text not null,
 video_size bigint not null check(video_size between 1 and 314572800),
 thumbnail_path text,
 thumbnail_size bigint,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.content_studio_presets enable row level security;
revoke all on public.content_studio_presets from public,anon,authenticated;
grant all on public.content_studio_presets to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('content-studio-presets','content-studio-presets',false,314572800,array['video/mp4','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
