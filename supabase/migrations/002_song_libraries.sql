create table if not exists public.song_libraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  songs jsonb not null default '[]'::jsonb,
  batches jsonb not null default '[]'::jsonb,
  picked_songs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.song_libraries enable row level security;

create policy "Users can read own library"
  on public.song_libraries for select
  using (auth.uid() = user_id);

create policy "Users can insert own library"
  on public.song_libraries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own library"
  on public.song_libraries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own library"
  on public.song_libraries for delete
  using (auth.uid() = user_id);

create index if not exists song_libraries_user_id_idx on public.song_libraries(user_id);
