import { supabase } from "@/integrations/supabase/client";

// Uploads a lesson video directly to Hostinger (the same server that backs
// videos.travancoreayurvedalearning.com) via the admin-only /api/admin/upload-video
// route, which streams the request body straight to FTP — no Supabase Storage
// involved, and no 50MB size cap. Returns the public URL to store on the lesson.
export async function uploadVideoToHostinger(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/upload-video?filename=${encodeURIComponent(file.name)}`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { url?: string; error?: string };
          if (body.url) resolve(body.url);
          else reject(new Error(body.error ?? "Upload failed"));
        } catch {
          reject(new Error("Upload failed: invalid response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export async function deleteHostingerVideo(publicUrl: string): Promise<void> {
  const filename = publicUrl.split("/").pop();
  if (!filename) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`/api/admin/upload-video?filename=${encodeURIComponent(filename)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Delete failed");
}
