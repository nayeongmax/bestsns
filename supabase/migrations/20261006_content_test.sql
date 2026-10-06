create table if not exists public.content_test_orders (
  id uuid primary key default gen_random_uuid(), owner_id text not null,
  kind text not null check(kind in ('video','cards')),
  status text not null check(status in ('uploading','queued','running','completed','failed')),
  settings jsonb not null, assets jsonb not null default '[]', results jsonb not null default '[]',
  message text, worker_id text, claim_token uuid, started_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.content_test_orders enable row level security;
revoke all on public.content_test_orders from anon, authenticated;
grant all on public.content_test_orders to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('content-test','content-test',false,524288000,array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create or replace function public.claim_content_test(p_worker text)
returns setof public.content_test_orders language plpgsql security definer set search_path=public as $$
begin
  return query update public.content_test_orders set status='running',worker_id=p_worker,claim_token=gen_random_uuid(),started_at=now(),updated_at=now(),message='픽셀링 제작 중'
  where id=(select id from public.content_test_orders where status='queued' order by created_at for update skip locked limit 1) returning *;
end; $$;
revoke all on function public.claim_content_test(text) from public,anon,authenticated;
grant execute on function public.claim_content_test(text) to service_role;
