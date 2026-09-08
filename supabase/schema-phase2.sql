-- ============================================================
-- ORNGlobal — Phase 2: surgical procedure case form
-- Run this once in the Supabase SQL Editor, AFTER schema.sql:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
-- ============================================================

-- 0. Helper: current user's hospital -------------------------------------
-- Every table below is scoped to a hospital. Instead of repeating a join
-- to `profiles` in every RLS policy, this function looks it up once.
create or replace function public.user_hospital_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select hospital_id from public.profiles where id = auth.uid();
$$;

-- 1. Growing lookup lists: specialties, procedures, surgeons -------------
-- Anyone at a hospital can add a new one from the case form, and it's
-- immediately available to everyone else at that same hospital.

create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (hospital_id, name)
);

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (specialty_id, name)
);

create table if not exists public.surgeons (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (hospital_id, name)
);

alter table public.specialties enable row level security;
alter table public.procedures enable row level security;
alter table public.surgeons enable row level security;

create policy "Hospital members can view specialties"
  on public.specialties for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can add specialties"
  on public.specialties for insert
  with check (hospital_id = user_hospital_id());

create policy "Hospital members can view procedures"
  on public.procedures for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can add procedures"
  on public.procedures for insert
  with check (hospital_id = user_hospital_id());

create policy "Hospital members can view surgeons"
  on public.surgeons for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can add surgeons"
  on public.surgeons for insert
  with check (hospital_id = user_hospital_id());

-- 2. Surgical cases --------------------------------------------------------
create table if not exists public.surgical_cases (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  created_by uuid not null references public.profiles (id),

  specialty_id uuid references public.specialties (id),
  procedure_id uuid references public.procedures (id),
  surgeon_id uuid references public.surgeons (id),

  surgeon_preference text,
  patient_position text,
  equipment text,
  instruments text,
  supplies text,
  specimen text,
  blood_bank text,
  implant text,
  dressing text,
  post_op_care text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.surgical_cases enable row level security;

create policy "Hospital members can view cases"
  on public.surgical_cases for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can create cases"
  on public.surgical_cases for insert
  with check (hospital_id = user_hospital_id());
create policy "Hospital members can update cases"
  on public.surgical_cases for update
  using (hospital_id = user_hospital_id());

-- Keep updated_at current on every edit.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_surgical_cases_updated_at on public.surgical_cases;
create trigger set_surgical_cases_updated_at
  before update on public.surgical_cases
  for each row execute procedure public.set_updated_at();

-- 3. Custom fields ("+ Add field" on the case form) -----------------------
-- Lets a user add arbitrary extra named fields to a case beyond the
-- built-in ones above.
create table if not exists public.case_custom_fields (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.surgical_cases (id) on delete cascade,
  hospital_id uuid not null references public.hospitals (id),
  field_name text not null,
  field_value text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.case_custom_fields enable row level security;

create policy "Hospital members can view custom fields"
  on public.case_custom_fields for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can manage custom fields"
  on public.case_custom_fields for insert
  with check (hospital_id = user_hospital_id());
create policy "Hospital members can update custom fields"
  on public.case_custom_fields for update
  using (hospital_id = user_hospital_id());
create policy "Hospital members can delete custom fields"
  on public.case_custom_fields for delete
  using (hospital_id = user_hospital_id());

-- 4. File attachments -------------------------------------------------------
-- Metadata row per uploaded file; the actual bytes live in Supabase
-- Storage, bucket "case-attachments", at path:
--   {hospital_id}/{case_id}/{uuid-filename}
create table if not exists public.case_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.surgical_cases (id) on delete cascade,
  hospital_id uuid not null references public.hospitals (id),
  storage_path text not null,
  file_name text not null,
  file_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.case_files enable row level security;

create policy "Hospital members can view case files"
  on public.case_files for select
  using (hospital_id = user_hospital_id());
create policy "Hospital members can add case files"
  on public.case_files for insert
  with check (hospital_id = user_hospital_id());
create policy "Hospital members can update case file rows"
  on public.case_files for update
  using (hospital_id = user_hospital_id());
create policy "Hospital members can delete case file rows"
  on public.case_files for delete
  using (hospital_id = user_hospital_id());

-- 5. Storage bucket + policies ----------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-attachments', 'case-attachments', false, 52428800) -- 50MB/file
on conflict (id) do nothing;

-- Files are stored at "{hospital_id}/{case_id}/{filename}" — the first
-- path segment is the hospital id, so we check it against the uploader's
-- own hospital.
create policy "Hospital members can read case attachments"
  on storage.objects for select
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
  );

create policy "Hospital members can upload case attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
  );

create policy "Hospital members can replace case attachments"
  on storage.objects for update
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
  );

create policy "Hospital members can delete case attachments"
  on storage.objects for delete
  using (
    bucket_id = 'case-attachments'
    and (storage.foldername(name))[1] = user_hospital_id()::text
  );
