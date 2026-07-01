# Travancore Ayurveda LMS — v1 Plan

Thin slice across the full stack: real auth, real DB, real content flow, seeded so you can log in and click through everything today. Deeper features (reports, cert QR verification page, advanced quiz types, etc.) layer on in follow-up turns.

## 1. Foundation
- Enable Lovable Cloud (Supabase-managed: DB, Auth, Storage, server functions).
- Enable Lovable Emails (built-in sender for OTPs — you can add a custom domain later).
- Ayurvedic design system: white base, deep forest green `#1B4332`, gold `#C9A227`, warm sand `#F5EFE6`, charcoal text. Serif display (Fraunces) + humanist sans (Inter). Semantic tokens in `styles.css` — no hardcoded colors in components.

## 2. Authentication (highest priority)
- **Passwordless email OTP only.** No public signup — signup UI removed.
- Login flow: enter company email → server verifies employee record exists & is active → generate 6-digit OTP, hash & store with 5-min expiry → email via Lovable Emails → verify (single-use, hash-compared) → issue Supabase session.
- Rate limits (DB-tracked): max 3 OTP requests per email per 15 min; max 5 verify attempts per OTP; 5 consecutive failed logins locks account 30 min.
- Session: Supabase JWT in httpOnly-equivalent storage, auto-logout after 30 min idle (client watchdog + server re-check on every protected fn).
- Every protected server function uses `requireSupabaseAuth` + role check via `has_role()` SECURITY DEFINER function. Client-side role checks are UX-only; server is source of truth.
- Full audit log on: login success/fail, OTP issued, OTP verified, account locked, role change, user created/disabled.

## 3. Database schema (all with RLS + GRANTs)
Core:
- `centers` — clinic locations
- `employees` — profile linked to `auth.users(id)`, with `center_id`, `employee_code`, `status` (active/disabled)
- `app_role` enum: super_admin, hr_admin, regional_manager, center_head_doctor, front_office, therapist, trainer, auditor
- `user_roles` (separate table — never on profile; `has_role()` security-definer fn)
- `otp_codes` — hashed code, email, expires_at, consumed_at, attempts
- `login_attempts` — email, ip, success, created_at (for rate limiting + lockout)
- `audit_logs` — actor_id, action, target, metadata, ip, created_at

Learning:
- `course_categories` (seeded with the 11 categories you listed)
- `courses` — title, description, category_id, cover, published
- `lessons` — course_id, order, title, video_url, transcript, pdf_url, key_notes, resources[]
- `quizzes` — lesson_id, pass_percent, time_limit_sec, max_attempts
- `questions` — quiz_id, type (mcq/tf/image), prompt, image_url, points
- `question_options` — question_id, text, is_correct
- `quiz_attempts` — user_id, quiz_id, score, passed, started_at, finished_at
- `attempt_answers` — attempt_id, question_id, selected_option_id
- `lesson_progress` — user_id, lesson_id, watched_seconds, completed_at
- `certificates` — user_id, course_id, cert_id (uuid), issued_at, pdf_url
- `announcements` — title, body, audience_roles[], published_at
- `notifications` — user_id, title, body, read_at

## 4. Route structure
Public: `/`, `/auth` (email→OTP→verify), `/verify/[certId]` (QR cert verification).
Authenticated (`_authenticated/`, integration-managed gate):
- `/dashboard` — welcome, progress ring, pending/completed counts, latest announcements, leaderboard top 5, Continue Learning
- `/catalog` — categories grid → course list
- `/courses/$courseId` — lesson list + progress
- `/lessons/$lessonId` — video player, tabs (Transcript / Notes / PDF / Resources), Take Quiz CTA
- `/quiz/$quizId` — timer, randomized questions, submit → score screen
- `/certificates` — mine, download PDF
- `/profile` — name, center, role
Admin (`_authenticated/_admin/`, role-gated to super_admin/hr_admin):
- `/admin/users` — list, create user (email+name+role+center), activate/disable, assign role
- `/admin/courses` — CRUD courses + lessons + quizzes (form-based, video URL for v1 — Storage upload UI in follow-up)
- `/admin/announcements`
- `/admin/audit-logs`
- `/admin/reports` — course completion, quiz scores, compliance, CSV export

## 5. Server functions (representative)
`requestLoginOtp`, `verifyLoginOtp`, `getMyDashboard`, `getCourse`, `getLesson`, `saveLessonProgress`, `startQuizAttempt`, `submitQuizAttempt`, `issueCertificate`, admin: `createEmployeeUser`, `setUserRole`, `setUserStatus`, `upsertCourse`, `upsertLesson`, `upsertQuiz`, `publishAnnouncement`, `getAuditLogs`, `getReports`, `exportReportCsv`.

## 6. Seed data
- 4 centers, 11 course categories, 1 sample course ("NABH Compliance Basics") with 2 lessons + 1 quiz (5 MCQs).
- Super Admin seed: since you didn't provide an email, I'll seed `admin@travancoreayurveda.com` as super_admin. On first login you'll get an OTP; then you can create real users via /admin/users. Tell me a different email any time and I'll swap it.

## 7. Out of scope for v1 (build in follow-ups)
- Video upload UI to Supabase Storage (v1 uses URL field; player still works)
- Certificate PDF generation (v1 renders an on-screen printable certificate; PDF export next turn)
- QR code image on certificates (verification page exists; QR image in follow-up)
- SITA/attendance modules, deep leaderboard scoring rules, email template editor UI
- CSP headers & advanced browser hardening (Supabase + TanStack defaults cover most; tuning in follow-up)

## Technical notes
- Stack is TanStack Start (not Next.js — Lovable's modern React stack). Same DX, SSR-ready, deployed on Cloudflare. All your other requirements (Supabase, RLS, Storage, Realtime, TypeScript, Tailwind, shadcn) apply identically.
- Emails via Lovable Emails (not Resend) per your choice — swappable later.
- Every table gets explicit GRANTs + RLS policies scoped to `auth.uid()` or `has_role()`.

Reply "go" (or with a different super-admin email) and I'll build.
