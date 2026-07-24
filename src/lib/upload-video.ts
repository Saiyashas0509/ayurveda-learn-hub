import {
  requestVideoDelete,
  requestVideoDuration,
  requestVideoUpload,
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

// Uploads a lesson video straight to Hostinger from the browser — the Worker
// only issues a short-lived signed token (requestVideoUpload) authorizing
// this one filename, it never streams the file itself. That matters because
// Cloudflare's edge caps proxied request bodies well below typical lesson
// video sizes; going Worker-side for the actual bytes made large uploads fail
// unpredictably.
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

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as {
            url?: string;
            durationSeconds?: number | null;
            error?: string;
          };
          if (body.url) resolve({ url: body.url, durationSeconds: body.durationSeconds ?? null });
          else reject(new Error(body.error ?? "Upload failed"));
        } catch {
          reject(new Error("Upload failed: invalid response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    const form = new FormData();
    form.append("filename", filename);
    form.append("exp", String(exp));
    form.append("sig", sig);
    form.append("file", file);
    xhr.send(form);
  });
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
