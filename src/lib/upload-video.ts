import {
  requestVideoDelete,
  requestVideoDuration,
  requestVideoUpload,
  reportUploadFailure,
} from "@/lib/video-upload.functions";

export const VIDEO_BASE_URL = "https://videos.travancoreayurvedalearning.com/";

// Admins can type/paste either a bare filename (the common case — matches
// what's uploaded to Hostinger) or a full URL (e.g. an external host). This
// resolves whichever was entered into the actual URL that gets saved, so
// nobody has to remember or retype the public base URL, and so pasting the
// wrong kind of hPanel link (its internal file-manager URL, which looks like
// a URL but silently doesn't work) is a non-issue for the common case.
export function resolveVideoUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return VIDEO_BASE_URL + encodeURIComponent(trimmed);
}

// Inverse of resolveVideoUrl, for displaying an existing saved URL back as
// just the filename when it's one of ours.
export function filenameFromVideoUrl(url: string): string {
  if (url.startsWith(VIDEO_BASE_URL)) {
    try {
      return decodeURIComponent(url.slice(VIDEO_BASE_URL.length));
    } catch {
      return url.slice(VIDEO_BASE_URL.length);
    }
  }
  return url;
}

// Kept well under any web-server-level connection/timeout limit shared
// hosting tends to enforce independent of PHP's own settings — a single
// giant request for a 300MB+ video was intermittently failing partway
// through with a generic network error on slower connections, even though
// PHP's post_max_size/max_execution_time were raised.
//
// 2MB (not the original 5MB): real-world testing against this specific host
// showed throughput to it varies a lot run-to-run — anywhere from ~450KB/s
// to ~3MB/s from the same network path — so a 5MB chunk could take anywhere
// from 2 to 11+ seconds. A smaller chunk means less time exposed per request
// for a connection hiccup (WiFi drop, laptop sleep, a bad patch of the
// connection) to land in the middle of, and a cheaper retry when one does.
const CHUNK_SIZE = 2 * 1024 * 1024;
// Was 4 — bumped up since the failures this was tuned against are
// transient connection drops, not a wrong request; giving up after only a
// few seconds of backoff on a multi-minute upload wastes an upload that a
// little more patience would have completed.
const MAX_CHUNK_RETRIES = 8;

type ChunkResponse = {
  done: boolean;
  url?: string;
  durationSeconds?: number | null;
  error?: string;
};

function postChunk(
  uploadUrl: string,
  filename: string,
  exp: number,
  sig: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  onChunkProgress: (loaded: number) => void,
): Promise<ChunkResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.timeout = 120_000; // generous per-chunk cap; a 2MB chunk should never come close
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as ChunkResponse;
          if (body.error) reject(new Error(body.error));
          else resolve(body);
        } catch {
          reject(new Error("Upload failed: invalid response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));

    const form = new FormData();
    form.append("action", "upload-chunk");
    form.append("filename", filename);
    form.append("exp", String(exp));
    form.append("sig", sig);
    form.append("chunkIndex", String(chunkIndex));
    form.append("totalChunks", String(totalChunks));
    form.append("file", chunk, filename);
    xhr.send(form);
  });
}

// Retries a single chunk with backoff before giving up — a transient drop on
// one small piece shouldn't force re-uploading everything already sent.
async function postChunkWithRetry(
  uploadUrl: string,
  filename: string,
  exp: number,
  sig: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  onChunkProgress: (loaded: number) => void,
): Promise<ChunkResponse> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
    try {
      return await postChunk(
        uploadUrl,
        filename,
        exp,
        sig,
        chunk,
        chunkIndex,
        totalChunks,
        onChunkProgress,
      );
    } catch (err) {
      lastErr = err;
      onChunkProgress(0);
      if (attempt < MAX_CHUNK_RETRIES) {
        // Capped exponential-ish backoff — gives a slow/flaky connection real
        // time to recover instead of hammering it again immediately, without
        // ever waiting so long a single chunk stalls the whole upload.
        await new Promise((r) => setTimeout(r, Math.min(1500 * attempt, 8000)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Chunk upload failed");
}

// Uploads a lesson video straight to Hostinger from the browser — the Worker
// only issues a short-lived signed token (requestVideoUpload) authorizing
// this one filename, it never streams the file itself. That matters because
// Cloudflare's edge caps proxied request bodies well below typical lesson
// video sizes; going Worker-side for the actual bytes made large uploads fail
// unpredictably. The file itself is sent in small chunks (see CHUNK_SIZE)
// with per-chunk retry, so a large video over a slow or flaky connection
// doesn't need one uninterrupted multi-minute request to succeed.
//
// The relay also reads the video's duration straight off the file it just
// wrote to disk and returns it here immediately — Hostinger's static file
// server intermittently 412s Range requests against just-written files,
// which is what made the old browser-side <video> metadata probe silently
// fail right after upload. Reading the file locally on the server has none
// of that fragility.
export async function uploadVideoToHostinger(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; durationSeconds: number | null }> {
  const { uploadUrl, filename, exp, sig } = await requestVideoUpload({
    data: { filename: file.name },
  });

  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  let uploadedBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkSize = end - start;

    let result: ChunkResponse;
    try {
      result = await postChunkWithRetry(
        uploadUrl,
        filename,
        exp,
        sig,
        chunk,
        i,
        totalChunks,
        (loaded) => {
          if (!onProgress) return;
          onProgress(Math.round(((uploadedBytes + loaded) / file.size) * 100));
        },
      );
    } catch (err) {
      const pct = Math.round((uploadedBytes / file.size) * 100);
      const reason = err instanceof Error ? err.message : "unknown error";
      // Best-effort — the report itself failing shouldn't hide the real
      // error from the person trying to upload right now.
      reportUploadFailure({
        data: {
          filename: file.name,
          fileSizeBytes: file.size,
          chunkIndex: i,
          totalChunks,
          percentComplete: pct,
          errorMessage: reason,
        },
      }).catch(() => {});
      throw new Error(
        `Upload failed at ${pct}% after several retries (${reason}). This usually means the ` +
          "connection is too unstable for the remaining transfer — try again on a more stable " +
          "connection (wired/Wi-Fi rather than mobile data), or a smaller/shorter video file.",
      );
    }
    uploadedBytes += chunkSize;
    onProgress?.(Math.round((uploadedBytes / file.size) * 100));

    if (result.done) {
      if (!result.url) throw new Error("Upload finished without a URL");
      return { url: result.url, durationSeconds: result.durationSeconds ?? null };
    }
  }
  throw new Error("Upload did not complete");
}

// Looks up the duration of a video already sitting on Hostinger (used when an
// admin types an existing filename instead of uploading, and to backfill
// lessons saved before duration detection existed). Same server-side,
// no-HTTP-range-request approach as the upload path.
export async function getHostingerVideoDuration(filename: string): Promise<number | null> {
  if (!filename || /^https?:\/\//i.test(filename)) return null;
  const { uploadUrl, exp, sig } = await requestVideoDuration({ data: { filename } });
  const form = new FormData();
  form.append("action", "duration");
  form.append("filename", filename);
  form.append("exp", String(exp));
  form.append("sig", sig);
  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { durationSeconds?: number | null };
  return body.durationSeconds ?? null;
}

export async function deleteHostingerVideo(publicUrl: string): Promise<void> {
  const filename = filenameFromVideoUrl(publicUrl);
  if (!filename || /^https?:\/\//i.test(filename)) return;

  const { uploadUrl, exp, sig } = await requestVideoDelete({ data: { filename } });

  const form = new FormData();
  form.append("action", "delete");
  form.append("filename", filename);
  form.append("exp", String(exp));
  form.append("sig", sig);

  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new Error("Delete failed");
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!body.ok) throw new Error(body.error ?? "Delete failed");
}
