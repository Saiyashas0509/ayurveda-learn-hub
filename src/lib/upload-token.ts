// Signs short-lived, single-purpose tokens that authorize a direct
// browser-to-Hostinger video upload/delete, bypassing Cloudflare's proxy (and
// its request-size cap) entirely. The Worker verifies the caller's session +
// role and mints a token for one exact filename/action; the PHP relay on
// Hostinger verifies the signature with the same shared secret before acting
// on it. No credential is ever exposed to the browser — only this scoped,
// expiring token. Mirrors media-token.ts's HMAC approach.
const textEncoder = new TextEncoder();

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function computeSignature(
  action: "upload" | "delete",
  filename: string,
  exp: number,
  secret: string,
): Promise<string> {
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${action}.${filename}.${exp}`),
  );
  return toBase64Url(sigBuf);
}

export async function signUploadToken(
  action: "upload" | "delete",
  filename: string,
  secret: string,
  ttlSeconds = 600,
): Promise<{ exp: number; sig: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: await computeSignature(action, filename, exp, secret) };
}
