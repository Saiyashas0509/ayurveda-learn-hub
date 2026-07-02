
-- 1. Private schema + helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','hr_admin'));
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

-- 2. Recreate all policies to reference private.* helpers
DROP POLICY IF EXISTS ann_admin_write ON public.announcements;
CREATE POLICY ann_admin_write ON public.announcements FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS ans_via_attempt ON public.attempt_answers;
CREATE POLICY ans_via_attempt ON public.attempt_answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_answers.attempt_id AND (a.user_id = auth.uid() OR private.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS audit_admin_read ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role));

DROP POLICY IF EXISTS centers_admin_write ON public.centers;
CREATE POLICY centers_admin_write ON public.centers FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS cert_self_or_admin ON public.certificates;
CREATE POLICY cert_self_or_admin ON public.certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role));

DROP POLICY IF EXISTS cert_admin_write ON public.certificates;
CREATE POLICY cert_admin_write ON public.certificates FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- Remove public anon read on certificates
DROP POLICY IF EXISTS cert_public_verify ON public.certificates;

DROP POLICY IF EXISTS cats_admin_write ON public.course_categories;
CREATE POLICY cats_admin_write ON public.course_categories FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS courses_read_published ON public.courses;
CREATE POLICY courses_read_published ON public.courses FOR SELECT TO authenticated
  USING (is_published OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS courses_admin_write ON public.courses;
CREATE POLICY courses_admin_write ON public.courses FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS employees_self_read ON public.employees;
CREATE POLICY employees_self_read ON public.employees FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role)
         OR private.has_role(auth.uid(), 'regional_manager'::public.app_role)
         OR private.has_role(auth.uid(), 'center_head_doctor'::public.app_role));

DROP POLICY IF EXISTS employees_admin_all ON public.employees;
CREATE POLICY employees_admin_all ON public.employees FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS lp_self ON public.lesson_progress;
CREATE POLICY lp_self ON public.lesson_progress FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lessons_admin_write ON public.lessons;
CREATE POLICY lessons_admin_write ON public.lessons FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS lessons_read_via_course ON public.lessons;
CREATE POLICY lessons_read_via_course ON public.lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND (c.is_published OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))));

DROP POLICY IF EXISTS la_admin_read ON public.login_attempts;
CREATE POLICY la_admin_read ON public.login_attempts FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role));

DROP POLICY IF EXISTS notif_self ON public.notifications;
CREATE POLICY notif_self ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR private.is_admin(auth.uid()));

DROP POLICY IF EXISTS options_admin_write ON public.question_options;
CREATE POLICY options_admin_write ON public.question_options FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS options_read_admin ON public.question_options;
CREATE POLICY options_read_admin ON public.question_options FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS questions_admin_write ON public.questions;
CREATE POLICY questions_admin_write ON public.questions FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS attempts_self ON public.quiz_attempts;
CREATE POLICY attempts_self ON public.quiz_attempts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS quizzes_admin_write ON public.quizzes;
CREATE POLICY quizzes_admin_write ON public.quizzes FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role))
  WITH CHECK (private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'trainer'::public.app_role));

DROP POLICY IF EXISTS user_roles_read_self_or_admin ON public.user_roles;
CREATE POLICY user_roles_read_self_or_admin ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()) OR private.has_role(auth.uid(), 'auditor'::public.app_role));

-- 3. Drop the now-unreferenced public helpers so lint no longer flags them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
