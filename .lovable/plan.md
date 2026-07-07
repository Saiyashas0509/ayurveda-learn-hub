## Four features, one pass. Extends existing schema; no drops.

### 1. Per-course discussion forum

**Schema (migration):**
- `discussion_threads`: id, course_id, author_id, title, body, is_pinned, is_announcement, reply_count, like_count, last_activity_at, search_tsv (generated).
- `discussion_replies`: id, thread_id, parent_reply_id (nullable, self-ref for nesting), author_id, body, like_count, is_faculty_answer bool.
- `discussion_likes`: (user_id, target_type 'thread'|'reply', target_id) — unique composite.
- GIN index on `search_tsv`; trigger to maintain `reply_count`, `last_activity_at`, and `is_faculty_answer` (true when author has faculty/admin role).
- RLS: SELECT allowed when the user is enrolled in the course (existing `lesson_progress` or an `enrollments` link — reuse whichever exists; fall back to `has_role` faculty/admin OR EXISTS lesson_progress row for that course). Faculty/admin see all threads in courses they authored/teach. INSERT: authenticated + enrolled/faculty. UPDATE/DELETE: author or faculty. Pin/announcement flags: faculty only (check via trigger).

**Server fns** (`src/lib/discussions.functions.ts`, `requireSupabaseAuth`):
`listThreads({courseId, q?})`, `getThread({id})`, `createThread`, `createReply`, `toggleLike({targetType,targetId})`, `pinThread`, `deleteThread/Reply`, `searchThreads({courseId,q})` using `websearch_to_tsquery`.

**UI:** `_authenticated/courses.$slug/discussions.tsx` (list + search + New Thread), `.../$threadId.tsx` (thread view + nested replies + like buttons + pin toggle for faculty + faculty-answer badge). Add "Discussion" tab into existing course view.

### 2. Live Classes

**Schema:**
- `live_classes`: id, course_id, title, description, meeting_url, provider ('zoom'|'meet'|'teams'|'other'), starts_at, ends_at, host_id, created_at.
- `live_class_attendance`: (live_class_id, user_id) unique, joined_at, left_at nullable.
- `live_class_messages`: id, live_class_id, user_id, body, kind ('chat'|'raise_hand'|'system'), created_at.
- `live_class_polls`: id, live_class_id, question, options jsonb, closed_at.
- `live_class_poll_votes`: (poll_id, user_id) unique, option_index.
- Realtime enabled on `live_class_messages`, `live_class_poll_votes`.
- RLS: same enrolled-or-faculty rule; polls create/close = host/faculty.

**Server fns** (`src/lib/live-classes.functions.ts`): `listUpcoming({courseId?})`, `scheduleClass` (faculty), `joinClass({id})` (upsert attendance, returns meeting_url), `postMessage`, `raiseHand`, `createPoll`, `votePoll`, `closePoll`.

**UI:** `_authenticated/live/index.tsx` (upcoming + past), `_authenticated/live/$id.tsx` (Join button → opens meeting_url in new tab + logs attendance; side panel with realtime chat, raise-hand list, active poll). Faculty scheduling form under admin.

### 3. In-app notifications

**Schema extension:** add columns to `notifications`: `type text` ('assignment'|'result'|'live_class'|'announcement'|'discussion'|'system'), `is_read bool default false`, `read_at`, `link text` (in-app route), `data jsonb`. Backfill nullable.
- `notification_preferences`: user_id PK, in_app jsonb (per-type booleans, default all true), email_enabled bool default false, sms_enabled bool default false.
- Triggers to emit notifications on: new assignment, graded submission, new live class scheduled, new announcement, new reply to thread you authored.

**Server fns** (`src/lib/notifications.functions.ts`): `listMyNotifications({unreadOnly?})`, `markRead({ids})`, `markAllRead`, `getPreferences`, `updatePreferences`.

**UI:**
- Bell in `app-shell` header: dropdown showing last 10 with unread badge, "Mark all read", link to full page. Poll every 30s (or realtime subscribe to inserts filtered by user_id).
- `_authenticated/notifications.tsx`: full list, filter by type, mark read/unread, click → navigates to `link`.
- `_authenticated/settings/notifications.tsx`: per-type in-app toggles; email/SMS toggles rendered disabled with tooltip "Requires domain verification".

### 4. Calendar

**No new tables.** Aggregate from `live_classes.starts_at`, `assignments.due_at`, and quiz deadlines (add optional `quizzes.due_at` if missing; else use assignment-only + live classes).

**Server fn** `listCalendarEvents({from,to})`: unions user's enrolled-course live classes, assignments, quiz deadlines into `{id,type,title,start,end?,courseId,link}[]`.

**UI:** `_authenticated/calendar.tsx` — month/week toggle. Use lightweight custom grid (no heavy deps) or add `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/timegrid`. Prefer custom to avoid bundle bloat: build month grid from date-fns (already available). Color-coded chips: live=blue, assignment=amber, quiz=violet, announcement=green.

**.ics export:** server fn `exportEventIcs({type,id})` returns text with `Content-Type: text/calendar` — hand-rolled VCALENDAR/VEVENT (no dependency). Each event row has a "Download .ics" button.

### Sidebar wiring
`roleViews.ts`: add "Discussions" (contextual via course page), "Live Classes", "Calendar", "Notifications" for all learner roles; "Schedule Class" for faculty/admin.

### Technical notes
- Nested replies: single self-ref FK, render 2-level deep (deeper collapsed) to keep UI simple.
- Search: Postgres FTS with `websearch_to_tsquery('english', q)` against `search_tsv` (generated column: `to_tsvector('english', title || ' ' || body)`).
- Realtime for live-class chat: subscribe to `live_class_messages` filtered by `live_class_id` inside `useEffect`, cleanup on unmount.
- Attendance logging: `joinClass` upserts row with `joined_at=now()` only if not exists; no leave-tracking beyond an optional beacon on unload.
- Notification triggers use `SECURITY DEFINER` fns that insert into `notifications` filtered by user preference (`in_app->>type <> 'false'`).
- All new public tables get GRANT SELECT/INSERT/UPDATE/DELETE to authenticated + GRANT ALL to service_role, plus RLS.

### Out of scope
- WebRTC/native video (external meeting URLs only).
- Email/SMS delivery (blocked on domain verification per your note; UI shows the toggle).
- Push notifications (web push / mobile).
- Recurring live classes, calendar drag-to-reschedule.
- Moderation queue, report/flag on discussions.
- iCal feed subscription URL (per-event .ics only).
