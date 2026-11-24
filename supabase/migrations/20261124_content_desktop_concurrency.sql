begin;
alter table public.content_pixeling_requests add column desktop_slot integer not null default 1 check(desktop_slot between 1 and 3);
drop index public.content_desktop_one_active;
create unique index content_desktop_active_slot on public.content_pixeling_requests(desktop_worker_id,desktop_slot)
 where desktop_worker_id is not null and state='working';

-- All dispatchers share a short transaction lock: plan limits hold across PCs.
-- Existing working jobs keep their slot when limits are lowered; no cancellation.
create function public.content_desktop_claim_slot(worker uuid, slot integer, operator_after timestamptz default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare job public.content_pixeling_requests; display jsonb; plan_name text; plan_limit integer; pc_limit integer;
begin
 if slot not between 1 and 3 then raise exception 'INVALID_SLOT'; end if;
 perform pg_advisory_xact_lock(61124,1);
 perform 1 from content_desktop_workers where id=worker and not revoked and expires_at>now() for update;
 if not found then raise exception 'WORKER_UNAVAILABLE'; end if;
 select * into job from content_pixeling_requests where desktop_worker_id=worker and desktop_slot=slot and state='working' for update;
 if found then return to_jsonb(job); end if;
 select settings into display from content_ai_settings where owner_id='__content_studio_display__';
 pc_limit:=least(3,greatest(1,coalesce((display->>'workerConcurrency')::integer,3)));
 if slot>pc_limit or (select count(*) from content_pixeling_requests where desktop_worker_id=worker and state='working')>=pc_limit then return null; end if;
 for job in select r.* from content_pixeling_requests r
   where r.state='submitted' and r.desktop_worker_id is null
   and (operator_after is null or r.created_at>=operator_after)
   and (r.project_id is null or exists(select 1 from content_studio_projects p where p.id=r.project_id and p.deleted_at is null))
   order by r.created_at,r.id for update of r skip locked
 loop
   if operator_after is not null then plan_limit:=3;
   else
     select plan into plan_name from content_subscriptions where owner_id=job.owner_id and valid_until>now();
     if plan_name is null or plan_name not in ('starter','pro','business') then continue; end if;
     select (p->>'maxConcurrentJobs')::integer into plan_limit from jsonb_array_elements(display->'plans') p where p->>'id'=plan_name;
     plan_limit:=least(3,greatest(1,coalesce(plan_limit,case plan_name when 'starter' then 1 when 'pro' then 2 else 3 end)));
   end if;
   if (select count(*) from content_pixeling_requests where owner_id=job.owner_id and state='working')>=plan_limit then continue; end if;
   update content_pixeling_requests set desktop_worker_id=worker,desktop_slot=slot,desktop_stage='claimed',state='working',updated_at=now() where id=job.id returning * into job;
   return to_jsonb(job);
 end loop;
 return null;
end $$;
revoke all on function public.content_desktop_claim_slot(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.content_desktop_claim_slot(uuid,integer,timestamptz) to service_role;
-- Legacy clients may only occupy slot 1 and still observe plan limits.
create or replace function public.content_desktop_claim(worker uuid) returns jsonb
language sql security definer set search_path=public as $$select content_desktop_claim_slot(worker,1,null)$$;
commit;
