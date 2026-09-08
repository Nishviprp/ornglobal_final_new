# ORNGlobal — Surgical Procedure Management

Phase 1: authentication (sign up / log in) for hospital staff.

## Stack
- React 19 + Vite
- Tailwind CSS
- Supabase (Postgres + Auth)
- React Router v6
- React Hot Toast

## One-time setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Run the database schema.** Open the Supabase SQL editor for this
   project and run the contents of `supabase/schema.sql`:
   https://supabase.com/dashboard/project/ztgqxtfadxypkgzakbkh/sql/new

   This creates:
   - `hospitals` — publicly readable list of hospitals, seeded with 5
     sample names. Add/edit hospitals any time in Table Editor →
     `hospitals`.
   - `profiles` — one row per user (first name, last name, email,
     hospital), auto-populated by a trigger whenever someone signs up.

3. **Environment variables.** A `.env` file is already included with
   this project's Supabase URL and anon key. If you ever need to point
   at a different Supabase project, copy `.env.example` to `.env` and
   fill in the new values.

4. **Disable "Confirm email" (recommended for local testing).** By
   default Supabase requires users to click a confirmation link before
   they can log in. To let people log in immediately after signing up,
   go to Authentication → Providers → Email in the Supabase dashboard
   and turn off "Confirm email". You can turn it back on later once
   you're ready for production.

5. **Run the app**
   ```
   npm run dev
   ```
   Visit the URL it prints (usually http://localhost:5173).

## What's here (Phase 1)

- `/signup` — first name, last name, email, password, hospital
  (dropdown, pulled live from the `hospitals` table)
- `/login` — email + password
- `/dashboard` — placeholder landing page after login, protected route
  (redirects to `/login` if not signed in)

No email OTP step in this phase — plain Supabase email/password auth.
That can be layered in later if needed.

## Next: Phase 2

The surgical procedure form (specialty / surgeon / procedure dropdowns,
file uploads, case sharing) builds on top of this auth foundation.
