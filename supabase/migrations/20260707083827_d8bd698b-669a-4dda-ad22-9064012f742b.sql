
-- =============== DISCUSSIONS ===============

CREATE TABLE public.discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  is_announcement boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))) STORED
);
CREATE INDEX discussion_threads_course_idx ON public.discussion_threads(course_id, last_activity_at DESC);
CREATE INDEX discussion_threads_tsv_idx ON public.discussion_threads USING GIN(search_tsv);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_threads TO authenticated;
GRANT ALL ON public.discussion_threads TO service_role;
ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES public.discussion_replies(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  is_faculty_answer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX discussion_replies_thread_idx ON public.discussion_replies(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_replies TO authenticated;
GRANT ALL ON public.discussion_replies TO service_role;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.discussion_likes (
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('thread','reply')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
GRANT SELECT, INSERT, DELETE ON public.discussion_likes TO authenticated;
GRANT ALL ON public.discussion_likes TO service_role;
ALTER TABLE public.discussion_likes ENABLE ROW LEVEL SECURITY;

-- Faculty check helper (any of these roles)
CREATE OR REPLACE FUNCTION public.is_faculty_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('super_admin','hr_admin','trainer','faculty','admin','org_admin')
  )
$$;

-- Enrollment proxy: any lesson_progress row for a lesson in the course
CREATE OR REPLACE FUNCTION public.user_enrolled_in_course(_user_id uuid, _course_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = _user_id AND l.course_id = _course_id
  ) OR public.is_faculty_or_admin(_user_id)
$$;

CREATE POLICY discussion_threads_select ON public.discussion_threads
  FOR SELECT TO authenticated
  USING (public.user_enrolled_in_course(auth.uid(), course_id));
CREATE POLICY discussion_threads_insert ON public.discussion_threads
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.user_enrolled_in_course(auth.uid(), course_id));
CREATE POLICY discussion_threads_update ON public.discussion_threads
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));
CREATE POLICY discussion_threads_delete ON public.discussion_threads
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));

CREATE POLICY discussion_replies_select ON public.discussion_replies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.discussion_threads t WHERE t.id = thread_id AND public.user_enrolled_in_course(auth.uid(), t.course_id)));
CREATE POLICY discussion_replies_insert ON public.discussion_replies
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.discussion_threads t WHERE t.id = thread_id AND public.user_enrolled_in_course(auth.uid(), t.course_id)));
CREATE POLICY discussion_replies_update ON public.discussion_replies
  FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));
CREATE POLICY discussion_replies_delete ON public.discussion_replies
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));

CREATE POLICY discussion_likes_select ON public.discussion_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY discussion_likes_insert ON public.discussion_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY discussion_likes_delete ON public.discussion_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Triggers: maintain counters and faculty-answer flag
CREATE OR REPLACE FUNCTION public.tg_discussion_thread_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_faculty_answer := public.is_faculty_or_admin(NEW.author_id);
    UPDATE public.discussion_threads
      SET reply_count = reply_count + 1, last_activity_at = now()
      WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discussion_threads
      SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_reply_ins BEFORE INSERT ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.tg_discussion_thread_touch();
CREATE TRIGGER tg_reply_del AFTER DELETE ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.tg_discussion_thread_touch();

CREATE OR REPLACE FUNCTION public.tg_discussion_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _delta int;
  _tt text;
  _tid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _delta := 1; _tt := NEW.target_type; _tid := NEW.target_id;
  ELSE _delta := -1; _tt := OLD.target_type; _tid := OLD.target_id;
  END IF;
  IF _tt = 'thread' THEN
    UPDATE public.discussion_threads SET like_count = GREATEST(like_count + _delta, 0) WHERE id = _tid;
  ELSE
    UPDATE public.discussion_replies SET like_count = GREATEST(like_count + _delta, 0) WHERE id = _tid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER tg_like_ins AFTER INSERT ON public.discussion_likes FOR EACH ROW EXECUTE FUNCTION public.tg_discussion_like_count();
CREATE TRIGGER tg_like_del AFTER DELETE ON public.discussion_likes FOR EACH ROW EXECUTE FUNCTION public.tg_discussion_like_count();

CREATE TRIGGER tg_threads_updated BEFORE UPDATE ON public.discussion_threads FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_replies_updated BEFORE UPDATE ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============== LIVE CLASSES ===============

CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  meeting_url text NOT NULL,
  provider text NOT NULL DEFAULT 'other' CHECK (provider IN ('zoom','meet','teams','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  host_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_classes_course_start_idx ON public.live_classes(course_id, starts_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_classes TO authenticated;
GRANT ALL ON public.live_classes TO service_role;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_select ON public.live_classes FOR SELECT TO authenticated USING (public.user_enrolled_in_course(auth.uid(), course_id));
CREATE POLICY lc_ins ON public.live_classes FOR INSERT TO authenticated WITH CHECK (public.is_faculty_or_admin(auth.uid()) AND host_id = auth.uid());
CREATE POLICY lc_upd ON public.live_classes FOR UPDATE TO authenticated USING (host_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));
CREATE POLICY lc_del ON public.live_classes FOR DELETE TO authenticated USING (host_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));
CREATE TRIGGER tg_lc_upd BEFORE UPDATE ON public.live_classes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.live_class_attendance (
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (live_class_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.live_class_attendance TO authenticated;
GRANT ALL ON public.live_class_attendance TO service_role;
ALTER TABLE public.live_class_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY lca_select ON public.live_class_attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));
CREATE POLICY lca_ins ON public.live_class_attendance FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.live_classes c WHERE c.id = live_class_id AND public.user_enrolled_in_course(auth.uid(), c.course_id)));
CREATE POLICY lca_upd ON public.live_class_attendance FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.live_class_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','raise_hand','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lcm_class_idx ON public.live_class_messages(live_class_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.live_class_messages TO authenticated;
GRANT ALL ON public.live_class_messages TO service_role;
ALTER TABLE public.live_class_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcm_select ON public.live_class_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_classes c WHERE c.id = live_class_id AND public.user_enrolled_in_course(auth.uid(), c.course_id)));
CREATE POLICY lcm_ins ON public.live_class_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.live_classes c WHERE c.id = live_class_id AND public.user_enrolled_in_course(auth.uid(), c.course_id)));
CREATE POLICY lcm_del ON public.live_class_messages FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_faculty_or_admin(auth.uid()));

CREATE TABLE public.live_class_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL,
  created_by uuid NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_class_polls TO authenticated;
GRANT ALL ON public.live_class_polls TO service_role;
ALTER TABLE public.live_class_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcp_select ON public.live_class_polls FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_classes c WHERE c.id = live_class_id AND public.user_enrolled_in_course(auth.uid(), c.course_id)));
CREATE POLICY lcp_ins ON public.live_class_polls FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_faculty_or_admin(auth.uid()));
CREATE POLICY lcp_upd ON public.live_class_polls FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_faculty_or_admin(auth.uid()));

CREATE TABLE public.live_class_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.live_class_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.live_class_poll_votes TO authenticated;
GRANT ALL ON public.live_class_poll_votes TO service_role;
ALTER TABLE public.live_class_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lcpv_select ON public.live_class_poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_class_polls p JOIN public.live_classes c ON c.id = p.live_class_id
                 WHERE p.id = poll_id AND public.user_enrolled_in_course(auth.uid(), c.course_id)));
CREATE POLICY lcpv_ins ON public.live_class_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lcpv_upd ON public.live_class_poll_votes FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============== NOTIFICATIONS ===============

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  in_app jsonb NOT NULL DEFAULT '{"assignment":true,"result":true,"live_class":true,"announcement":true,"discussion":true,"system":true}'::jsonb,
  email_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY np_all ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER tg_np_upd BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper: insert notification honoring prefs
CREATE OR REPLACE FUNCTION public.enqueue_notification(_user_id uuid, _type text, _title text, _body text, _link text, _data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _allow boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT COALESCE((in_app->>_type)::boolean, true) INTO _allow FROM public.notification_preferences WHERE user_id = _user_id;
  IF _allow IS NULL THEN _allow := true; END IF;
  IF NOT _allow THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
    VALUES (_user_id, _type, _title, COALESCE(_body,''), _link, COALESCE(_data,'{}'::jsonb));
END $$;

-- Triggers: assignments
CREATE OR REPLACE FUNCTION public.tg_notify_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lp.user_id FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = NEW.course_id
  LOOP
    PERFORM public.enqueue_notification(r.user_id, 'assignment', 'New assignment: ' || NEW.title,
      COALESCE(NEW.instructions,''), '/assignments/' || NEW.id::text, jsonb_build_object('assignment_id', NEW.id, 'course_id', NEW.course_id));
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_assignment_notify AFTER INSERT ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.tg_notify_assignment();

-- Trigger: graded submission
CREATE OR REPLACE FUNCTION public.tg_notify_grade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.grade IS NOT NULL AND (OLD.grade IS DISTINCT FROM NEW.grade) THEN
    PERFORM public.enqueue_notification(NEW.user_id, 'result', 'Assignment graded',
      'Your submission has been graded.', '/assignments/' || NEW.assignment_id::text,
      jsonb_build_object('submission_id', NEW.id, 'grade', NEW.grade));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_grade_notify AFTER UPDATE ON public.assignment_submissions FOR EACH ROW EXECUTE FUNCTION public.tg_notify_grade();

-- Trigger: live class scheduled
CREATE OR REPLACE FUNCTION public.tg_notify_live_class()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT lp.user_id FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = NEW.course_id
  LOOP
    PERFORM public.enqueue_notification(r.user_id, 'live_class', 'Live class scheduled: ' || NEW.title,
      to_char(NEW.starts_at, 'Mon DD, HH24:MI'), '/live/' || NEW.id::text,
      jsonb_build_object('live_class_id', NEW.id, 'course_id', NEW.course_id, 'starts_at', NEW.starts_at));
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_live_class_notify AFTER INSERT ON public.live_classes FOR EACH ROW EXECUTE FUNCTION public.tg_notify_live_class();

-- Trigger: announcement (fan out to matching roles)
CREATE OR REPLACE FUNCTION public.tg_notify_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE NEW.audience_roles IS NULL OR ur.role::text = ANY(NEW.audience_roles::text[])
  LOOP
    PERFORM public.enqueue_notification(r.user_id, 'announcement', NEW.title, NEW.body, '/announcements', jsonb_build_object('announcement_id', NEW.id));
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_announcement_notify AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.tg_notify_announcement();

-- Trigger: reply to a thread notifies thread author
CREATE OR REPLACE FUNCTION public.tg_notify_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _author uuid; _title text; _course uuid;
BEGIN
  SELECT author_id, title, course_id INTO _author, _title, _course FROM public.discussion_threads WHERE id = NEW.thread_id;
  IF _author IS NOT NULL AND _author <> NEW.author_id THEN
    PERFORM public.enqueue_notification(_author, 'discussion', 'New reply on: ' || _title,
      substring(NEW.body from 1 for 140), '/discussions/' || NEW.thread_id::text,
      jsonb_build_object('thread_id', NEW.thread_id, 'reply_id', NEW.id, 'course_id', _course));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_reply_notify AFTER INSERT ON public.discussion_replies FOR EACH ROW EXECUTE FUNCTION public.tg_notify_reply();

-- Notifications RLS: existing policies may not cover new columns; ensure user can update is_read
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_update_own') THEN
    CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
