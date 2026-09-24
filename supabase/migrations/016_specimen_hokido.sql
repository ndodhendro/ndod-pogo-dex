-- Exact IV 88. Same kind of flag as hundo and nundo.

alter table public.specimens add column if not exists hokido boolean not null default false;
