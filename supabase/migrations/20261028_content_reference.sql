-- Private operator reference only; existing RLS/revokes remain in effect.
alter table public.content_video_presets add column if not exists reference jsonb;
