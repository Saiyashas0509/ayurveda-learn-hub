
-- 1) Expand app_role enum (safe: not referenced in this txn)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'franchise_owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'corporate_employee';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hospital_staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'faculty';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'org_admin';

-- 2) org_type enum
DO $$ BEGIN
  CREATE TYPE public.org_type AS ENUM ('hospital','franchise','corporate','academy','internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.center_type AS ENUM ('clinic','franchise_branch','hospital_ward','training_campus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  org_type public.org_type NOT NULL DEFAULT 'internal',
  contact_email text,
  logo_url text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_organizations_updated ON public.organizations;
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed default "Internal" org and backfill
INSERT INTO public.organizations (name, slug, org_type)
VALUES ('Internal', 'internal', 'internal')
ON CONFLICT (slug) DO NOTHING;

-- 4) Extend centers
ALTER TABLE public.centers
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS center_type public.center_type NOT NULL DEFAULT 'clinic';

UPDATE public.centers
  SET organization_id = (SELECT id FROM public.organizations WHERE slug='internal')
  WHERE organization_id IS NULL;

-- 5) Extend employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS primary_role public.app_role;

UPDATE public.employees e
  SET organization_id = c.organization_id
  FROM public.centers c
  WHERE e.center_id = c.id AND e.organization_id IS NULL;

UPDATE public.employees
  SET organization_id = (SELECT id FROM public.organizations WHERE slug='internal')
  WHERE organization_id IS NULL;

-- Trigger to sync employees.organization_id from center
CREATE OR REPLACE FUNCTION public.tg_sync_employee_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.center_id IS NOT NULL AND (NEW.organization_id IS NULL OR NEW.center_id IS DISTINCT FROM OLD.center_id) THEN
    SELECT organization_id INTO NEW.organization_id FROM public.centers WHERE id = NEW.center_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_employees_sync_org ON public.employees;
CREATE TRIGGER trg_employees_sync_org
  BEFORE INSERT OR UPDATE OF center_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_employee_org();

-- 6) Extend pending_bootstrap
ALTER TABLE public.pending_bootstrap
  ADD COLUMN IF NOT EXISTS requested_role public.app_role,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS center_id uuid REFERENCES public.centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learning_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS designation text;

-- 7) has_org_access helper (uses only pre-existing enum value 'super_admin')
CREATE OR REPLACE FUNCTION private.has_org_access(_user_id uuid, _org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    _org_id IS NULL
    OR private.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.employees WHERE id = _user_id AND organization_id = _org_id);
$$;

CREATE OR REPLACE FUNCTION private.current_org_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.employees WHERE id = _user_id LIMIT 1;
$$;

-- 8) Organizations policies
DROP POLICY IF EXISTS "orgs_read_members" ON public.organizations;
CREATE POLICY "orgs_read_members" ON public.organizations FOR SELECT TO authenticated
  USING (private.has_org_access(auth.uid(), id));

DROP POLICY IF EXISTS "orgs_admin_write" ON public.organizations;
CREATE POLICY "orgs_admin_write" ON public.organizations FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

-- 9) Tenant-scoped additions (kept alongside existing policies)
-- Employees: allow reads within same org (in addition to self + admin already there)
DROP POLICY IF EXISTS "employees_org_read" ON public.employees;
CREATE POLICY "employees_org_read" ON public.employees FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = private.current_org_id(auth.uid()));

-- Certificates: org-mates can view (audit + org visibility)
DROP POLICY IF EXISTS "cert_org_read" ON public.certificates;
CREATE POLICY "cert_org_read" ON public.certificates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = certificates.user_id
      AND e.organization_id = private.current_org_id(auth.uid())
  ));

-- lesson_progress: org visibility for org_admin/managers
DROP POLICY IF EXISTS "lp_org_read" ON public.lesson_progress;
CREATE POLICY "lp_org_read" ON public.lesson_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = lesson_progress.user_id
      AND e.organization_id = private.current_org_id(auth.uid())
  ));

-- quiz_attempts: org visibility
DROP POLICY IF EXISTS "attempts_org_read" ON public.quiz_attempts;
CREATE POLICY "attempts_org_read" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = quiz_attempts.user_id
      AND e.organization_id = private.current_org_id(auth.uid())
  ));
