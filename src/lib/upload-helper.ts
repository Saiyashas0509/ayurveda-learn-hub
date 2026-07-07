import { getUploadUrl } from "@/lib/course-builder.functions";

// Uploads a file to Supabase Storage via a signed URL minted server-side.
// Returns the storage path — treat it as file_url (we resolve to signed URL on read).
export async function uploadToBucket(opts: {
  bucket: "course-media" | "assignment-submissions";
  file: File;
  pathPrefix: string; // e.g. `courses/${courseId}/lessons/${lessonId}` or `${userId}/${assignmentId}`
  onProgress?: (pct: number) => void;
}): Promise<{ path: string; publicUrl: string; kind: string }> {
  const safeName = opts.file.name.replace(/[^a-zA-Z0-9.\-_]+/g, "_");
  const path = `${opts.pathPrefix}/${Date.now()}-${safeName}`;
  const signed = await getUploadUrl({ data: { bucket: opts.bucket, path } });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.signedUrl, true);
    xhr.setRequestHeader("Content-Type", opts.file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(opts.file);
  });

  const ext = (safeName.split(".").pop() || "").toLowerCase();
  const kind = ["mp4", "webm", "mov"].includes(ext) ? "video"
    : ext === "pdf" ? "pdf"
    : ["ppt", "pptx"].includes(ext) ? "ppt"
    : ["doc", "docx"].includes(ext) ? "doc"
    : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image"
    : ext === "zip" ? "zip" : "other";

  return { path, publicUrl: signed.publicUrl, kind };
}