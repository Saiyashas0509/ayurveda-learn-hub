// Google Meet integration for live classes — a trainer connects their own
// Google account (plain OAuth, works with a free personal Gmail account, no
// Google Workspace subscription needed) once, and from then on scheduling a
// class can auto-create a Google Calendar event with an auto-generated Meet
// link via the free Calendar API, instead of the trainer pasting a link they
// made by hand elsewhere.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getSiteOrigin } from "@/lib/site-origin";

function redirectUri(): string {
  return `${getSiteOrigin()}/auth/google/callback`;
}

export const getGoogleConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("trainer_google_tokens")
      .select("google_email,connected_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      connected: !!data,
      email: data?.google_email ?? null,
      configured: !!process.env.GOOGLE_CLIENT_ID,
    };
  });

export const getGoogleAuthStartUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { state: string }) =>
    z.object({ state: z.string().min(16).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Google integration isn't configured yet — ask your admin.");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      state: data.state,
      scope: "https://www.googleapis.com/auth/calendar.events email",
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  });

export const completeGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) =>
    z.object({ code: z.string().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google integration isn't configured yet.");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[google-meet] token exchange failed:", tokenRes.status, body);
      throw new Error("Couldn't connect your Google account. Please try again.");
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!tokens.refresh_token) {
      throw new Error(
        "Google didn't return a refresh token — disconnect this app's access in your Google " +
          "Account settings and try connecting again (this can happen on a reconnect).",
      );
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = (await userInfoRes.json().catch(() => ({}))) as { email?: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trainer_google_tokens").upsert({
      user_id: context.userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      google_email: userInfo.email ?? null,
      connected_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, email: userInfo.email ?? null };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trainer_google_tokens").delete().eq("user_id", context.userId);
    return { ok: true };
  });

// Returns a live access_token for the given trainer, refreshing it first if
// it's expired (or about to be). Used by scheduleClass in
// live-classes.functions.ts right before calling the Calendar API.
export async function getValidGoogleAccessToken(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabaseAdmin
    .from("trainer_google_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const expiresInMs = new Date(row.expires_at).getTime() - Date.now();
  if (expiresInMs > 60_000) return row.access_token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const refreshed = (await res.json()) as { access_token: string; expires_in: number };
  await supabaseAdmin
    .from("trainer_google_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return refreshed.access_token;
}
