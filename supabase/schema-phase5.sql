-- ============================================================
-- ORNGlobal — Phase 5: multi-hospital accounts
-- Run this once in the Supabase SQL Editor, AFTER schema-phase4.sql:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
--
-- What this changes:
--   - A single account can now belong to MULTIPLE hospitals (via a new
--     user_hospitals join table) instead of exactly one
--     (profiles.hospital_id is kept around as the "home"/signup
--     hospital for backwards compatibility, but is no longer what RLS
--     checks against).
--   - Anyone (including signed-out visitors on the Signup page) can
--     create a brand-new hospital from the "+ Add new hospital" option.
--   - Every existing RLS policy that compared a row's hospital_id to
--     the caller's single hospital (via user_hospital_id()) is
--     rewritten to check hospital MEMBERSHIP instead
--     (is_hospital_member()), so a user only ever sees/acts on data
--     that belongs to a hospital they're currently a member of.
-- ============================================================

-- 1. user_hospitals join table -----------------------------------------
create table if not exists public.user_hospitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  hospital_id uuid not null references public.hospitals (id),
  created_at timestamptz not null default now(),
  unique (user_id, hospital_id)
);

alter table public.user_hospitals enable row level security;

drop policy if exists "Users can view their own hospital memberships" on public.user_hospitals;
create policy "Users can view their own hospital memberships"
  on public.user_hospitals for select
  using (user_id = auth.uid());

drop policy if exists "Users can join a hospital" on public.user_hospitals;
create policy "Users can join a hospital"
  on public.user_hospitals for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can leave a hospital" on public.user_hospitals;
create policy "Users can leave a hospital"
  on public.user_hospitals for delete
  using (user_id = auth.uid());

-- Never allow a user to leave their very last hospital — the app
-- always needs an active hospital to work in.
create or replace function public.prevent_removing_last_hospital()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (select count(*) from public.user_hospitals where user_id = old.user_id) <= 1 then
    raise exception 'You must belong to at least one hospital — join another before leaving this one.';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_removing_last_hospital on public.user_hospitals;
create trigger prevent_removing_last_hospital
  before delete on public.user_hospitals
  for each row execute procedure public.prevent_removing_last_hospital();

-- 2. Membership + colleague-visibility helper functions -----------------
create or replace function public.is_hospital_member(
  p_hospital_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_hospitals
    where hospital_id = p_hospital_id and user_id = p_user_id
  );
$$;

-- True if the caller shares at least one hospital with p_user_id —
-- used so colleagues at ANY shared hospital remain visible to each
-- other (for the "share this case" picker), even though accounts can
-- now belong to several hospitals.
create or replace function public.shares_hospital_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_hospitals a
    join public.user_hospitals b on a.hospital_id = b.hospital_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- 3. Let anyone create a new hospital (Signup's "+ Add new hospital",
--    and the Profile page's "join/create a hospital") ------------------
drop policy if exists "Anyone can add a hospital" on public.hospitals;
create policy "Anyone can add a hospital"
  on public.hospitals for insert
  with check (true);

-- 4. Extend the signup trigger to also create the membership row --------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_hospital_id uuid := nullif(new.raw_user_meta_data ->> 'hospital_id', '')::uuid;
begin
  insert into public.profiles (id, first_name, last_name, email, hospital_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    v_hospital_id
  );

  if v_hospital_id is not null then
    insert into public.user_hospitals (user_id, hospital_id)
    values (new.id, v_hospital_id)
    on conflict (user_id, hospital_id) do nothing;
  end if;

  return new;
end;
$$;

-- 5. Backfill existing accounts' single hospital into the join table ----
insert into public.user_hospitals (user_id, hospital_id)
select id, hospital_id from public.profiles
where hospital_id is not null
on conflict (user_id, hospital_id) do nothing;

-- 6. Rewrite every policy that gated on the old single-hospital
--    equality (hospital_id = user_hospital_id()) to check membership
--    instead (is_hospital_member(hospital_id)). ---------------------------

-- profiles: colleague visibility, now "shares a hospital with me"
-- instead of "has the same single hospital as me".
drop policy if exists "Hospital members can view colleague profiles" on public.profiles;
create policy "Hospital members can view colleague profiles"
  on public.profiles for select
  using (public.shares_hospital_with(id));

-- specialties
drop policy if exists "Hospital members can view specialties" on public.specialties;
create policy "Hospital members can view specialties"
  on public.specialties for select
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can add specialties" on public.specialties;
create policy "Hospital members can add specialties"
  on public.specialties for insert
  with check (public.is_hospital_member(hospital_id));

-- procedures
drop policy if exists "Hospital members can view procedures" on public.procedures;
create policy "Hospital members can view procedures"
  on public.procedures for select
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can add procedures" on public.procedures;
create policy "Hospital members can add procedures"
  on public.procedures for insert
  with check (public.is_hospital_member(hospital_id));

-- surgeons
drop policy if exists "Hospital members can view surgeons" on public.surgeons;
create policy "Hospital members can view surgeons"
  on public.surgeons for select
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can add surgeons" on public.surgeons;
create policy "Hospital members can add surgeons"
  on public.surgeons for insert
  with check (public.is_hospital_member(hospital_id));

-- surgical_cases
drop policy if exists "Hospital members can view cases" on public.surgical_cases;
create policy "Hospital members can view cases"
  on public.surgical_cases for select
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can create cases" on public.surgical_cases;
create policy "Hospital members can create cases"
  on public.surgical_cases for insert
  with check (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can update cases" on public.surgical_cases;
create policy "Hospital members can update cases"
  on public.surgical_cases for update
  using (public.is_hospital_member(hospital_id));

-- case_custom_fields
drop policy if exists "Hospital members can view custom fields" on public.case_custom_fields;
create policy "Hospital members can view custom fields"
  on public.case_custom_fields for select
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can manage custom fields" on public.case_custom_fields;
create policy "Hospital members can manage custom fields"
  on public.case_custom_fields for insert
  with check (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can update custom fields" on public.case_custom_fields;
create policy "Hospital members can update custom fields"
  on public.case_custom_fields for update
  using (public.is_hospital_member(hospital_id));
drop policy if exists "Hospital members can delete custom fields" on public.case_custom_fields;
create policy "Hospital members can delete custom fields"
  on public.case_custom_fields for delete
  using (public.is_hospital_member(hospital_id));

-- case_files (select stayed "Hospital members can view case files"
-- since phase2; insert/update/delete were renamed to "Editors can…" in
-- phase3 — rewrite all four here).
drop policy if exists "Hospital members can view case files" on public.case_files;
create policy "Hospital members can view case files"
  on public.case_files for select
  using (public.is_hospital_member(hospital_id));

drop policy if exists "Editors can add case files" on public.case_files;
create policy "Editors can add case files"
  on public.case_files for insert
  with check (
    public.is_hospital_member(hospital_id)
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

drop policy if exists "Editors can update case file rows" on public.case_files;
create policy "Editors can update case file rows"
  on public.case_files for update
  using (
    public.is_hospital_member(hospital_id)
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

drop policy if exists "Editors can delete case file rows" on public.case_files;
create policy "Editors can delete case file rows"
  on public.case_files for delete
  using (
    public.is_hospital_member(hospital_id)
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

-- case_shares
drop policy if exists "Hospital members can view shares" on public.case_shares;
create policy "Hospital members can view shares"
  on public.case_shares for select
  using (public.is_hospital_member(hospital_id));

drop policy if exists "Case creator can add shares" on public.case_shares;
create policy "Case creator can add shares"
  on public.case_shares for insert
  with check (
    public.is_hospital_member(hospital_id)
    and exists (
      select 1 from public.surgical_cases c
      where c.id = case_id and c.created_by = auth.uid()
    )
    and public.is_hospital_member(hospital_id, user_id)
  );

-- (update/remove policies already only check case ownership — unchanged)

-- storage.objects — paths are "{hospital_id}/{case_id}/{filename}"
drop policy if exists "Downloaders can read case attachments" on storage.objects;
create policy "Downloaders can read case attachments"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and public.is_hospital_member(((storage.foldername(name))[1])::uuid)
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('download', 'edit', 'approve')
  );

drop policy if exists "Editors can upload case attachments" on storage.objects;
create policy "Editors can upload case attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'case-attachments'
    and public.is_hospital_member(((storage.foldername(name))[1])::uuid)
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );

drop policy if exists "Editors can replace case attachments" on storage.objects;
create policy "Editors can replace case attachments"
  on storage.objects for update
  using (
    bucket_id = 'case-attachments'
    and public.is_hospital_member(((storage.foldername(name))[1])::uuid)
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );

drop policy if exists "Editors can delete case attachments" on storage.objects;
create policy "Editors can delete case attachments"
  on storage.objects for delete
  using (
    bucket_id = 'case-attachments'
    and public.is_hospital_member(((storage.foldername(name))[1])::uuid)
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );
