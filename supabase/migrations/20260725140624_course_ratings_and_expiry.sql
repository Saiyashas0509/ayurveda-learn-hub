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
CREATE POLICY course_ratings_insert ON public.course_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
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
