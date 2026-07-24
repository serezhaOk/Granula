-- GRANULA — Supabase schema
-- Copyright © 2026 Sergei Diuzhev. All rights reserved.
--
-- Paste into: Supabase dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------- recordings
-- One row per user recording. The audio itself lives in Storage; this table is
-- the index (name, duration, path) so the library can render without downloading.
create table if not exists public.recordings (
  id           uuid        primary key,               -- generated on the client, so
                                                      -- local and cloud share one id
  user_id      uuid        not null references auth.users (id) on delete cascade,
  name         text        not null,
  duration     real        not null,
  size_bytes   bigint,
  storage_path text        not null,                  -- '{user_id}/{id}.wav'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists recordings_user_created_idx
  on public.recordings (user_id, created_at desc);

alter table public.recordings enable row level security;

-- Users touch only their own rows.
drop policy if exists "recordings_select_own" on public.recordings;
create policy "recordings_select_own" on public.recordings
  for select using (auth.uid() = user_id);

drop policy if exists "recordings_insert_own" on public.recordings;
create policy "recordings_insert_own" on public.recordings
  for insert with check (auth.uid() = user_id);

drop policy if exists "recordings_update_own" on public.recordings;
create policy "recordings_update_own" on public.recordings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recordings_delete_own" on public.recordings;
create policy "recordings_delete_own" on public.recordings
  for delete using (auth.uid() = user_id);

-- keep updated_at honest (renames sync across devices)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists recordings_touch_updated_at on public.recordings;
create trigger recordings_touch_updated_at
  before update on public.recordings
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------- storage
-- Private bucket; every object lives under the owner's user id folder.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- Path convention: {user_id}/{recording_id}.wav
-- foldername(name)[1] is the first path segment = the owner's uuid.
drop policy if exists "recordings_files_select_own" on storage.objects;
create policy "recordings_files_select_own" on storage.objects
  for select using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recordings_files_insert_own" on storage.objects;
create policy "recordings_files_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recordings_files_update_own" on storage.objects;
create policy "recordings_files_update_own" on storage.objects
  for update using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "recordings_files_delete_own" on storage.objects;
create policy "recordings_files_delete_own" on storage.objects
  for delete using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------- quota guard
-- Free tier is 1 GB of Storage total. A 30 s mono 44.1 kHz 16-bit WAV is ~2.6 MB,
-- so ~380 max-length recordings fill the whole plan. This caps rows per user.
-- Adjust MAX_PER_USER, or drop the trigger, once the storage plan is decided.
create or replace function public.enforce_recording_quota()
returns trigger language plpgsql security definer as $$
declare
  max_per_user constant int := 50;
  used int;
begin
  select count(*) into used from public.recordings where user_id = new.user_id;
  if used >= max_per_user then
    raise exception 'recording quota reached (% per account)', max_per_user
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists recordings_quota on public.recordings;
create trigger recordings_quota
  before insert on public.recordings
  for each row execute function public.enforce_recording_quota();
