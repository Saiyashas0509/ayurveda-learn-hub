## Multi-tenant roles, organizations, and interest-driven onboarding

### Note on existing roles
The current `app_role` enum has: `super_admin, hr_admin, regional_manager, center_head_doctor, front_office, therapist, trainer, auditor` (no `admin`/`user`). I'll keep all of these working and ADD the new ones alongside.

---

### 1. Schema migration (extends, never drops)

**a. Expand `app_role` enum** — add: `student, doctor, franchise_owner, corporate_employee, hospital_staff, faculty, org_admin`. (`super_admin, therapist` already exist and will be reused.)

**b. New `organizations` table** — the tenant boundary:
- fields: `name, slug, org_type` (enum: `hospital | franchise | corporate | academy | internal`), `contact_email, logo_url, settings jsonb`
- GRANTs + RLS; readable by members, writable by `org_admin`/`super_admin`.

**c. Extend `centers`** — add `organization_id uuid references organizations(id)`, `center_type` (`clinic | franchise_branch | hospital_ward | training_campus`). Backfill existing centers into a default "Internal" org.

**d. Extend `employees`** — add `organization_id uuid` (denormalized from center for fast RLS), plus onboarding fields:
- `learning_interests text[]` (values from: Ayurveda Basics, Panchakarma, Nutrition, Yoga, Herbal Medicine, Research, Clinical Practice)
- `onboarding_completed_at timestamptz`
- `primary_role app_role` (the role chosen at signup; source of truth for dashboard routing — `user_roles` remains authoritative for permissions)

**e. Extend `pending_bootstrap`** — add `requested_role app_role`, `organization_id uuid`, `center_id uuid`, `learning_interests text[]`, `phone`, `designation`.

**f. New `has_org_access(uuid, uuid)` SECURITY DEFINER function** — returns true if user belongs to org OR is `super_admin`.

**g. Rewrite tenant-scoped RLS** on `employees`, `centers`, `courses`, `lessons`, `quizzes`, `announcements`, `certificates`, `lesson_progress`, `quiz_attempts`, `audit_logs`:
- Members read within their org.
- `org_admin` writes within their org.
- `super_admin` unrestricted.
- Existing self-read/self-update policies preserved.

---

### 2. Signup / bootstrap flow

**Auth page (`/auth`)** — after OTP verify, if the user has no `employees` row, route to a new multi-step onboarding wizard instead of the dashboard.

**Onboarding wizard (`/onboarding`, `_authenticated`, 3 steps):**
1. **Role & organization** — pick role from the expanded list; pick organization (dropdown of active orgs, filterable by type) and center (filtered by chosen org). Corporate/hospital employees see only their allow-listed org.
2. **Profile basics** — full name, phone, designation, employee code (optional per role).
3. **Learning interests** — multi-select chips (7 options above), minimum 1.

On submit, a `completeOnboarding` server fn (`requireSupabaseAuth`):
- Creates/updates `employees` row with org, center, interests, primary_role.
- Inserts corresponding `user_roles` row.
- Consumes `pending_bootstrap` if present (prefills wizard when it exists).
- Writes `audit_logs` entry.

---

### 3. Role-aware dashboard

Keep the existing `_authenticated/index.tsx` layout. Add a `useCurrentRoleView()` hook that returns `{ role, orgId, sidebarItems, statCards }` from a single config map:

- **student / corporate_employee / hospital_staff** — My Courses, Progress, Certificates, Announcements.
- **doctor / therapist / faculty** — above + Teaching Queue, Assigned Learners.
- **franchise_owner / org_admin** — Org Dashboard (learner counts, completion rate, active courses), Manage Members, Manage Centers (org-scoped).
- **hr_admin / regional_manager / center_head_doctor** — existing admin views, now org-scoped.
- **super_admin** — existing global admin (unchanged, cross-org).

Sidebar and stat cards read from the config; no per-role page duplication.

---

### 4. Technical section

- Migration order: enum add → `organizations` (+ grants/RLS) → columns on `centers`/`employees`/`pending_bootstrap` → backfill default org → `has_org_access()` → new RLS policies (drop old, recreate scoped versions in same migration).
- `has_org_access` marked `SECURITY DEFINER SET search_path=public` to avoid RLS recursion (same pattern as existing `has_role`).
- `employees.organization_id` kept in sync via trigger when `center_id` changes.
- All demo routes stay untouched (they use `supabaseAdmin` and remain read-only public).
- New server fns in `src/lib/onboarding.functions.ts` and `src/lib/org.functions.ts`.
- New files: `src/routes/_authenticated/onboarding.tsx`, `src/config/roleViews.ts`, `src/hooks/useCurrentRoleView.ts`.
- Types regenerate after migration approval, then component/hook code lands.

---

### Out of scope (call out for a follow-up)
- Course recommendation engine that consumes `learning_interests` — this plan only stores the data.
- Cross-org invitations / SSO for corporate tenants.
- Real OTP email delivery (still blocked on sender domain).

---

### Open question before I build
Should any employee be able to **self-select their organization** at signup, or must an `org_admin` pre-seed the email into `pending_bootstrap` (with org + role) and signup only completes if a match exists? The second option is safer for multi-tenant isolation; the first is friendlier for demos. I'll default to **pre-seed required for franchise/hospital/corporate**, **self-select allowed for `student`**, unless you say otherwise.
