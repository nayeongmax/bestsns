begin;
alter table public.content_video_presets add column video_format text not null default 'short' check(video_format in ('short','long')),
 add column production_settings jsonb not null default '{}',add column analysis jsonb,
 add column analysis_status text not null default 'none' check(analysis_status in ('none','queued','running','completed','failed'));
create or replace function public.enqueue_paid_content_job(p_id uuid,p_owner text,p_chat uuid,p_preset uuid,p_version timestamptz,p_expected integer,p_parent uuid,p_snapshot jsonb)
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
 values(p_id,p_owner,p_chat,p_snapshot||jsonb_build_object('member',true,'presetId',p_preset,'format',preset.video_format,'productionSettings',preset.production_settings,'policy',jsonb_build_object('instructionsEnabled',true,'instructions',preset.prompt,'qualityMode','high')),cost,'charged',p_parent);
 update public.content_ai_chats set status='queued',updated_at=now(),
  title=case when title='새 제작 대화' then preset.name else title end,
  messages=messages||jsonb_build_array(jsonb_build_object('id',p_id,'role','user','text',p_snapshot->>'text','createdAt',now()))
 where id=p_chat;
 return jsonb_build_object('id',p_id,'created',true,'amount',cost,'balance',remaining);
end; $$;

commit;
