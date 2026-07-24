// Admin CRUD for organizations and centers — lets admins manage tenant
// structure from the dashboard instead of needing raw SQL/Supabase access.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "hr_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin role required");
}

export const ORG_TYPES = ["hospital", "franchise", "corporate", "academy", "internal"] as const;
export const CENTER_TYPES = [
  "clinic",
  "franchise_branch",
  "hospital_ward",
  "training_campus",
] as const;

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id,name,slug,org_type,contact_email,is_active,created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; name: string; orgType: string; contactEmail?: string }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(150),
        orgType: z.enum(ORG_TYPES),
        contactEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      name: data.name,
      org_type: data.orgType,
      contact_email: data.contactEmail || null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("organizations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const slug = slugify(data.name);
    const { data: inserted, error } = await supabaseAdmin
      .from("organizations")
      .insert({ ...payload, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const setOrganizationActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; isActive: boolean }) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("organizations")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCenters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("centers")
      .select("id,name,code,city,region,organization_id,center_type,created_at,organizations(name)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      name: string;
      code: string;
      city?: string;
      region?: string;
      organizationId: string;
      centerType: string;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          name: z.string().trim().min(2).max(150),
          code: z
            .string()
            .trim()
            .min(2)
            .max(20)
            .regex(/^[A-Za-z0-9-]+$/, "Code can only contain letters, numbers, and dashes"),
          city: z.string().trim().max(100).optional().or(z.literal("")),
          region: z.string().trim().max(100).optional().or(z.literal("")),
          organizationId: z.string().uuid(),
          centerType: z.enum(CENTER_TYPES),
        })
        .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      name: data.name,
      code: data.code.toUpperCase(),
      city: data.city || null,
      region: data.region || null,
      organization_id: data.organizationId,
      center_type: data.centerType,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("centers").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("centers")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Employees referencing this center have center_id set to NULL (ON DELETE
    // SET NULL) rather than being blocked — safe to delete outright.
    const { error } = await supabaseAdmin.from("centers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
