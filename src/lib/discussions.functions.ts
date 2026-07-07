// Per-course discussions: threads, replies, likes, search.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; q?: string }) =>
    z.object({ courseId: z.string().uuid(), q: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("discussion_threads")
      .select("id,title,body,is_pinned,is_announcement,reply_count,like_count,last_activity_at,author_id,created_at")
      .eq("course_id", data.courseId)
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(200);
    if (data.q && data.q.trim()) {
      q = q.textSearch("search_tsv", data.q.trim(), { type: "websearch", config: "english" });
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.author_id)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = ids.length
      ? await supabaseAdmin.from("employees").select("id,full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    return (rows ?? []).map((r) => ({ ...r, author_name: nameById.get(r.author_id) ?? "Member" }));
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("discussion_threads")
      .select("id,course_id,author_id,title,body,is_pinned,is_announcement,reply_count,like_count,last_activity_at,created_at,updated_at")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread not found");
    const { data: replies } = await context.supabase
      .from("discussion_replies")
      .select("id,thread_id,parent_reply_id,author_id,body,like_count,is_faculty_answer,created_at")
      .eq("thread_id", data.id).order("created_at", { ascending: true });
    const { data: likes } = await context.supabase
      .from("discussion_likes").select("target_type,target_id")
      .eq("user_id", context.userId);
    const likedThreads = new Set((likes ?? []).filter((l) => l.target_type === "thread").map((l) => l.target_id));
    const likedReplies = new Set((likes ?? []).filter((l) => l.target_type === "reply").map((l) => l.target_id));
    const ids = Array.from(new Set([thread.author_id, ...(replies ?? []).map((r) => r.author_id)]));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emps } = ids.length
      ? await supabaseAdmin.from("employees").select("id,full_name").in("id", ids)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((emps ?? []).map((e) => [e.id, e.full_name]));
    return {
      thread: { ...thread, author_name: nameById.get(thread.author_id) ?? "Member", liked: likedThreads.has(thread.id) },
      replies: (replies ?? []).map((r) => ({ ...r, author_name: nameById.get(r.author_id) ?? "Member", liked: likedReplies.has(r.id) })),
    };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; title: string; body: string; isAnnouncement?: boolean }) =>
    z.object({
      courseId: z.string().uuid(),
      title: z.string().trim().min(2).max(200),
      body: z.string().trim().min(1).max(20000),
      isAnnouncement: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("discussion_threads")
      .insert({
        course_id: data.courseId, author_id: context.userId,
        title: data.title, body: data.body,
        is_announcement: !!data.isAnnouncement,
        is_pinned: !!data.isAnnouncement,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; body: string; parentReplyId?: string | null }) =>
    z.object({
      threadId: z.string().uuid(),
      body: z.string().trim().min(1).max(10000),
      parentReplyId: z.string().uuid().nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("discussion_replies").insert({
      thread_id: data.threadId,
      parent_reply_id: data.parentReplyId ?? null,
      author_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetType: "thread" | "reply"; targetId: string }) =>
    z.object({ targetType: z.enum(["thread", "reply"]), targetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("discussion_likes").select("target_id")
      .eq("user_id", context.userId).eq("target_type", data.targetType).eq("target_id", data.targetId).maybeSingle();
    if (existing.data) {
      await context.supabase.from("discussion_likes").delete()
        .eq("user_id", context.userId).eq("target_type", data.targetType).eq("target_id", data.targetId);
      return { liked: false };
    }
    await context.supabase.from("discussion_likes").insert({
      user_id: context.userId, target_type: data.targetType, target_id: data.targetId,
    });
    return { liked: true };
  });

export const pinThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; pinned: boolean }) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("discussion_threads")
      .update({ is_pinned: data.pinned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("discussion_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("discussion_replies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("courses").select("id,title,slug").eq("is_published", true).order("title");
    return data ?? [];
  });