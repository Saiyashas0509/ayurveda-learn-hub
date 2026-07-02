// Public (unauthenticated) demo server functions.
// Reads only safe columns from published courses so anyone can browse the
// learner experience without an account. Never exposes quiz correctness,
// user progress, PII, or admin data.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getDemoDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [courses, announcements, categories] = await Promise.all([
    supabase.from("courses").select("id,title,slug,description,cover_url,duration_minutes,category_id,course_categories(name)").eq("is_published", true).limit(6),
    supabase.from("announcements").select("id,title,body,published_at").order("published_at", { ascending: false }).limit(5),
    supabase.from("course_categories").select("id,name").order("sort_order"),
  ]);
  return {
    courses: courses.data ?? [],
    announcements: announcements.data ?? [],
    categories: categories.data ?? [],
  };
});

export const getDemoCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [cats, courses] = await Promise.all([
    supabase.from("course_categories").select("id,name,slug").order("sort_order"),
    supabase.from("courses").select("id,title,slug,description,cover_url,duration_minutes,category_id").eq("is_published", true).order("created_at", { ascending: false }),
  ]);
  return { categories: cats.data ?? [], courses: courses.data ?? [] };
});

export const getDemoCourse = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: course } = await supabase
      .from("courses")
      .select("id,title,slug,description,duration_minutes,course_categories(name,slug)")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!course) return { course: null, lessons: [] };
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id,title,sort_order,duration_seconds")
      .eq("course_id", course.id)
      .order("sort_order");
    return { course, lessons: lessons ?? [] };
  });

export const getDemoLesson = createServerFn({ method: "GET" })
  .inputValidator((data: { lessonId: string }) => z.object({ lessonId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id,title,video_url,pdf_url,key_notes,transcript,duration_seconds,course_id,courses(id,title,slug)")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (!lesson) return { lesson: null, quiz: null };
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id,title,pass_percent,time_limit_seconds")
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    return { lesson, quiz };
  });

export const getDemoQuiz = createServerFn({ method: "GET" })
  .inputValidator((data: { quizId: string }) => z.object({ quizId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("id,title,pass_percent,time_limit_seconds")
      .eq("id", data.quizId)
      .maybeSingle();
    if (!quiz) return { quiz: null, questions: [] };
    const { data: questions } = await supabase
      .from("questions")
      .select("id,type,prompt,image_url,sort_order,question_options(id,option_text,sort_order)")
      .eq("quiz_id", data.quizId)
      .order("sort_order");
    // Strip is_correct (not even fetched) and normalize
    const sanitized = (questions ?? []).map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      image_url: q.image_url,
      options: (q.question_options ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => ({ id: o.id, text: o.option_text })),
    }));
    return { quiz, questions: sanitized };
  });