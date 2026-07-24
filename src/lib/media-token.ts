// Signs/verifies short-lived tokens that gate access to /media/lessons/:id.
// Stateless (no DB/KV) — the signature itself proves the token wasn't forged
// and hasn't expired, so verification works from the raw Worker entry too.
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

async function computeSignature(lessonId: string, exp: number, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, textEncoder.encode(`${lessonId}.${exp}`));
  return toBase64Url(sigBuf);
}

export async function signMediaToken(
  lessonId: string,
  secret: string,
  ttlSeconds = 4 * 60 * 60,
): Promise<{ exp: number; sig: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: await computeSignature(lessonId, exp, secret) };
}

export async function verifyMediaToken(
  lessonId: string,
  exp: number,
  sig: string,
  secret: string,
): Promise<boolean> {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await computeSignature(lessonId, exp, secret);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
