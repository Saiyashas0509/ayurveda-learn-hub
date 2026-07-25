import { describe, it, expect } from "vitest";
import { orderCourseLessons } from "./lesson-order";

describe("orderCourseLessons", () => {
  it("orders lessons by module order first, then by sort_order within each module", () => {
    // Regression test: lessons.sort_order is only unique *within* a module,
    // so two modules both having a lesson at sort_order 0 must not collide —
    // this is the exact bug this function was extracted to prevent.
    const modules = [
      { id: "mod-2", sort_order: 1 },
      { id: "mod-1", sort_order: 0 },
    ];
    const lessons = [
      { id: "l-mod2-a", module_id: "mod-2", sort_order: 0 },
      { id: "l-mod1-a", module_id: "mod-1", sort_order: 0 },
      { id: "l-mod1-b", module_id: "mod-1", sort_order: 1 },
      { id: "l-mod2-b", module_id: "mod-2", sort_order: 1 },
    ];

    expect(orderCourseLessons(modules, lessons)).toEqual([
      "l-mod1-a",
      "l-mod1-b",
      "l-mod2-a",
      "l-mod2-b",
    ]);
  });

  it("appends module-less lessons last, ordered by their own sort_order", () => {
    const modules = [{ id: "mod-1", sort_order: 0 }];
    const lessons = [
      { id: "orphan-b", module_id: null, sort_order: 1 },
      { id: "in-module", module_id: "mod-1", sort_order: 0 },
      { id: "orphan-a", module_id: null, sort_order: 0 },
    ];

    expect(orderCourseLessons(modules, lessons)).toEqual(["in-module", "orphan-a", "orphan-b"]);
  });

  it("treats a lesson pointing at a nonexistent module as unassigned rather than dropping it", () => {
    const modules = [{ id: "mod-1", sort_order: 0 }];
    const lessons = [
      { id: "real", module_id: "mod-1", sort_order: 0 },
      { id: "dangling", module_id: "deleted-module", sort_order: 0 },
    ];

    const result = orderCourseLessons(modules, lessons);
    expect(result).toContain("dangling");
    expect(result.indexOf("real")).toBeLessThan(result.indexOf("dangling"));
  });

  it("returns an empty list for a course with no lessons", () => {
    expect(orderCourseLessons([], [])).toEqual([]);
  });
});
