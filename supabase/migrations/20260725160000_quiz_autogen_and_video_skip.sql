-- Automatic quiz generation needs nothing new schema-wise (quizzes/questions/
-- question_options already exist) — this migration is only for anti-skip
-- video-completion tracking.

-- watched_seconds already existed on lesson_progress but was never actually
-- used for anything (every write hardcoded it to 0) — repurposing it here to
-- mean "furthest playback position reached," which is what markLessonComplete
-- and startQuizAttempt now check before allowing completion/a quiz attempt.
COMMENT ON COLUMN public.lesson_progress.watched_seconds IS
  'Furthest video playback position reached, in seconds (not total time watched) — used to gate lesson completion on having watched the whole video.';

ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS skip_detected BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.lesson_progress.skip_detected IS
  'Set once if the client ever reported a forward seek/skip past the furthest watched position — sticky (never cleared automatically) and blocks Mark Complete for this lesson.';
