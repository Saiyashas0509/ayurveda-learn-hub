import type { TourStep } from "@/components/tour/tour";

// Steps target persistent AppShell chrome (sidebar nav, header buttons) —
// not page-specific content — so the tour works the same regardless of
// which page the user happens to land on right after signing in.
export const EMPLOYEE_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-/dashboard"]',
    title: "Welcome to Travancore Ayurveda Learning",
    body: "Quick tour of where everything lives — takes about 30 seconds. Your Dashboard shows your progress and recommended courses.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/catalog"]',
    title: "Course Catalog",
    body: "Browse every course assigned to your role. Click a course to see its lessons and start watching.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/assignments"]',
    title: "My Assignments",
    body: "If a course includes an assignment, submit your work here — you'll be notified once it's graded.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/live"]',
    title: "Live Classes",
    body: "Scheduled live sessions for your courses appear here — join right from this page when one starts.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/calendar"]',
    title: "Calendar",
    body: "See upcoming live classes and assignment deadlines at a glance.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/notifications"]',
    title: "Notifications",
    body: "Announcements, grading results, and reminders show up here.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/certificates"]',
    title: "Certificates",
    body: "Completed courses generate a certificate automatically, viewable and verifiable here.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/profile"]',
    title: "My Profile",
    body: "Your role, center, and designation — managed by HR. Contact your administrator if anything needs updating.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="header-help"]',
    title: "Help, anytime",
    body: "This Help button has a full written guide — signing in, quizzes, certificates, and more. Come back to it whenever you're unsure.",
  },
];

export const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-/admin"]',
    title: "Welcome, Admin",
    body: "A fast tour of the admin tools — everything here that used to need Supabase/SQL access now has a page.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/admin/users"]',
    title: "Users",
    body: "See every employee, their role and center, disable an account, or add a new employee directly. Click any employee's name to open their full profile — registration details, login history (IP, device, location), and a complete activity log.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/admin/organizations"]',
    title: "Organizations & Centers",
    body: "Add or edit centers and organizations here — new centers show up immediately in employee sign-up.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/admin/courses"]',
    title: "Course Builder",
    body: "Create courses, add lessons, and drop in videos (drag-and-drop, or just type the filename). Duration is detected automatically, and you can add or remove a cover image for each course.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/admin/submissions"]',
    title: "Grading",
    body: "Review and grade submitted assignments here.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="nav-/admin/audit-logs"]',
    title: "Audit Logs",
    body: "Login Activity shows who's signed in, for how long, and from where (IP, device, approximate location). All Events is the complete admin action trail — course changes, role assignments, everything.",
    opensSidebar: true,
  },
  {
    target: '[data-tour="header-help"]',
    title: "Help, anytime",
    body: "The Help button has a written guide for both employees and admins — come back to it whenever you need a refresher.",
  },
];
