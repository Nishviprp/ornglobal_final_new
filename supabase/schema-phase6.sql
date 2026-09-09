-- ============================================================
-- ORNGlobal — Phase 6: case titles + email-OTP login
-- Run this once in the Supabase SQL Editor, AFTER schema-phase5.sql:
-- https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new
-- ============================================================

-- 1. Let a case have a user-chosen name instead of always falling back
--    to "Untitled procedure" on the dashboard.
alter table public.surgical_cases
  add column if not exists title text;

-- 2. No schema change is needed for email-OTP login itself — it's a
--    built-in Supabase Auth flow (auth.signInWithOtp / auth.verifyOtp).
--    You DO need one manual dashboard step, though: open
--      Authentication > Email Templates > Magic Link
--    and make sure the template body includes {{ .Token }} so the
--    email actually shows a 6-digit code, e.g.:
--
--      <h2>Your ORNGlobal login code</h2>
--      <p>Enter this code to log in: <strong>{{ .Token }}</strong></p>
--      <p>It expires shortly. If you didn't request this, ignore this email.</p>
--
--    Supabase's default Magic Link template only renders a clickable
--    link ({{ .ConfirmationURL }}), not the raw code, until you add
--    {{ .Token }} yourself.
