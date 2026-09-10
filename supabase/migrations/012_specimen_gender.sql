-- Male / Female / Hisuian Male, etc. Null when the Gender tag is off.

alter table public.specimens add column if not exists gender text;
