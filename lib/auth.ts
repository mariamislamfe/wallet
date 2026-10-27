// Shared by middleware (Edge runtime) and server actions (Node), so it only
// relies on Web Crypto.

export const SESSION_COOKIE = "wallet_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

export function getPasscode(): string | null {
  const passcode = process.env.APP_PASSCODE?.trim();
  return passcode ? passcode : null;
}

export async function sessionToken(passcode: string): Promise<string> {
  const bytes = new TextEncoder().encode(`wallet-session:v1:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const passcode = getPasscode();
  if (!passcode) return true;
  if (!token) return false;
  return safeEqual(token, await sessionToken(passcode));
}
