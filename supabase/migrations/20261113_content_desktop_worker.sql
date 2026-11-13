begin;
create table public.content_desktop_workers (
 id uuid primary key, name text not null check(length(name) between 1 and 80),
 token_hash text not null, revoked boolean not null default false,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 days',
 last_seen_at timestamptz
);
alter table public.content_desktop_workers enable row level security;
revoke all on public.content_desktop_workers from public,anon,authenticated;
grant all on public.content_desktop_workers to service_role;
alter table public.content_pixeling_requests
 add column desktop_worker_id uuid references public.content_desktop_workers(id),
 add column desktop_stage text,
 add column desktop_thread_id text,
 add column result_sha256 text;
create unique index content_desktop_one_active on public.content_pixeling_requests(desktop_worker_id)
 where desktop_worker_id is not null and state='working';
create function public.content_desktop_claim(worker uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare job public.content_pixeling_requests;
begin
 perform 1 from content_desktop_workers where id=worker and not revoked and expires_at>now() for update;
 if not found then raise exception 'WORKER_UNAVAILABLE'; end if;
 select * into job from content_pixeling_requests where desktop_worker_id=worker and state='working' limit 1 for update;
 if found then return to_jsonb(job); end if;
 select * into job from content_pixeling_requests where state='submitted' and desktop_worker_id is null order by created_at limit 1 for update skip locked;
 if not found then return null; end if;
 update content_pixeling_requests set desktop_worker_id=worker,desktop_stage='claimed',state='working',updated_at=now() where id=job.id returning * into job;
 return to_jsonb(job);
end $$;
revoke all on function public.content_desktop_claim(uuid) from public,anon,authenticated;
grant execute on function public.content_desktop_claim(uuid) to service_role;
commit;
