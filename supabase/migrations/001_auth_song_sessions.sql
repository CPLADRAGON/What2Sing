create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null,
  platform text not null default 'manual',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.picker_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'KTV picker session',
  order_mode text not null default 'ordered' check (order_mode in ('ordered', 'random')),
  songs jsonb not null default '[]'::jsonb,
  liked jsonb not null default '[]'::jsonb,
  skipped jsonb not null default '[]'::jsonb,
  current_index integer not null default 0 check (current_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.songs enable row level security;
alter table public.picker_sessions enable row level security;

create policy "Users can read own songs"
  on public.songs for select
  using (auth.uid() = user_id);

create policy "Users can insert own songs"
  on public.songs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own songs"
  on public.songs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own songs"
  on public.songs for delete
  using (auth.uid() = user_id);

create policy "Users can read own picker sessions"
  on public.picker_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own picker sessions"
  on public.picker_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own picker sessions"
  on public.picker_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own picker sessions"
  on public.picker_sessions for delete
  using (auth.uid() = user_id);

create index if not exists songs_user_id_created_at_idx on public.songs(user_id, created_at desc);
create index if not exists picker_sessions_user_id_updated_at_idx on public.picker_sessions(user_id, updated_at desc);
