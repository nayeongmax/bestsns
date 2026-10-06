-- Review/apply in the existing Supabase project after deploying server admin APIs.
create or replace function public.security_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id::text=auth.uid()::text and role='admin');
$$;
revoke all on function public.security_is_admin() from public;
grant execute on function public.security_is_admin() to authenticated;

create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'')='service_role' or session_user='postgres' and auth.uid() is null then return new; end if;
  if (tg_op='INSERT' and coalesce(new.role,'user') <> 'user') or
     (tg_op='UPDATE' and new.role is distinct from old.role) then
    if not public.security_is_admin() then raise exception 'Role changes require administrator authorization'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists security_guard_profile_role on public.profiles;
create trigger security_guard_profile_role before insert or update on public.profiles
for each row execute function public.guard_profile_role();

-- Earlier setup scripts disabled store_products RLS. Re-enable and replace permissive policies.
alter table public.store_products enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='store_products' loop
    execute format('drop policy %I on public.store_products',p.policyname);
  end loop;
end; $$;
create policy store_public_read on public.store_products for select to anon,authenticated
using(status='approved' and coalesce(is_secret,false)=false);
create policy store_owner_read on public.store_products for select to authenticated
using(author_id=auth.uid()::text or public.security_is_admin());
-- Writes go through store-seller/store-admin; never allow an anon frontend to approve products.
revoke insert,update,delete on public.store_products from anon,authenticated;
grant select on public.store_products to anon,authenticated;
grant all on public.store_products to service_role;

-- Remove browser access to legacy administrator SECURITY DEFINER RPCs, if installed.
do $$ declare p record; begin
  for p in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('admin_get_withdrawals','admin_complete_withdrawal','admin_fail_withdrawal') loop
    execute format('revoke all on function %s from public,anon,authenticated',p.signature);
    execute format('grant execute on function %s to service_role',p.signature);
  end loop;
end; $$;
