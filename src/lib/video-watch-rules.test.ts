import { describe, it, expect } from "vitest";
import { isVideoWatchRequirementMet } from "./video-watch-rules";

describe("isVideoWatchRequirementMet", () => {
  it("is not met if the learner hasn't watched enough of the video", () => {
    expect(isVideoWatchRequirementMet(600, 300, false)).toBe(false);
  });

  it("is met once watched position reaches the 98% threshold", () => {
    expect(isVideoWatchRequirementMet(600, 588, false)).toBe(true);
    expect(isVideoWatchRequirementMet(600, 587, false)).toBe(false);
  });

  it("is met when the full duration has been watched", () => {
    expect(isVideoWatchRequirementMet(600, 600, false)).toBe(true);
  });

  it("is never met if a skip was detected, even after watching the whole thing", () => {
    expect(isVideoWatchRequirementMet(600, 600, true)).toBe(false);
  });

  it("is not gated at all when duration is unknown (null, 0, or negative)", () => {
    expect(isVideoWatchRequirementMet(null, 0, false)).toBe(true);
    expect(isVideoWatchRequirementMet(0, 0, false)).toBe(true);
    expect(isVideoWatchRequirementMet(-5, 0, false)).toBe(true);
  });

  it("an unknown duration is not gated even if a skip was reported", () => {
    // Can't meaningfully enforce "watched the whole thing" without knowing
    // how long "the whole thing" is — this is a deliberate no-gate case,
    // not a security hole, since it only applies to legacy videos with no
    // recorded duration.
    expect(isVideoWatchRequirementMet(null, 0, true)).toBe(true);
  });
});
