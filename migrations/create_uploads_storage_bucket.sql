-- Public uploads bucket for Studio reference images, generated frames, and video clips.
-- Runtime also auto-creates this bucket on first upload via lib/storage.ts;
-- run this SQL in the Supabase SQL editor for a durable / reproducible environment setup.

-- 1) Create the public bucket (no-op if it already exists)
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 52428800) -- 50 MB
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

-- 2) Public read access for anyone with the URL (needed by Replicate + UI <img>/<video>)
drop policy if exists "Public read uploads" on storage.objects;
create policy "Public read uploads"
on storage.objects
for select
to public
using (bucket_id = 'uploads');

-- 3) Service-role / authenticated writes (server uses the service role key)
drop policy if exists "Service role write uploads" on storage.objects;
create policy "Service role write uploads"
on storage.objects
for insert
to authenticated, service_role
with check (bucket_id = 'uploads');

drop policy if exists "Service role update uploads" on storage.objects;
create policy "Service role update uploads"
on storage.objects
for update
to authenticated, service_role
using (bucket_id = 'uploads')
with check (bucket_id = 'uploads');

drop policy if exists "Service role delete uploads" on storage.objects;
create policy "Service role delete uploads"
on storage.objects
for delete
to authenticated, service_role
using (bucket_id = 'uploads');
