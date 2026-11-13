begin;
alter table public.content_pixeling_requests add column attachments jsonb not null default '[]'::jsonb;
alter table public.content_pixeling_requests add column progress_events jsonb not null default '[]'::jsonb;
alter table public.content_pixeling_requests drop constraint content_pixeling_requests_state_check;
alter table public.content_pixeling_requests add constraint content_pixeling_requests_state_check check(state in ('uploading','submitted','working','completed','failed'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('content-studio-input','content-studio-input',false,104857600,array['video/mp4','video/quicktime','video/webm','image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;

