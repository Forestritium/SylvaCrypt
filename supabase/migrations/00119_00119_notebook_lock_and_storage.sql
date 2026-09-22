
-- Add write-lock columns to shared_notebooks
alter table shared_notebooks
  add column if not exists locked_by uuid references auth.users(id) on delete set null,
  add column if not exists locked_at timestamptz;

comment on column shared_notebooks.locked_by is 'User currently holding the write lock (null = no lock)';
comment on column shared_notebooks.locked_at is 'Timestamp when the write lock was acquired';

-- Create a storage bucket for notebook file attachments (private, access via RLS)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notebook-attachments',
  'notebook-attachments',
  false,
  52428800, -- 50 MB per file
  array[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/avif',
    'video/mp4','video/webm','video/ogg','video/quicktime',
    'audio/mpeg','audio/ogg','audio/wav','audio/webm',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain','text/csv','text/markdown',
    'application/zip','application/x-zip-compressed',
    'application/json'
  ]
)
on conflict (id) do nothing;

-- RLS: only authenticated users can upload to notebook-attachments
create policy "Auth users can upload notebook attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'notebook-attachments');

create policy "Auth users can read notebook attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'notebook-attachments');

create policy "Auth users can delete own notebook attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'notebook-attachments' and owner = auth.uid());
