-- ============================================================
-- ORNGlobal — Auth schema (hospitals + profiles)
-- Run this once in the Supabase SQL Editor for this project:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
-- ============================================================

-- 1. Hospitals table --------------------------------------------------
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.hospitals enable row level security;

-- Anyone (including signed-out visitors on the signup page) can read
-- the hospital list so the dropdown can populate.
create policy "Hospitals are publicly readable"
  on public.hospitals for select
  using (true);

-- Seed a starter list — edit/add rows in the Supabase Table Editor
-- (Table Editor > hospitals) whenever you need to add a hospital.
insert into public.hospitals (name) values
  ('General City Hospital'),
  ('St. Mary''s Medical Center'),
  ('Riverside Health Institute'),
  ('Northside Surgical Center'),
  ('University Teaching Hospital')
on conflict (name) do nothing;

-- 2. Profiles table -----------------------------------------------------
-- One row per authenticated user, linked 1:1 to auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  hospital_id uuid references public.hospitals (id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile.
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile.
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Auto-create a profile row whenever a new auth user signs up --------
-- The Signup page passes first_name, last_name and hospital_id as
-- auth "user metadata" (options.data in supabase.auth.signUp). This
-- trigger copies that metadata into public.profiles automatically,
-- so the frontend never needs to insert into profiles directly (which
-- RLS would otherwise block until the session is fully established).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email, hospital_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    nullif(new.raw_user_meta_data ->> 'hospital_id', '')::uuid
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
