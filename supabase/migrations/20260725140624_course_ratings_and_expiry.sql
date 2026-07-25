-- Course ratings/feedback from learners, and compliance-training expiry.

-- =========== COURSE RATINGS ===========
CREATE TABLE public.course_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_ratings TO authenticated;
GRANT ALL ON public.course_ratings TO service_role;
ALTER TABLE public.course_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_ratings_select ON public.course_ratings FOR SELECT TO authenticated USING (true);
-- Mirrors submitCourseRating's app-level "must have started the course"
-- check at the DB layer too, so it can't be bypassed by calling
-- PostgREST/the Supabase client directly instead of the server function.
CREATE POLICY course_ratings_insert ON public.course_ratings FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = auth.uid() AND l.course_id = course_ratings.course_id
  )
);
CREATE POLICY course_ratings_update ON public.course_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY course_ratings_delete ON public.course_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER tg_course_ratings_updated BEFORE UPDATE ON public.course_ratings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== COMPLIANCE EXPIRY / RENEWAL ===========
-- Null renewal_period_months = course never expires (the default, unchanged
-- behavior for existing courses). Admins opt individual courses into expiry
-- (e.g. NABH/hygiene compliance training needing an annual retake).
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS renewal_period_months INT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- =========== REAL MULTI-TENANCY: org-private courses ===========
-- NULL organization_id = shared/global (unchanged behavior for every existing
-- course). Setting it restricts visibility+enrollment to that one org.
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_courses_organization_id ON public.courses(organization_id);

-- Certificates carry the learner's org at issuance time so a report/export
-- can group or filter by org even if the learner later moves centers.
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.employee_org(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.employees WHERE id = _user_id;
$$;
REVOKE ALL ON FUNCTION private.employee_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.employee_org(uuid) TO authenticated, service_role;

-- Auto-stamp certificates.organization_id from the learner's current org at
-- insert time (mirrors the existing employees.center_id -> organization_id
-- trigger pattern already used elsewhere in this schema).
CREATE OR REPLACE FUNCTION private.tg_stamp_cert_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.employees WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_stamp_cert_org ON public.certificates;
CREATE TRIGGER trg_stamp_cert_org BEFORE INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION private.tg_stamp_cert_org();

-- Backfill existing certificates issued before this migration.
UPDATE public.certificates c SET organization_id = e.organization_id
  FROM public.employees e WHERE c.user_id = e.id AND c.organization_id IS NULL;

-- Enforce org-privacy + target_roles at the DB layer, not just in app code.
-- A course is visible/enrollable only if: it's published (or you're staff),
-- AND it's either global (organization_id IS NULL) or belongs to your own
-- org, AND either it has no role restriction or your role is in the list.
DROP POLICY IF EXISTS courses_read_published ON public.courses;
CREATE POLICY courses_read_published ON public.courses FOR SELECT TO authenticated
  USING (
    (is_published OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
    AND (organization_id IS NULL OR organization_id = private.employee_org(auth.uid()) OR private.is_admin(auth.uid()))
    AND (
      target_roles IS NULL OR array_length(target_roles, 1) IS NULL
      OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY(target_roles))
      OR private.is_admin(auth.uid())
    )
  );

-- =========== GOOGLE MEET (OAuth, per-trainer) ===========
-- One row per trainer who has connected their Google account. Tokens are
-- opaque to Postgres; only the app (service role) ever reads/writes them.
CREATE TABLE IF NOT EXISTS public.trainer_google_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.trainer_google_tokens TO service_role;
ALTER TABLE public.trainer_google_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY google_tokens_self ON public.trainer_google_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Inserts/updates/deletes only ever happen via the server-side OAuth
-- callback and admin actions, both using the service-role client.

ALTER TABLE public.live_classes ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE public.live_classes ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual';

-- =========== TRAINER PERFORMANCE ===========
-- Simple average of course_ratings across the courses a trainer authored —
-- no new feedback mechanism needed, this reuses the ratings table above.
CREATE OR REPLACE VIEW public.trainer_ratings AS
  SELECT c.created_by AS trainer_id, COUNT(r.id) AS rating_count, ROUND(AVG(r.rating)::numeric, 2) AS avg_rating
  FROM public.courses c
  JOIN public.course_ratings r ON r.course_id = c.id
  WHERE c.created_by IS NOT NULL
  GROUP BY c.created_by;
GRANT SELECT ON public.trainer_ratings TO authenticated;

-- =========== STORAGE: org-logos (bucket created via Storage API, public) ===========
CREATE POLICY "org_logos_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'org-logos' AND private.is_admin(auth.uid()));

CREATE POLICY "org_logos_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'org-logos' AND private.is_admin(auth.uid()));

CREATE POLICY "org_logos_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'org-logos' AND private.is_admin(auth.uid()));
-- Read is implicit: the bucket itself is public (created with public:true).

-- Tracks whether the "your certificate is expiring soon" email has already
-- gone out, so the daily expiry-check cron doesn't re-send it every day
-- for the whole 30-day warning window.
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ;

-- certificates bucket (private, server-generated PDFs) needs no client-side
-- storage.objects policies: only the service-role key ever writes/reads it
-- (at issuance, and via a signed URL minted server-side), and service role
-- bypasses RLS entirely.
