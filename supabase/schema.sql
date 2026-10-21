-- Firefighter Training Management profile foundation.
-- Run ONLY in a dedicated firefighter-management Supabase project, not an unrelated app.
create table if not exists public.firefighter_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'firefighter' check (role in ('admin','firefighter')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.firefighter_profiles enable row level security;
revoke all on public.firefighter_profiles from anon, authenticated;
grant select on public.firefighter_profiles to authenticated;
drop policy if exists "users can read own firefighter profile" on public.firefighter_profiles;
create policy "users can read own firefighter profile"
  on public.firefighter_profiles for select to authenticated
  using (id = (select auth.uid()));
-- No browser-side INSERT/UPDATE/DELETE policies are intentionally provided.
-- Account creation and role changes must go through a server-side admin-only function.
