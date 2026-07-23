// Live classes: schedule, join (log attendance), messages, polls.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FACULTY_ROLES = ["super_admin", "hr_admin", "trainer", "faculty", "org_admin"] as const;
async function assertFaculty(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...FACULTY_ROLES]);
  if (!data || data.length === 0) throw new Error("Forbidden: faculty required");
}

export const listLiveClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId?: string; scope?: "upcoming" | "past" | "all" }) =>
    z
      .object({
        courseId: z.string().uuid().optional(),
        scope: z.enum(["upcoming", "past", "all"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("live_classes")
      .select(
        "id,course_id,title,description,provider,starts_at,ends_at,host_id,courses(title,slug)",
      )
      .order("starts_at", { ascending: true })
      .limit(200);
    if (data.courseId) q = q.eq("course_id", data.courseId);
    if (data.scope === "upcoming") q = q.gte("starts_at", new Date().toISOString());
    if (data.scope === "past") q = q.lt("starts_at", new Date().toISOString());
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Admin-facing list: adds search, provider filter, and attendee counts.
// Bypasses per-course enrollment RLS since admins need visibility across all courses.
export const listLiveClassesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      courseId?: string;
      scope?: "upcoming" | "past" | "all";
      provider?: "zoom" | "meet" | "teams" | "other" | "all";
      search?: string;
      page?: number;
      pageSize?: number;
    }) =>
      z
        .object({
          courseId: z.string().uuid().optional(),
          scope: z.enum(["upcoming", "past", "all"]).default("all"),
          provider: z.enum(["zoom", "meet", "teams", "other", "all"]).default("all"),
          search: z.string().trim().max(200).optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(20),
        })
        .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("live_classes")
      .select(
        "id,course_id,title,description,provider,starts_at,ends_at,host_id,courses(title,slug)",
        { count: "exact" },
      )
      .order("starts_at", { ascending: false });
    if (data.courseId) q = q.eq("course_id", data.courseId);
    if (data.provider !== "all") q = q.eq("provider", data.provider);
    if (data.scope === "upcoming") q = q.gte("starts_at", new Date().toISOString());
    if (data.scope === "past") q = q.lt("starts_at", new Date().toISOString());
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.ilike("title", `%${s}%`);
    }
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    q = q.range(from, to);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: attendance } = await supabaseAdmin
        .from("live_class_attendance")
        .select("live_class_id")
        .in("live_class_id", ids);
      for (const a of attendance ?? [])
        counts.set(a.live_class_id, (counts.get(a.live_class_id) ?? 0) + 1);
    }

    return {
      rows: (rows ?? []).map((r) => ({ ...r, attendeeCount: counts.get(r.id) ?? 0 })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / data.pageSize)),
    };
  });

export const cancelClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("live_classes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "live_class_cancelled",
      target: data.id,
    });
    return { ok: true };
  });

export const listClassAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string }) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("live_class_attendance")
      .select("user_id,joined_at,left_at,employees(full_name,email)")
      .eq("live_class_id", data.classId)
      .order("joined_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLiveClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls, error } = await context.supabase
      .from("live_classes")
      .select(
        "id,course_id,title,description,meeting_url,provider,starts_at,ends_at,host_id,courses(title,slug)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cls) throw new Error("Class not found");
    const { data: polls } = await context.supabase
      .from("live_class_polls")
      .select("id,question,options,closed_at,created_by,created_at")
      .eq("live_class_id", data.id)
      .order("created_at", { ascending: true });
    return { cls, polls: polls ?? [] };
  });

export const scheduleClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      courseId: string;
      title: string;
      description?: string;
      meetingUrl: string;
      provider: "zoom" | "meet" | "teams" | "other";
      startsAt: string;
      endsAt?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional(),
          courseId: z.string().uuid(),
          title: z.string().trim().min(2).max(200),
          description: z.string().max(4000).optional(),
          meetingUrl: z.string().url().max(1000),
          provider: z.enum(["zoom", "meet", "teams", "other"]),
          startsAt: z.string(),
          endsAt: z.string().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const payload = {
      course_id: data.courseId,
      title: data.title,
      description: data.description ?? null,
      meeting_url: data.meetingUrl,
      provider: data.provider,
      starts_at: data.startsAt,
      ends_at: data.endsAt ?? null,
      host_id: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("live_classes")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("live_classes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const joinClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls, error } = await context.supabase
      .from("live_classes")
      .select("id,meeting_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cls) throw new Error("Class not found");
    await context.supabase.from("live_class_attendance").upsert(
      {
        live_class_id: data.id,
        user_id: context.userId,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "live_class_id,user_id", ignoreDuplicates: true },
    );
    return { meetingUrl: cls.meeting_url };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string }) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("live_class_messages")
      .select("id,user_id,body,kind,created_at")
      .eq("live_class_id", data.classId)
      .order("created_at", { ascending: true })
      .limit(500);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = ids.length
      ? await supabaseAdmin.from("employees").select("id,full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    return (rows ?? []).map((r) => ({ ...r, author_name: nameById.get(r.user_id) ?? "Member" }));
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string; body: string; kind?: "chat" | "raise_hand" }) =>
    z
      .object({
        classId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        kind: z.enum(["chat", "raise_hand"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("live_class_messages").insert({
      live_class_id: data.classId,
      user_id: context.userId,
      body: data.body,
      kind: data.kind ?? "chat",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createPoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string; question: string; options: string[] }) =>
    z
      .object({
        classId: z.string().uuid(),
        question: z.string().trim().min(2).max(500),
        options: z.array(z.string().trim().min(1).max(200)).min(2).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { data: row, error } = await context.supabase
      .from("live_class_polls")
      .insert({
        live_class_id: data.classId,
        question: data.question,
        options: data.options,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const votePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pollId: string; optionIndex: number }) =>
    z.object({ pollId: z.string().uuid(), optionIndex: z.number().int().min(0).max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("live_class_poll_votes").upsert(
      {
        poll_id: data.pollId,
        user_id: context.userId,
        option_index: data.optionIndex,
      },
      { onConflict: "poll_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closePoll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pollId: string }) => z.object({ pollId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFaculty(context.userId);
    const { error } = await context.supabase
      .from("live_class_polls")
      .update({ closed_at: new Date().toISOString() })
      .eq("id", data.pollId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPollResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pollId: string }) => z.object({ pollId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: votes } = await context.supabase
      .from("live_class_poll_votes")
      .select("option_index,user_id")
      .eq("poll_id", data.pollId);
    const counts: Record<number, number> = {};
    for (const v of votes ?? []) counts[v.option_index] = (counts[v.option_index] ?? 0) + 1;
    const my = (votes ?? []).find((v) => v.user_id === context.userId);
    return { counts, myVote: my?.option_index ?? null, total: (votes ?? []).length };
  });

export const listRaisedHands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { classId: string }) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("live_class_messages")
      .select("id,user_id,created_at")
      .eq("live_class_id", data.classId)
      .eq("kind", "raise_hand")
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = ids.length
      ? await supabaseAdmin.from("employees").select("id,full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    return (rows ?? []).map((r) => ({ ...r, name: nameById.get(r.user_id) ?? "Member" }));
  });
