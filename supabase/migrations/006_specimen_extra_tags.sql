-- Custom category tags (Lucky, etc.) stored on specimens.

alter table public.specimens add column if not exists extra_tags text[] not null default '{}';
