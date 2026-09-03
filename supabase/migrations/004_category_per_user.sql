-- Seed tracks used one global UUID per category. Upsert then tried to update
-- another account's row and RLS USING blocked it. Own rows per user instead.

do $$
declare
  rec record;
begin
  for rec in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'covers'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) like '%category_id%'
      and pg_get_constraintdef(con.oid) like '%categories%'
  loop
    execute format('alter table public.covers drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.categories drop constraint if exists categories_pkey;

alter table public.categories add primary key (user_id, id);

alter table public.covers
  add constraint covers_category_user_fkey
  foreign key (user_id, category_id)
  references public.categories (user_id, id)
  on delete cascade;
