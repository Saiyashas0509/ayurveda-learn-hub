// Pure course-wide lesson sequencing, split out of learning.functions.ts so
// it's unit-testable without mocking Supabase.
//
// lessons.sort_order is only unique *within a module* (see reorderLessons in
// course-builder.functions.ts), not across the whole course — so ordering
// lessons by sort_order alone interleaves modules arbitrarily instead of
// giving a real course-wide sequence. This resolves the true sequence:
// modules by their own sort_order, lessons within each by their sort_order,
// with any module-less lessons appended last by their own sort_order. Used
// for sequential lesson unlocking (a lesson requires the previous one in
// this sequence to be completed).
export type ModuleRow = { id: string; sort_order: number };
export type LessonRow = { id: string; module_id: string | null; sort_order: number };

export function orderCourseLessons(modules: ModuleRow[], lessons: LessonRow[]): string[] {
  const moduleOrder = new Map(
    [...modules].sort((a, b) => a.sort_order - b.sort_order).map((m, i) => [m.id, i]),
  );
  const assigned = lessons.filter((l) => l.module_id && moduleOrder.has(l.module_id));
  const unassigned = lessons.filter((l) => !l.module_id || !moduleOrder.has(l.module_id));
  assigned.sort((a, b) => {
    const mo = (moduleOrder.get(a.module_id!) ?? 0) - (moduleOrder.get(b.module_id!) ?? 0);
    return mo !== 0 ? mo : a.sort_order - b.sort_order;
  });
  unassigned.sort((a, b) => a.sort_order - b.sort_order);
  return [...assigned, ...unassigned].map((l) => l.id);
}
