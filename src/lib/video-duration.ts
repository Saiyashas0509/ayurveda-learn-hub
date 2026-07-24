// Reads a video's real length client-side via the HTML5 video element's
// metadata (no download of the full file, no CORS requirements for this —
// only pixel-level access like <canvas> needs that). Used so lesson duration
// is detected automatically instead of relying on someone typing it in.
export function detectVideoDurationSeconds(url: string, timeoutMs = 15000): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      finish(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };

    video.src = url;
  });
}
