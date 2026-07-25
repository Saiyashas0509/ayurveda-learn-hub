import { describe, it, expect } from "vitest";
import { resolveVideoUrl, filenameFromVideoUrl, VIDEO_BASE_URL } from "./upload-video";

describe("resolveVideoUrl / filenameFromVideoUrl", () => {
  it("resolves a bare filename to the platform's video host", () => {
    expect(resolveVideoUrl("lesson-1.mp4")).toBe(`${VIDEO_BASE_URL}lesson-1.mp4`);
  });

  it("percent-encodes special characters in a bare filename", () => {
    expect(resolveVideoUrl("my lesson.mp4")).toBe(`${VIDEO_BASE_URL}my%20lesson.mp4`);
  });

  it("passes an already-full URL through unchanged", () => {
    const external = "https://example.com/video.mp4";
    expect(resolveVideoUrl(external)).toBe(external);
  });

  it("returns an empty string for empty input", () => {
    expect(resolveVideoUrl("  ")).toBe("");
  });

  it("round-trips: filenameFromVideoUrl undoes resolveVideoUrl for our own host", () => {
    const resolved = resolveVideoUrl("my lesson.mp4");
    expect(filenameFromVideoUrl(resolved)).toBe("my lesson.mp4");
  });

  it("leaves an external URL unchanged when extracting a display filename", () => {
    const external = "https://example.com/video.mp4";
    expect(filenameFromVideoUrl(external)).toBe(external);
  });
});
