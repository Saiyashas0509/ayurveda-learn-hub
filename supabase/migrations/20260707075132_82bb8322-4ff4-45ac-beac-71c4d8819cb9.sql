
-- Extend courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preview_allowed boolean NOT NULL DEFAULT false;

-- course_modules
CREATE TABLE IF NOT EXISTS public.course_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_modules TO authenticated;
GRANT ALL ON public.course_modules TO service_role;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_modules_read" ON public.course_modules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
  AND (c.is_published OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role))));

CREATE POLICY "course_modules_write" ON public.course_modules FOR ALL TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role));

CREATE TRIGGER trg_course_modules_updated BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Extend lessons
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.course_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS preview_allowed boolean NOT NULL DEFAULT false;

-- assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text,
  rubric text,
  due_at timestamptz,
  allow_late boolean NOT NULL DEFAULT true,
  max_score int NOT NULL DEFAULT 100,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_read" ON public.assignments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id
  AND (c.is_published OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role))));

CREATE POLICY "assignments_write" ON public.assignments FOR ALL TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role));

CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- assignment_submissions
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text,
  file_name text,
  file_kind text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_late boolean NOT NULL DEFAULT false,
  grade numeric,
  feedback text,
  graded_by uuid REFERENCES auth.users(id),
  graded_at timestamptz,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_submissions TO authenticated;
GRANT ALL ON public.assignment_submissions TO service_role;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submissions_student_own" ON public.assignment_submissions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "submissions_faculty_read" ON public.assignment_submissions FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role));

CREATE POLICY "submissions_faculty_grade" ON public.assignment_submissions FOR UPDATE TO authenticated
USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role))
WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::app_role) OR private.has_role(auth.uid(), 'faculty'::app_role));

CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- publish helper
CREATE OR REPLACE FUNCTION public.publish_course(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.courses
    SET is_published = true,
        status = 'published',
        last_published_at = now(),
        version = version + 1
    WHERE id = _course_id;
END $$;

CREATE OR REPLACE FUNCTION public.unpublish_course(_course_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.courses
    SET is_published = false,
        status = 'draft'
    WHERE id = _course_id;
END $$;
