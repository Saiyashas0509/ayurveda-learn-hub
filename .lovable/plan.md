## Problem

OTP emails aren't landing (no verified sender domain yet), so you're blocked from signing in and can't see the dashboard or learning pages.

## Plan: Add a "Demo mode" so you can walk through the app without auth

I'll add a public, read-only demo of the learner experience — dashboard, catalog, course, lesson, and quiz pages — populated from the seeded NABH course. This unblocks you today; real OTP login stays intact for when the email domain is set up.

### 1. Public demo routes (no auth, SSR-safe)
- `src/routes/demo.index.tsx` → demo dashboard (welcome, sample stats, seeded announcements, "Continue learning" card)
- `src/routes/demo.catalog.tsx` → course catalog listing seeded courses
- `src/routes/demo.courses.$slug.tsx` → course detail with lessons
- `src/routes/demo.lessons.$lessonId.tsx` → lesson player (video/PDF/text)
- `src/routes/demo.quiz.$quizId.tsx` → quiz preview (questions only, no scoring persistence)

Each route loads via a new public server fn `getDemoData` that uses the server publishable client to read only safe columns from `courses`, `lessons`, `quizzes`, `question_options` (stripping `is_correct`), and `announcements`.

### 2. Landing page CTA
Add a secondary "Preview the platform (demo)" button on `/` next to "Sign in", linking to `/demo`.

### 3. Auth page hint
On `/auth`, add a small "Just want to look around? Try the demo" link below the OTP form.

### 4. Visual "Demo mode" banner
A slim top banner on all `/demo/*` routes: "You're viewing a read-only demo. Sign in to track progress and earn certificates." with a link to `/auth`.

### 5. Do NOT touch
- Real `/dashboard`, `/catalog`, `/courses/*`, `/lessons/*`, `/quiz/*` routes — they stay auth-gated.
- Auth flow, RLS, or admin functions.
- The hydration warning on `/auth` (unrelated visual warning, not a blocker).

## After you approve

Once you're in demo mode and happy with the UI, the two follow-up paths are:
1. Set up the email sender domain so real OTP login works (unlocks progress tracking, certificates, admin).
2. Or, if you'd rather not deal with email right now, I can add a temporary password-based login for a single seeded Super Admin account so you can use the *real* dashboard as an admin.

Tell me which of those you want next.
