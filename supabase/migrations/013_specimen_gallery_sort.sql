-- Species gallery card order. Null keeps newest-first by created_at.

alter table public.specimens add column if not exists gallery_sort int;
