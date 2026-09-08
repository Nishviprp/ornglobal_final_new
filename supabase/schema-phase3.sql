-- ============================================================
-- ORNGlobal — Phase 3: case sharing & permissions
-- Run this once in the Supabase SQL Editor, AFTER schema.sql and
-- schema-phase2.sql:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
-- ============================================================

-- 0. Let hospital colleagues see each other's basic profile ---------------
-- Needed so the case creator can pick who to share a case with. This adds
-- to (does not replace) the existing "view own profile" policy.
create policy "Hospital members can view colleague profiles"
  on public.profiles for select
  using (hospital_id = user_hospital_id());

-- 1. Case status (draft / approved) ----------------------------------------
alter table public.surgical_cases
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'approved')),
  add column if not exists approved_by uuid references public.profiles (id),
  add column if not exists approved_at timestamptz;

-- 2. Per-case share grants --------------------------------------------------
-- Everyone at the hospital already has baseline VIEW access to every case
-- (existing policy). A row here grants a specific colleague MORE than
-- that: download, edit, or approve. Permissions are cumulative —
-- edit implies download+view, approve implies edit+download+view.
create table if not exists public.case_shares (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.surgical_cases (id) on delete cascade,
  hospital_id uuid not null references public.hospitals (id),
  user_id uuid not null references public.profiles (id),
  permission text not null check (permission in ('download', 'edit', 'approve')),
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

alter table public.case_shares enable row level security;

create policy "Hospital members can view shares"
  on public.case_shares for select
  using (hospital_id = user_hospital_id());

create policy "Case creator can add shares"
  on public.case_shares for insert
  with check (
    hospital_id = user_hospital_id()
    and exists (
      select 1 from public.surgical_cases c
      where c.id = case_id and c.created_by = auth.uid()
    )
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.hospital_id = hospital_id
    )
  );

create policy "Case creator can update shares"
  on public.case_shares for update
  using (
    exists (
      select 1 from public.surgical_cases c
      where c.id = case_id and c.created_by = auth.uid()
    )
  );

create policy "Case creator can remove shares"
  on public.case_shares for delete
  using (
    exists (
      select 1 from public.surgical_cases c
      where c.id = case_id and c.created_by = auth.uid()
    )
  );

-- 3. Effective permission level for a user on a case -----------------------
-- 'approve' for the case creator, otherwise whatever case_shares grants
-- them, otherwise the hospital-wide baseline of 'view'.
create or replace function public.case_permission_level(
  p_case_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_created_by uuid;
  v_perm text;
begin
  select created_by into v_created_by
  from public.surgical_cases
  where id = p_case_id;

  if v_created_by is null then
    return null;
  end if;

  if v_created_by = p_user_id then
    return 'approve';
  end if;

  select permission into v_perm
  from public.case_shares
  where case_id = p_case_id and user_id = p_user_id;

  return coalesce(v_perm, 'view');
end;
$$;

-- 4. Enforce edit/approve rules on surgical_cases ---------------------------
create or replace function public.enforce_case_edit_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level text;
begin
  v_level := public.case_permission_level(old.id, auth.uid());

  -- Changing the approval status itself requires 'approve'.
  if new.status is distinct from old.status then
    if v_level <> 'approve' then
      raise exception 'Only an approver can change the approval status of this case.';
    end if;
    if new.status = 'approved' then
      new.approved_by := auth.uid();
      new.approved_at := now();
    else
      new.approved_by := null;
      new.approved_at := null;
    end if;
    return new;
  end if;

  -- An approved case is locked for everyone except an approver.
  if old.status = 'approved' and v_level <> 'approve' then
    raise exception 'This case is approved and locked. Ask an approver to unlock it before editing.';
  end if;

  if v_level not in ('edit', 'approve') then
    raise exception 'You do not have edit access to this case.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_case_edit_permissions on public.surgical_cases;
create trigger enforce_case_edit_permissions
  before update on public.surgical_cases
  for each row execute procedure public.enforce_case_edit_permissions();

-- 5. Gate case_files metadata by permission level ---------------------------
drop policy if exists "Hospital members can add case files" on public.case_files;
create policy "Editors can add case files"
  on public.case_files for insert
  with check (
    hospital_id = user_hospital_id()
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

drop policy if exists "Hospital members can update case file rows" on public.case_files;
create policy "Editors can update case file rows"
  on public.case_files for update
  using (
    hospital_id = user_hospital_id()
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

drop policy if exists "Hospital members can delete case file rows" on public.case_files;
create policy "Editors can delete case file rows"
  on public.case_files for delete
  using (
    hospital_id = user_hospital_id()
    and public.case_permission_level(case_id, auth.uid()) in ('edit', 'approve')
  );

-- 6. Gate the actual file bytes in Storage by permission level --------------
-- Paths are "{hospital_id}/{case_id}/{filename}".
drop policy if exists "Hospital members can read case attachments" on storage.objects;
create policy "Downloaders can read case attachments"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('download', 'edit', 'approve')
  );

drop policy if exists "Hospital members can upload case attachments" on storage.objects;
create policy "Editors can upload case attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );

drop policy if exists "Hospital members can replace case attachments" on storage.objects;
create policy "Editors can replace case attachments"
  on storage.objects for update
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );

drop policy if exists "Hospital members can delete case attachments" on storage.objects;
create policy "Editors can delete case attachments"
  on storage.objects for delete
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
    and public.case_permission_level(((storage.foldername(name))[2])::uuid, auth.uid())
        in ('edit', 'approve')
  );
