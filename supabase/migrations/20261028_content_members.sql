begin;
create table public.content_video_presets (
 id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
 prompt text not null, sample jsonb, price integer check(price>0 and price<=1000000),
 revision_price integer check(revision_price>0 and revision_price<=1000000),
 published boolean not null default false, updated_at timestamptz not null default now()
);
create table public.content_wallets (owner_id text primary key, balance bigint not null default 0 check(balance>=0));
create table public.content_credit_ledger (
 id uuid primary key default gen_random_uuid(), owner_id text not null, amount bigint not null,
 reference text not null unique, created_at timestamptz not null default now()
);
alter table public.content_ai_chats add column member boolean not null default false, add column preset_id uuid references public.content_video_presets(id);
alter table public.content_ai_jobs add column charge integer,
 add column billing_state text check(billing_state in ('charged','refunded')),
 add column parent_job_id uuid references public.content_ai_jobs(id);
alter table public.content_video_presets enable row level security;
alter table public.content_wallets enable row level security;
alter table public.content_credit_ledger enable row level security;
revoke all on public.content_video_presets,public.content_wallets,public.content_credit_ledger from public,anon,authenticated;
grant all on public.content_video_presets,public.content_wallets,public.content_credit_ledger to service_role;

-- Called only by the authenticated server. Price, ownership, charge and enqueue share a transaction.
create function public.enqueue_paid_content_job(p_id uuid,p_owner text,p_chat uuid,p_preset uuid,p_version timestamptz,p_expected integer,p_parent uuid,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare preset public.content_video_presets; chat public.content_ai_chats; prior public.content_ai_jobs; cost integer; remaining bigint; old public.content_ai_jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.content_ai_jobs where id=p_id;
 if found then
  if old.owner_id<>p_owner or old.chat_id<>p_chat then raise exception 'REQUEST_CONFLICT'; end if;
  return jsonb_build_object('id',old.id,'created',false,'amount',old.charge);
 end if;
 select * into chat from public.content_ai_chats where id=p_chat and owner_id=p_owner for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 if chat.preset_id is distinct from p_preset then raise exception 'PRESET_UNAVAILABLE'; end if;
 if chat.status not in ('idle','failed') then raise exception 'JOB_ACTIVE'; end if;
 select * into preset from public.content_video_presets where id=p_preset and published for share;
 if not found or preset.sample is null or length(trim(preset.prompt))=0 then raise exception 'PRESET_UNAVAILABLE'; end if;
 if p_parent is not null then
  select * into prior from public.content_ai_jobs where id=p_parent and chat_id=p_chat and owner_id=p_owner and status='completed';
  if not found or prior.snapshot->>'presetId'<>p_preset::text then raise exception 'INVALID_PARENT'; end if;
  cost:=preset.revision_price;
 else
  if jsonb_array_length(chat.results)>0 then raise exception 'PARENT_REQUIRED'; end if;
  cost:=preset.price;
 end if;
 if cost is null or cost<=0 or cost is distinct from p_expected or preset.updated_at<>p_version then raise exception 'PRICE_CHANGED'; end if;
 if jsonb_array_length(chat.assets)=0 then raise exception 'MISSING_SOURCE'; end if;
 update public.content_wallets set balance=balance-cost where owner_id=p_owner and balance>=cost returning balance into remaining;
 if not found then raise exception 'INSUFFICIENT_CREDITS'; end if;
 insert into public.content_credit_ledger(owner_id,amount,reference) values(p_owner,-cost,'job:'||p_id);
 insert into public.content_ai_jobs(id,owner_id,chat_id,snapshot,charge,billing_state,parent_job_id)
 values(p_id,p_owner,p_chat,p_snapshot||jsonb_build_object('member',true,'presetId',p_preset,'policy',jsonb_build_object('instructionsEnabled',true,'instructions',preset.prompt,'qualityMode','high')),cost,'charged',p_parent);
 update public.content_ai_chats set status='queued',updated_at=now(),
  title=case when title='새 제작 대화' then preset.name else title end,
  messages=messages||jsonb_build_array(jsonb_build_object('id',p_id,'role','user','text',p_snapshot->>'text','createdAt',now()))
 where id=p_chat;
 return jsonb_build_object('id',p_id,'created',true,'amount',cost,'balance',remaining);
end; $$;

create function public.fail_paid_content_job(p_job uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.content_ai_jobs;
begin
 select * into job from public.content_ai_jobs where id=p_job for update;
 if not found or job.charge is null or job.status='completed' or job.billing_state='refunded' then return false; end if;
 insert into public.content_credit_ledger(owner_id,amount,reference) values(job.owner_id,job.charge,'refund:'||job.id);
 update public.content_wallets set balance=balance+job.charge where owner_id=job.owner_id;
 update public.content_ai_jobs set status='failed',billing_state='refunded',message='제작이 완료되지 않아 크레딧을 돌려드렸습니다.',updated_at=now() where id=p_job;
 update public.content_ai_chats set status='failed',updated_at=now() where id=job.chat_id and owner_id=job.owner_id;
 return true;
end; $$;

-- Manual verified-payment credits; no client can mint a balance. Reference is idempotent.
create function public.grant_content_credits(p_owner text,p_amount integer,p_reference text)
returns bigint language plpgsql security definer set search_path=public as $$
declare remaining bigint; inserted integer;
begin
 if p_amount<=0 or p_amount>1000000 or length(p_reference)<8 then raise exception 'INVALID_GRANT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_reference,1));
 if exists(select 1 from public.content_credit_ledger where reference='payment:'||p_reference and (owner_id<>p_owner or amount<>p_amount)) then raise exception 'REFERENCE_CONFLICT'; end if;
 insert into public.content_credit_ledger(owner_id,amount,reference) values(p_owner,p_amount,'payment:'||p_reference) on conflict(reference) do nothing;
 get diagnostics inserted=row_count;
 if inserted>0 then insert into public.content_wallets(owner_id,balance) values(p_owner,p_amount) on conflict(owner_id) do update set balance=content_wallets.balance+excluded.balance; end if;
 select balance into remaining from public.content_wallets where owner_id=p_owner;
 return remaining;
end; $$;
revoke all on function public.enqueue_paid_content_job(uuid,text,uuid,uuid,timestamptz,integer,uuid,jsonb),public.fail_paid_content_job(uuid),public.grant_content_credits(text,integer,text) from public,anon,authenticated;
grant execute on function public.enqueue_paid_content_job(uuid,text,uuid,uuid,timestamptz,integer,uuid,jsonb),public.fail_paid_content_job(uuid),public.grant_content_credits(text,integer,text) to service_role;
commit;
