-- Category look: stored emoji and font color, used on tracks and labels.

alter table public.categories add column if not exists emoji text;
alter table public.categories add column if not exists label_color text;
