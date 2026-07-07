## Course Builder + Assignments

Extend existing schema. No table drops. Faculty/admin authoring UI + student assignment submissions + grading.

### 1. Schema migration

**Extend `courses`:**
- `status text` ('draft' | 'published', default 'draft') — mirrors `is_published` for clarity
- `last_published_at timestamptz`
- `version int default 1`
- `preview_allowed boolean default false`

**New `course_modules`:** `id, course_id, title, description, sort_order, created_at, updated_at`. Cascade on course.

**Extend `lessons`:** add `module_id uuid → course_modules(id)`, `description text`, `preview_allowed boolean default false`. Keep existing `course_id` for backward compat; backfill via trigger.

**Extend `lessons.resources` jsonb** (already exists) — use for attached PDFs/PPTs: `[{ id, name, url, kind: 'pdf'|'ppt'|'other', size }]`.

**New `assignments`:** `id, course_id, lesson_id (nullable), title, instructions, rubric text, due_at timestamptz, allow_late boolean default true, max_score int default 100, created_by, created_at, updated_at`.

**New `assignment_submissions`:** `id, assignment_id, user_id, file_url, file_name, file_kind, submitted_at, is_late boolean, grade numeric, feedback text, graded_by, graded_at, status text ('submitted'|'graded'|'returned')`. Unique (assignment_id, user_id) — resubmission overwrites.

**Storage buckets:**
- `course-media` (private) — videos, resource PDFs/PPTs; policies allow faculty/admin write, authenticated read via signed URLs
- `assignment-submissions` (private) — student writes own path `{user_id}/{assignment_id}/*`; faculty/admin read all

**RLS:**
- `course_modules`: same as lessons (faculty/admin write; read via published course)
- `assignments`: faculty/admin write; authenticated read via published course
- `assignment_submissions`: student CRUD own row; faculty/admin read all + update grade/feedback

Add `faculty` check via existing `has_role` (roles: `trainer`, `faculty`, admins).

**Publish helper fn:** `publish_course(course_id uuid)` — sets `is_published=true`, `status='published'`, `last_published_at=now()`, `version=version+1`.

### 2. Server functions

`src/lib/course-builder.functions.ts` (faculty-gated via `assertFaculty` helper checking `super_admin | hr_admin | trainer | faculty`):
- `getCourseForEdit(courseId)` — course + modules + lessons + assignments
- `upsertCourse`, `createModule`, `updateModule`, `deleteModule`, `reorderModules({ courseId, orderedIds })`
- `createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons({ moduleId, orderedIds })`
- `getUploadUrl({ bucket, path })` — returns signed upload URL via `supabaseAdmin.storage.from(x).createSignedUploadUrl(path)`
- `attachLessonResource({ lessonId, resource })`
- `publishCourse(courseId)`, `unpublishCourse(courseId)`
- `upsertAssignment`, `deleteAssignment`

`src/lib/assignments.functions.ts`:
- `listMyAssignments()` — student view with own submission status
- `getAssignment(id)` — student view
- `submitAssignment({ assignmentId, fileUrl, fileName, fileKind })` — sets `is_late` server-side
- `listSubmissionsForGrading({ assignmentId? })` — faculty view
- `gradeSubmission({ submissionId, grade, feedback })` — writes grade + marks 'graded'

Signed download URLs for submission files (short-lived).

### 3. UI

`src/routes/_authenticated/admin/courses.index.tsx` — list courses (faculty/admin) with New Course button, status badge, version, last published.

`src/routes/_authenticated/admin/courses.$courseId.tsx` — **Course Builder**:
- Header: title, description, category, cover, preview toggle, Draft/Published toggle + Publish button showing version and last-published timestamp
- Body: modules list, drag-and-drop reorder (using `@dnd-kit/core` + `@dnd-kit/sortable`)
- Each module: inline title edit, add-lesson button, sortable lessons
- Lesson editor drawer: title, description, video upload (progress bar → storage), resource uploader (PDF/PPT multi), preview-allowed flag, quiz selector (existing quizzes for this course) or "Create quiz inline" that opens minimal quiz form
- Assignments tab: list + add/edit assignment (title, instructions, rubric textarea, due date picker, allow-late toggle, max score)

`src/routes/_authenticated/admin/submissions.tsx` — faculty grading view: filter by assignment, table of submissions with student name, submitted-at, late flag, current grade, "Grade" button opens dialog (view file link, rubric reference, grade input, feedback textarea, save).

`src/routes/_authenticated/assignments.index.tsx` — student list of assignments across enrolled courses, status (not submitted / submitted / graded), due date.

`src/routes/_authenticated/assignments.$assignmentId.tsx` — student view: instructions, rubric (read-only), file upload widget, submission history, grade + feedback once graded.

Sidebar (roleViews.ts): add "Course Builder" and "Grading" for `faculty`, `trainer`, `hr_admin`, `super_admin`; add "My Assignments" for `student`, `corporate_employee`, `hospital_staff`, `doctor`, `therapist`.

### 4. Technical notes

- `@dnd-kit/*` packages installed via `bun add`
- Video/file uploads: client requests signed upload URL from server fn, uploads directly to storage, then calls attach fn with returned path
- File kind detection by extension; size limits enforced client-side (video 500MB, docs 25MB)
- `is_late` computed server-side: `submitted_at > due_at`
- Grade writes back to `assignment_submissions` — no separate "student record" table; dashboard queries this
- Inline quiz creation reuses existing `quizzes` insert; full question editor stays in existing admin flows

### Out of scope
- Video transcoding, real-time collab editing, comment threads on submissions, plagiarism check, gradebook exports, module-level prerequisites/gating.
