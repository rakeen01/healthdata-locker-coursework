-- =============================================================================
-- HealthData Locker — Patient MVP setup (MANUAL)
-- Apply in Supabase SQL Editor after review. Do not run blindly in production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: INSPECTION (run first, read results)
-- -----------------------------------------------------------------------------

-- profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- patients table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'patients'
ORDER BY ordinal_position;

-- Foreign keys on uploaded_reports
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'uploaded_reports'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'patients', 'prescriptions', 'uploaded_reports');

-- Storage policies for patient-reports bucket
SELECT *
FROM storage.policies
WHERE bucket_id = 'patient-reports';

-- -----------------------------------------------------------------------------
-- PART 2: SCHEMA PATCH (apply if patients.user_id is missing)
-- Links auth.users → patients for server-side patient resolution
-- -----------------------------------------------------------------------------

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);

-- Ensure profiles row exists for auth users (uploaded_reports.uploaded_by → profiles.id)
-- Adjust columns if your profiles table differs from this minimal shape.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Auto-create profile on signup (optional but recommended for uploaded_by FK)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEMO ONLY: link an auth user to the demo patient row (replace UUIDs after inspection)
-- UPDATE public.patients
-- SET user_id = '<your-auth-user-uuid>'
-- WHERE id = '<your-patient-uuid>';

-- Backfill profiles for existing auth users missing a profile row
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- PART 3: HELPER — resolve patient_id for authenticated user
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_patient_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_patient_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_patient_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- PART 4: PUBLIC TOKEN RPC (limited fields, no PHI beyond name on slip)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_prescription_by_public_token(p_token text)
RETURNS TABLE (
  visit_date date,
  doctor_name text,
  diagnosis text,
  notes text,
  prescription_text text,
  patient_full_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.visit_date,
    p.doctor_name,
    p.diagnosis,
    p.notes,
    p.prescription_text,
    pt.full_name AS patient_full_name
  FROM public.prescriptions p
  JOIN public.patients pt ON pt.id = p.patient_id
  WHERE p.public_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_prescription_by_public_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_prescription_by_public_token(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- PART 5: ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_reports ENABLE ROW LEVEL SECURITY;

-- Drop demo / overly permissive policies (adjust names to match your project)
-- DROP POLICY IF EXISTS "..." ON public.prescriptions;

-- profiles: own row only
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- patients: own linked record only
DROP POLICY IF EXISTS patients_select_own ON public.patients;
CREATE POLICY patients_select_own ON public.patients
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- prescriptions: own patient only
DROP POLICY IF EXISTS prescriptions_select_own ON public.prescriptions;
CREATE POLICY prescriptions_select_own ON public.prescriptions
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

-- uploaded_reports: own patient only
DROP POLICY IF EXISTS uploaded_reports_select_own ON public.uploaded_reports;
CREATE POLICY uploaded_reports_select_own ON public.uploaded_reports
  FOR SELECT TO authenticated
  USING (patient_id = public.current_patient_id());

DROP POLICY IF EXISTS uploaded_reports_insert_own ON public.uploaded_reports;
CREATE POLICY uploaded_reports_insert_own ON public.uploaded_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    patient_id = public.current_patient_id()
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS uploaded_reports_delete_own ON public.uploaded_reports;
CREATE POLICY uploaded_reports_delete_own ON public.uploaded_reports
  FOR DELETE TO authenticated
  USING (patient_id = public.current_patient_id());

-- No broad anon SELECT on prescriptions — public access uses RPC only

-- -----------------------------------------------------------------------------
-- PART 6: STORAGE (bucket: patient-reports, path: {patient_id}/{filename})
-- -----------------------------------------------------------------------------

-- Ensure bucket exists (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-reports', 'patient-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Helper: first path segment must be the caller's patient id
CREATE OR REPLACE FUNCTION public.storage_patient_folder_matches()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (storage.foldername(name))[1] = public.current_patient_id()::text;
$$;

REVOKE ALL ON FUNCTION public.storage_patient_folder_matches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_patient_folder_matches() TO authenticated;

DROP POLICY IF EXISTS patient_reports_insert ON storage.objects;
CREATE POLICY patient_reports_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-reports'
    AND public.storage_patient_folder_matches()
  );

DROP POLICY IF EXISTS patient_reports_select ON storage.objects;
CREATE POLICY patient_reports_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-reports'
    AND public.storage_patient_folder_matches()
  );

DROP POLICY IF EXISTS patient_reports_delete ON storage.objects;
CREATE POLICY patient_reports_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-reports'
    AND public.storage_patient_folder_matches()
  );
