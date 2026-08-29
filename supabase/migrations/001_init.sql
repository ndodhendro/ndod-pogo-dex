-- Optional cloud schema for later sync. The PWA uses on-device IndexedDB
-- as the working collection. Env may only contain SUPABASE_URL and SUPABASE_ANON_KEY.

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  required_tags text[] not null default '{}',
  sort_order int not null default 0,
  seed boolean not null default false
);

create table if not exists public.specimens (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id int not null,
  form text,
  shiny boolean not null default false,
  shadow_status text not null default 'none',
  costume text,
  background text,
  hundo boolean not null default false,
  nundo boolean not null default false,
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.covers (
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  species_id int not null,
  specimen_id uuid not null references public.specimens (id) on delete cascade,
  primary key (user_id, category_id, species_id)
);

alter table public.categories enable row level security;
alter table public.specimens enable row level security;
alter table public.covers enable row level security;

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own specimens" on public.specimens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own covers" on public.covers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
