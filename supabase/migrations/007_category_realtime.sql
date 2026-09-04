-- Category rows are small metadata; devices subscribe so a new track shows without Restore.

do $$
begin
  alter publication supabase_realtime add table public.categories;
exception
  when duplicate_object then null;
end $$;
