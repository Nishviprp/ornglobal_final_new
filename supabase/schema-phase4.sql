-- ============================================================
-- ORNGlobal — Phase 4: delete-case permission
-- Run this once in the Supabase SQL Editor, AFTER schema-phase3.sql:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
-- ============================================================

-- Only the case creator (or anyone else granted 'approve' rights) can
-- delete a case. There was no delete policy before this, so deletes
-- were silently blocked for everyone.
create policy "Approvers can delete cases"
  on public.surgical_cases for delete
  using (public.case_permission_level(id, auth.uid()) = 'approve');
