begin;
create table if not exists public.content_ai_credentials (
 owner_id text primary key, encrypted_key jsonb not null, key_hint text not null,
 models jsonb not null default '[]', verified_at timestamptz not null default now()
);
create table if not exists public.content_ai_settings (
 owner_id text primary key, settings jsonb not null default '{}'
);
create table if not exists public.content_ai_projects (
 id uuid primary key default gen_random_uuid(), owner_id text not null, name text not null,
 created_at timestamptz not null default now(), unique(id,owner_id)
);
create table if not exists public.content_ai_chats (
 id uuid primary key default gen_random_uuid(), owner_id text not null, project_id uuid not null,
 title text not null, status text not null default 'idle' check(status in ('idle','queued','running','failed')),
 messages jsonb not null default '[]', assets jsonb not null default '[]', results jsonb not null default '[]',
 updated_at timestamptz not null default now(), unique(id,owner_id),
 foreign key(project_id,owner_id) references public.content_ai_projects(id,owner_id)
);
create table if not exists public.content_ai_jobs (
 id uuid primary key default gen_random_uuid(), owner_id text not null, chat_id uuid not null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 snapshot jsonb not null, message text not null default '', response_id text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(chat_id,owner_id) references public.content_ai_chats(id,owner_id)
);
create unique index if not exists content_ai_one_active_job on public.content_ai_jobs(chat_id) where status in ('queued','running');
create index if not exists content_ai_chats_owner_updated on public.content_ai_chats(owner_id,updated_at desc);
alter table public.content_ai_credentials enable row level security;
alter table public.content_ai_settings enable row level security;
alter table public.content_ai_projects enable row level security;
alter table public.content_ai_chats enable row level security;
alter table public.content_ai_jobs enable row level security;
revoke all on public.content_ai_credentials,public.content_ai_settings,public.content_ai_projects,public.content_ai_chats,public.content_ai_jobs from anon,authenticated;
grant all on public.content_ai_credentials,public.content_ai_settings,public.content_ai_projects,public.content_ai_chats,public.content_ai_jobs to service_role;
create or replace function public.finish_content_ai_job(p_job uuid,p_owner text,p_results jsonb,p_message jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.content_ai_jobs;
begin
 select * into job from public.content_ai_jobs where id=p_job and owner_id=p_owner for update;
 if not found or job.status<>'running' then return false; end if;
 if jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)<1 then raise exception 'Missing results'; end if;
 perform 1 from public.content_ai_chats where id=job.chat_id and owner_id=p_owner for update;
 update public.content_ai_chats set status='idle',messages=messages||jsonb_build_array(p_message),results=results||p_results,updated_at=now() where id=job.chat_id and owner_id=p_owner;
 update public.content_ai_jobs set status='completed',message='완성 파일 저장 완료',updated_at=now() where id=p_job;
 return true;
end;
$$;
revoke all on function public.finish_content_ai_job(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finish_content_ai_job(uuid,text,jsonb,jsonb) to service_role;
commit;
