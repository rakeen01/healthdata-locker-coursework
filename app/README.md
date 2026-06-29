# HealthData Locker

Patient-facing MVP for secure access to prescriptions and uploaded health reports in Bangladesh.

## Current MVP scope (patient)

- Magic-link login via Supabase Auth
- Patient dashboard: own prescriptions + recent uploaded reports
- Prescription detail via public token link (QR/share) with ownership check when logged in
- Upload, list, view, and delete own report files (PDF/images)
- Logout

**Future phase:** doctor dashboard, prescription creation, clinic tools (stubs only today).

## Tech stack

- Next.js App Router (TypeScript)
- Tailwind CSS
- Supabase PostgreSQL + Auth + Storage

## Local setup

```bash
cd app
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from Supabase project settings
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to login or dashboard.

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `NEXT_PUBLIC_SITE_URL` | App origin for auth redirects (e.g. `http://localhost:3000`) |

See `.env.example`. Never commit `.env.local` or real credentials.

## Supabase setup (manual)

Apply after review:

**[`supabase/patient-mvp-setup.sql`](supabase/patient-mvp-setup.sql)**

Includes:

1. Inspection queries for schema and policies
2. `patients.user_id` link to `auth.users`
3. `profiles` table + signup trigger (for `uploaded_reports.uploaded_by`)
4. RLS on `patients`, `prescriptions`, `uploaded_reports`, `profiles`
5. Storage policies for bucket `patient-reports` (path: `{patient_id}/{filename}`)
6. RPC `get_prescription_by_public_token` for anonymous prescription views

**Link a test patient to your auth user:**

```sql
UPDATE public.patients
SET user_id = '<your-auth-user-uuid>'
WHERE id = '<patient-row-uuid>';
```

Ensure Supabase Auth redirect URLs include `{NEXT_PUBLIC_SITE_URL}/auth/callback`.

## Database tables (overview)

| Table | Purpose |
|-------|---------|
| `patients` | Patient record; `user_id` links to logged-in user |
| `profiles` | Auth user profile; `uploaded_reports.uploaded_by` FK |
| `prescriptions` | Prescription rows scoped by `patient_id` |
| `uploaded_reports` | Report metadata; files in Storage |

See [`AGENTS.md`](AGENTS.md) for column lists.

## Storage

- **Bucket:** `patient-reports` (private)
- **Path pattern:** `{patient_id}/{uuid}-{filename}`

## Authentication flow

1. Patient visits `/login`, enters email
2. Supabase sends magic link → `/auth/callback?code=...&next=/patient/dashboard`
3. Callback exchanges code for session cookies
4. Middleware refreshes session; `/patient/*` requires auth
5. Server resolves `patients` row where `user_id = auth.uid()`
6. If no linked patient → `/patient/account-setup`
7. Logout via dashboard/uploads clears session → `/login`

## Patient workflows

| Route | Description |
|-------|-------------|
| `/patient/dashboard` | Prescriptions list, recent reports, link to uploads |
| `/patient/uploads` | Upload/delete PDFs and images |
| `/p/[token]` | Single prescription view (public or owned when logged in) |

## Public token behavior

- Anonymous users: RPC returns one prescription’s clinical fields + patient name only
- Does **not** expose phone, DOB, other prescriptions, or uploaded reports
- Logged-in patients: must own the prescription or see not-found

## Known limitations

- Magic-link only (no password login)
- Patient–account linking is manual SQL until clinic onboarding exists
- Doctor routes are placeholders
- RLS must be applied manually; app behavior depends on it
- No automated test suite

## Manual test checklist

Before treating this as a stable checkpoint:

- [ ] Apply `supabase/patient-mvp-setup.sql` (or equivalent policies)
- [ ] Link test auth user to test patient via `patients.user_id`
- [ ] Login via magic link lands on dashboard
- [ ] Dashboard shows only that patient’s prescriptions and reports
- [ ] Upload PDF/image succeeds; file appears in list and Storage
- [ ] Delete report removes DB row and Storage object
- [ ] `/p/[token]` works anonymously for valid token
- [ ] Logged-in patient cannot open another patient’s token URL
- [ ] Unauthenticated `/patient/dashboard` redirects to login
- [ ] Logout works
- [ ] Unlinked auth user sees account-setup page

## Scripts

```bash
npm run dev    # development
npm run build  # production build
npm run lint   # ESLint
```
