// Thin wrapper around Resend's HTTP API (no SDK needed — one fetch call).
// Degrades to a no-op (logged) when RESEND_API_KEY isn't configured, so
// callers never need to guard on whether email is set up.
const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Travancore Ayurveda Learning <notifications@travancoreayurvedalearning.com>";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

// Shared wrapper so every notification email looks the same without every
// call site hand-rolling HTML.
export function emailTemplate(params: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `<p style="margin:24px 0 0"><a href="${params.ctaUrl}" style="background:#1B4332;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">${params.ctaLabel}</a></p>`
      : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
    <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#888;margin:0 0 8px">Travancore Ayurveda Learning</p>
    <h1 style="font-size:18px;margin:0 0 12px">${params.heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#444;margin:0">${params.body}</p>
    ${cta}
    <p style="margin-top:32px;font-size:11px;color:#999">You're receiving this because email notifications are turned on in your account settings.</p>
  </div>`;
}
