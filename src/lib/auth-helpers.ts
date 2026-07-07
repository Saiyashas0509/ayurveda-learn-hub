// Client-side auth helpers. Server-side authorization is enforced separately
// in every protected server function via requireSupabaseAuth + has_role().
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "hr_admin"
  | "regional_manager"
  | "center_head_doctor"
  | "front_office"
  | "therapist"
  | "trainer"
  | "auditor"
  | "student"
  | "doctor"
  | "franchise_owner"
  | "corporate_employee"
  | "hospital_staff"
  | "faculty"
  | "org_admin";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  regional_manager: "Regional Manager",
  center_head_doctor: "Center Head Doctor",
  front_office: "Front Office",
  therapist: "Therapist",
  trainer: "Trainer",
  auditor: "Auditor",
  student: "Student",
  doctor: "Doctor",
  franchise_owner: "Franchise Owner",
  corporate_employee: "Corporate Employee",
  hospital_staff: "Hospital Staff",
  faculty: "Faculty",
  org_admin: "Organization Admin",
};

// Roles that can be picked during self-signup (no pre-seeded pending_bootstrap).
// Others must be pre-registered by an admin so tenants stay isolated.
export const SELF_SIGNUP_ROLES: AppRole[] = ["student"];

export const LEARNING_INTERESTS = [
  "Ayurveda Basics",
  "Panchakarma",
  "Nutrition",
  "Yoga",
  "Herbal Medicine",
  "Research",
  "Clinical Practice",
] as const;
export type LearningInterest = (typeof LEARNING_INTERESTS)[number];

export type OrgType = "hospital" | "franchise" | "corporate" | "academy" | "internal";
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  hospital: "Hospital",
  franchise: "Franchise Center",
  corporate: "Corporate Client",
  academy: "Academy / Institute",
  internal: "Internal",
};

export async function signOutFully() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") window.location.href = "/auth";
}
