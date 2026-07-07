// Calendar aggregation across live classes, assignments, quiz deadlines.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CalEvent = {
  id: string;
  type: "live_class" | "assignment" | "quiz";
  title: string;
  start: string;
  end?: string | null;
  courseTitle?: string | null;
  courseSlug?: string | null;
  link: string;
};

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<CalEvent[]> => {
    const [lc, asg] = await Promise.all([
      context.supabase.from("live_classes")
        .select("id,title,starts_at,ends_at,courses(title,slug)")
        .gte("starts_at", data.from).lte("starts_at", data.to),
      context.supabase.from("assignments")
        .select("id,title,due_at,courses(title,slug)")
        .not("due_at", "is", null).gte("due_at", data.from).lte("due_at", data.to),
    ]);
    const events: CalEvent[] = [];
    for (const r of lc.data ?? []) {
      events.push({
        id: r.id, type: "live_class", title: r.title,
        start: r.starts_at, end: r.ends_at,
        courseTitle: (r.courses as { title?: string } | null)?.title ?? null,
        courseSlug: (r.courses as { slug?: string } | null)?.slug ?? null,
        link: `/live/${r.id}`,
      });
    }
    for (const r of asg.data ?? []) {
      events.push({
        id: r.id, type: "assignment", title: r.title,
        start: r.due_at as string,
        courseTitle: (r.courses as { title?: string } | null)?.title ?? null,
        courseSlug: (r.courses as { slug?: string } | null)?.slug ?? null,
        link: `/assignments/${r.id}`,
      });
    }
    return events;
  });

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function toIcsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function buildIcs(ev: { uid: string; title: string; start: string; end?: string | null; description?: string; url?: string }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Travancore Ayurveda LMS//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(ev.start)}`,
    ev.end ? `DTEND:${toIcsDate(ev.end)}` : `DTEND:${toIcsDate(new Date(new Date(ev.start).getTime() + 60 * 60 * 1000).toISOString())}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : "",
    ev.url ? `URL:${icsEscape(ev.url)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export const exportEventIcs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: "live_class" | "assignment"; id: string }) =>
    z.object({ type: z.enum(["live_class", "assignment"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.type === "live_class") {
      const { data: r } = await context.supabase.from("live_classes")
        .select("id,title,description,starts_at,ends_at,meeting_url").eq("id", data.id).maybeSingle();
      if (!r) throw new Error("Not found");
      return {
        filename: `live-class-${r.id}.ics`,
        content: buildIcs({ uid: `lc-${r.id}@lms`, title: r.title, start: r.starts_at, end: r.ends_at, description: r.description ?? "", url: r.meeting_url }),
      };
    }
    const { data: r } = await context.supabase.from("assignments")
      .select("id,title,instructions,due_at").eq("id", data.id).maybeSingle();
    if (!r || !r.due_at) throw new Error("Not found");
    return {
      filename: `assignment-${r.id}.ics`,
      content: buildIcs({ uid: `as-${r.id}@lms`, title: `Due: ${r.title}`, start: r.due_at as string, description: r.instructions ?? "" }),
    };
  });
