// Automatic quiz generation: given a lesson's video/notes/description, uses
// Groq (Llama 3.3 70B, same free key as the AI assistant) to write a
// multiple-choice quiz, so faculty don't have to author one by hand for
// every video. If no transcript exists yet, transcribes first via Cloudflare
// Workers AI's Whisper (transcription.server.ts) — a separate provider from
// the Groq call this file makes for the actual quiz questions. Called from
// two places (course-builder.functions.ts):
//   - updateLesson, fire-and-forget, the moment a video is attached to a
//     lesson — so a quiz is usually ready well before anyone publishes.
//   - publishCourse, awaited, as a safety net for any lesson that still has
//     a video but no quiz at publish time (e.g. generation failed earlier,
//     or the video was added a different way) — this is what actually
//     guarantees "a quiz exists the moment the course is published."
import { transcribeVideo } from "@/lib/transcription.server";

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

const QUESTION_COUNT = 5;
const MIN_CONTENT_LENGTH = 40;

type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

function buildPrompt(content: string): { system: string; user: string } {
  return {
    system:
      "You write short multiple-choice quizzes for a corporate Ayurveda training platform. " +
      "You only ever respond with a single JSON object, no other text, matching exactly this shape: " +
      `{"questions":[{"prompt":string,"options":string[4],"correctIndex":0-3}, ...]}. ` +
      `Write exactly ${QUESTION_COUNT} questions. Each question must have exactly 4 options with exactly one correct ` +
      "answer. Base every question strictly on the material provided — never invent facts not present in it, and never " +
      "ask about anything outside the given material.",
    user: `Lesson material:\n\n${content}\n\nWrite the quiz now.`,
  };
}

export function validateQuestions(parsed: unknown): GeneratedQuestion[] | null {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { questions?: unknown }).questions)
  ) {
    return null;
  }
  const questions = (parsed as { questions: unknown[] }).questions;
  const valid: GeneratedQuestion[] = [];
  for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    const { prompt, options, correctIndex } = q as Record<string, unknown>;
    if (typeof prompt !== "string" || !prompt.trim()) continue;
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) continue;
    if (!options.every((o) => typeof o === "string" && o.trim())) continue;
    if (typeof correctIndex !== "number" || correctIndex < 0 || correctIndex >= options.length)
      continue;
    valid.push({
      prompt: prompt.trim(),
      options: options.map((o) => (o as string).trim()),
      correctIndex,
    });
  }
  return valid.length >= 3 ? valid : null;
}

async function callGroqForQuestions(content: string): Promise<GeneratedQuestion[] | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const { system, user } = buildPrompt(content);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[quiz-generation] Groq error:", res.status, body);
    return null;
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    return validateQuestions(JSON.parse(raw));
  } catch (e) {
    console.error("[quiz-generation] Failed to parse Groq response as JSON:", e);
    return null;
  }
}

export type QuizGenerationResult =
  | { status: "created"; quizId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

// Idempotent — safe to call repeatedly for the same lesson; does nothing if
// a quiz already exists for it.
export async function generateLessonQuiz(
  supabaseAdmin: SupabaseAdmin,
  lessonId: string,
): Promise<QuizGenerationResult> {
  const { data: existing } = await supabaseAdmin
    .from("quizzes")
    .select("id")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (existing) return { status: "skipped", reason: "A quiz already exists for this lesson" };

  const { data: lesson } = await supabaseAdmin
    .from("lessons")
    .select("id,title,description,key_notes,transcript,video_url,course_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return { status: "failed", reason: "Lesson not found" };

  let transcript = lesson.transcript;
  if (!transcript && lesson.video_url) {
    try {
      transcript = await transcribeVideo(supabaseAdmin, lessonId);
    } catch (e) {
      // Transcription failing (oversized video, Groq hiccup) shouldn't block
      // quiz generation entirely — fall back to whatever notes/description
      // exist below instead of giving up outright.
      console.error(`[quiz-generation] transcription failed for lesson ${lessonId}:`, e);
    }
  }

  const content = [lesson.title, lesson.description, lesson.key_notes, transcript]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join("\n\n")
    .slice(0, 12000);
  if (content.length < MIN_CONTENT_LENGTH) {
    return {
      status: "skipped",
      reason: "Not enough lesson content (video, notes, or description) to write a quiz from",
    };
  }

  const questions = await callGroqForQuestions(content);
  if (!questions) {
    return { status: "failed", reason: "AI quiz generation didn't return usable questions" };
  }

  const { data: quiz, error: quizError } = await supabaseAdmin
    .from("quizzes")
    .insert({
      course_id: lesson.course_id,
      lesson_id: lessonId,
      title: `${lesson.title} — Quiz`,
      pass_percent: 70,
    })
    .select("id")
    .single();
  if (quizError || !quiz) {
    console.error("[quiz-generation] Failed to create quiz row:", quizError?.message);
    return { status: "failed", reason: quizError?.message ?? "Could not create quiz" };
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: questionRow, error: questionError } = await supabaseAdmin
      .from("questions")
      .insert({ quiz_id: quiz.id, type: "mcq", prompt: q.prompt, sort_order: i })
      .select("id")
      .single();
    if (questionError || !questionRow) {
      console.error("[quiz-generation] Failed to insert question:", questionError?.message);
      continue;
    }
    const optionRows = q.options.map((text, idx) => ({
      question_id: questionRow.id,
      option_text: text,
      is_correct: idx === q.correctIndex,
      sort_order: idx,
    }));
    const { error: optionsError } = await supabaseAdmin.from("question_options").insert(optionRows);
    if (optionsError)
      console.error("[quiz-generation] Failed to insert options:", optionsError.message);
  }

  return { status: "created", quizId: quiz.id };
}
