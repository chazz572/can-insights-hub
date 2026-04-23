insert into storage.buckets (id, name, public)
values ('can-csv-uploads', 'can-csv-uploads', false)
on conflict (id) do nothing;

create table if not exists public.can_uploads (
  file_id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null unique,
  content_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

alter table public.can_uploads enable row level security;

create index if not exists idx_can_uploads_created_at on public.can_uploads (created_at desc);