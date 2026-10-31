create table public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- New public tables require explicit Data API grants; authenticated is the only granted role.
revoke all on table public.notes from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

create policy "Authenticated users can read their own notes"
  on public.notes for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Authenticated users can create their own notes"
  on public.notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Authenticated users can update their own notes"
  on public.notes for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Authenticated users can delete their own notes"
  on public.notes for delete to authenticated
  using ((select auth.uid()) = owner_id);
