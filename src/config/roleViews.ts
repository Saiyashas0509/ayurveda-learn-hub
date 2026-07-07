import type { AppRole } from "@/lib/auth-helpers";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  User,
  Shield,
  Bell,
  Users,
  Building2,
  GraduationCap,
  ClipboardList,
  Wrench,
  ClipboardCheck,
  FileText,
  Video,
  CalendarDays,
  MessagesSquare,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
export type NavGroup = { label: string; items: NavItem[] };
export type StatKey = "completedLessons" | "inProgress" | "certificates" | "availableCourses" | "orgMembers" | "orgCourses" | "orgCompletions" | "pendingReviews";

export type RoleView = {
  headline: string;
  nav: NavGroup[];
  stats: StatKey[];
};

const learnerGroup: NavGroup = {
  label: "Learning",
  items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/catalog", label: "Course Catalog", icon: BookOpen },
    { to: "/assignments", label: "My Assignments", icon: FileText },
    { to: "/live", label: "Live Classes", icon: Video },
    { to: "/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/notifications", label: "Notifications", icon: Bell },
    { to: "/certificates", label: "Certificates", icon: Award },
    { to: "/profile", label: "My Profile", icon: User },
  ],
};

const facultyGroup: NavGroup = {
  label: "Teaching",
  items: [
    { to: "/admin/courses", label: "Course Builder", icon: Wrench },
    { to: "/admin/submissions", label: "Grading", icon: ClipboardCheck },
    { to: "/admin/live", label: "Schedule Class", icon: Video },
    { to: "/catalog", label: "My Courses", icon: BookOpen },
  ],
};

const orgAdminGroup: NavGroup = {
  label: "Organization",
  items: [
    { to: "/admin", label: "Org Dashboard", icon: Building2 },
    { to: "/admin/users", label: "Members", icon: Users },
    { to: "/admin/announcements", label: "Announcements", icon: Bell },
  ],
};

const platformAdminGroup: NavGroup = {
  label: "Administration",
  items: [
    { to: "/admin", label: "Admin Overview", icon: Shield },
    { to: "/admin/users", label: "Users", icon: User },
    { to: "/admin/courses", label: "Course Builder", icon: Wrench },
    { to: "/admin/submissions", label: "Grading", icon: ClipboardCheck },
    { to: "/admin/live", label: "Schedule Class", icon: Video },
    { to: "/admin/announcements", label: "Announcements", icon: Bell },
    { to: "/admin/audit-logs", label: "Audit Logs", icon: ClipboardList },
  ],
};

const learnerStats: StatKey[] = ["completedLessons", "inProgress", "certificates", "availableCourses"];
const orgAdminStats: StatKey[] = ["orgMembers", "orgCourses", "orgCompletions", "certificates"];
const facultyStats: StatKey[] = ["orgMembers", "pendingReviews", "orgCourses", "completedLessons"];

export const ROLE_VIEWS: Record<AppRole, RoleView> = {
  student: { headline: "Your learning journey", nav: [learnerGroup], stats: learnerStats },
  corporate_employee: { headline: "Your training track", nav: [learnerGroup], stats: learnerStats },
  hospital_staff: { headline: "Continuing education", nav: [learnerGroup], stats: learnerStats },
  therapist: { headline: "Your clinical training", nav: [learnerGroup], stats: learnerStats },
  front_office: { headline: "Your training", nav: [learnerGroup], stats: learnerStats },

  doctor: { headline: "Clinical practice & teaching", nav: [learnerGroup, facultyGroup], stats: facultyStats },
  faculty: { headline: "Teaching dashboard", nav: [learnerGroup, facultyGroup], stats: facultyStats },
  trainer: { headline: "Trainer dashboard", nav: [learnerGroup, facultyGroup], stats: facultyStats },

  franchise_owner: { headline: "Your franchise", nav: [learnerGroup, orgAdminGroup], stats: orgAdminStats },
  org_admin: { headline: "Your organization", nav: [learnerGroup, orgAdminGroup], stats: orgAdminStats },
  center_head_doctor: { headline: "Center leadership", nav: [learnerGroup, orgAdminGroup], stats: orgAdminStats },
  regional_manager: { headline: "Regional operations", nav: [learnerGroup, orgAdminGroup], stats: orgAdminStats },

  hr_admin: { headline: "HR administration", nav: [learnerGroup, platformAdminGroup], stats: orgAdminStats },
  auditor: { headline: "Audit console", nav: [platformAdminGroup], stats: orgAdminStats },
  super_admin: { headline: "Platform overview", nav: [learnerGroup, platformAdminGroup], stats: orgAdminStats },
};

export const STAT_META: Record<StatKey, { label: string; tone: "success" | "primary" | "gold" | "muted" }> = {
  completedLessons: { label: "Completed lessons", tone: "success" },
  inProgress: { label: "In progress", tone: "primary" },
  certificates: { label: "Certificates", tone: "gold" },
  availableCourses: { label: "Available courses", tone: "muted" },
  orgMembers: { label: "Org members", tone: "primary" },
  orgCourses: { label: "Assigned courses", tone: "muted" },
  orgCompletions: { label: "Completions this month", tone: "success" },
  pendingReviews: { label: "Pending reviews", tone: "gold" },
};

export function pickPrimaryRole(roles: AppRole[]): AppRole {
  // Prefer the highest-privilege role for view routing.
  const order: AppRole[] = [
    "super_admin", "hr_admin", "org_admin", "franchise_owner",
    "regional_manager", "center_head_doctor", "auditor",
    "faculty", "trainer", "doctor",
    "therapist", "front_office", "hospital_staff", "corporate_employee", "student",
  ];
  for (const r of order) if (roles.includes(r)) return r;
  return "student";
}

export const _icon: unknown = [GraduationCap, MessagesSquare]; // keep icon imports stable