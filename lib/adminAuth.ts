import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Standalone owner login for /admin, independent of Clerk — so the
 * founder can always reach their metrics even when app sign-in is
 * misbehaving. Credentials live in env (.env.local locally, Vercel env
 * in prod): ADMIN_LOGIN_USER, ADMIN_LOGIN_PASS, ADMIN_SESSION_SECRET.
 *
 * Session = `exp.hmac(exp)` in an httpOnly cookie. No DB, no JWT lib.
 */

export const ADMIN_COOKIE = "safeship_admin";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

function secret(): string | null {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    // Fallback keeps local dev working if only user/pass are set; any
    // server secret works as HMAC key material.
    process.env.CLERK_SECRET_KEY ||
    null
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function isAdminLoginConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_LOGIN_USER && process.env.ADMIN_LOGIN_PASS && secret(),
  );
}

export function verifyAdminCredentials(user: string, pass: string): boolean {
  const envUser = process.env.ADMIN_LOGIN_USER;
  const envPass = process.env.ADMIN_LOGIN_PASS;
  if (!envUser || !envPass) return false;
  // Evaluate both to keep timing independent of which field is wrong.
  const userOk = safeEqual(user, envUser);
  const passOk = safeEqual(pass, envPass);
  return userOk && passOk;
}

function sign(exp: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(exp).digest("base64url");
}

export function mintAdminSession(): { token: string; maxAgeSeconds: number } | null {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = sign(exp);
  if (!sig) return null;
  return { token: `${exp}.${sig}`, maxAgeSeconds: SESSION_TTL_MS / 1000 };
}

export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(exp);
  if (!expected || !safeEqual(sig, expected)) return false;
  return Number(exp) > Date.now();
}

/** True when the current request carries a valid owner session cookie. */
export function hasAdminSession(): boolean {
  return isValidAdminToken(cookies().get(ADMIN_COOKIE)?.value);
}
