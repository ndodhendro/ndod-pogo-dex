-- Manual "Mark as not Pure". Not a tag; exact tags still stay gray.

alter table public.specimens add column if not exists not_pure boolean not null default false;
