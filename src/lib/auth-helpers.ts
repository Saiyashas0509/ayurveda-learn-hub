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
  | "auditor";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  regional_manager: "Regional Manager",
  center_head_doctor: "Center Head Doctor",
  front_office: "Front Office",
  therapist: "Therapist",
  trainer: "Trainer",
  auditor: "Auditor",
};

export async function signOutFully() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") window.location.href = "/auth";
}
