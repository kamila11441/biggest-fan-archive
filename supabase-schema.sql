-- Biggest Fan Archive — Supabase schema
-- Run this in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.archive_content (
  id boolean primary key default true check (id = true),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.archive_content (id, content) values (true, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists public.archive_comments (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 1 and 32),
  message text not null check (char_length(message) between 1 and 240),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.archive_content enable row level security;
alter table public.archive_comments enable row level security;

-- Anyone can read published content. Only authenticated admins can update it.
drop policy if exists "Public can read archive content" on public.archive_content;
create policy "Public can read archive content" on public.archive_content for select using (true);
drop policy if exists "Authenticated admins update archive content" on public.archive_content;
create policy "Authenticated admins update archive content" on public.archive_content for update to authenticated using (true) with check (true);

-- Visitors can submit comments; only approved comments are publicly readable.
drop policy if exists "Public can read approved comments" on public.archive_comments;
create policy "Public can read approved comments" on public.archive_comments for select using (approved = true);
drop policy if exists "Visitors can submit comments for moderation" on public.archive_comments;
create policy "Visitors can submit comments for moderation" on public.archive_comments for insert to anon, authenticated with check (approved = false);
-- Admin moderation is authenticated-only. Do not grant anonymous update/delete.
drop policy if exists "Authenticated admins moderate comments" on public.archive_comments;
create policy "Authenticated admins moderate comments" on public.archive_comments for all to authenticated using (true) with check (true);

-- Restrict browser API grants to the intended operations.
grant select on public.archive_content to anon, authenticated;
grant update on public.archive_content to authenticated;
grant select, insert on public.archive_comments to anon, authenticated;
grant update, delete on public.archive_comments to authenticated;

-- Photo journal uploads: public can view photos; signed-in admins can manage them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'archive-photos',
  'archive-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view archive photos" on storage.objects;
create policy "Public can view archive photos" on storage.objects
for select to anon, authenticated using (bucket_id = 'archive-photos');

drop policy if exists "Admins upload archive photos" on storage.objects;
create policy "Admins upload archive photos" on storage.objects
for insert to authenticated
with check (bucket_id = 'archive-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins update archive photos" on storage.objects;
create policy "Admins update archive photos" on storage.objects
for update to authenticated
using (bucket_id = 'archive-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'archive-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins delete archive photos" on storage.objects;
create policy "Admins delete archive photos" on storage.objects
for delete to authenticated
using (bucket_id = 'archive-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
