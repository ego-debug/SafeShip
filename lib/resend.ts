import "server-only";
import { Resend } from "resend";

let _client: Resend | null = null;

/**
 * Get a Resend client, or null if RESEND_API_KEY isn't configured.
 *
 * The rest of the alerts pipeline checks for null and treats "no key"
 * as "feature disabled" rather than an error. This keeps local dev
 * working without a Resend account and lets /status report email
 * alerting as degraded without crashing.
 */
export function getResend(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}

/** Fixed sender address — Resend requires the domain to be verified. */
export const ALERT_FROM = "SafeShip Alerts <alerts@safeship.dev>";

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
