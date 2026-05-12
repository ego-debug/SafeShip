import "server-only";
import { getServiceSupabase } from "./supabase";

// Sliding-window per-project limits on Claude-touching endpoints.
// Counts every row in `suggested_tests` (each row = one Claude call we paid for).
// Defaults sized so that 5 customers all-out can't burn through a $10
// Anthropic spend cap in a single day at Sonnet 4.6 prices.

const DAILY_LIMIT = Number(process.env.SAFESHIP_SUGGEST_DAILY_LIMIT) || 50;
const BURST_LIMIT = Number(process.env.SAFESHIP_SUGGEST_BURST_LIMIT) || 5;
const BURST_WINDOW_SECONDS =
  Number(process.env.SAFESHIP_SUGGEST_BURST_WINDOW_SECONDS) || 300;
const DAILY_WINDOW_SECONDS = 24 * 3600;

// Traces ingestion limits — independent of Claude limits because ingestion
// is just DB writes, not LLM calls. Defaults are intentionally generous so
// legitimate high-volume agents aren't throttled, but tight enough that a
// leaked API key can't bloat the DB by millions of rows overnight.
const TRACES_DAILY_LIMIT =
  Number(process.env.SAFESHIP_TRACES_DAILY_LIMIT) || 5000;
const TRACES_BURST_LIMIT =
  Number(process.env.SAFESHIP_TRACES_BURST_LIMIT) || 100;
const TRACES_BURST_WINDOW_SECONDS =
  Number(process.env.SAFESHIP_TRACES_BURST_WINDOW_SECONDS) || 60;

export type RateLimitOk = { ok: true };
export type RateLimitDenied = {
  ok: false;
  reason: "burst_limit_exceeded" | "daily_limit_exceeded";
  retry_after_seconds: number;
  limit: number;
  window: string;
  current: number;
};
export type RateLimitResult = RateLimitOk | RateLimitDenied;

export async function checkSuggestRateLimit(
  projectId: string,
): Promise<RateLimitResult> {
  const supabase = getServiceSupabase();
  const now = Date.now();
  const dailyCutoff = new Date(now - DAILY_WINDOW_SECONDS * 1000).toISOString();
  const burstCutoff = new Date(now - BURST_WINDOW_SECONDS * 1000).toISOString();

  const [dailyRes, burstRes] = await Promise.all([
    supabase
      .from("suggested_tests")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", dailyCutoff),
    supabase
      .from("suggested_tests")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", burstCutoff),
  ]);

  const dailyCount = dailyRes.count ?? 0;
  const burstCount = burstRes.count ?? 0;

  // Check burst first (more specific window) so the error message is precise
  if (burstCount >= BURST_LIMIT) {
    return {
      ok: false,
      reason: "burst_limit_exceeded",
      retry_after_seconds: BURST_WINDOW_SECONDS,
      limit: BURST_LIMIT,
      window: `${Math.round(BURST_WINDOW_SECONDS / 60)} minutes`,
      current: burstCount,
    };
  }
  if (dailyCount >= DAILY_LIMIT) {
    return {
      ok: false,
      reason: "daily_limit_exceeded",
      retry_after_seconds: DAILY_WINDOW_SECONDS,
      limit: DAILY_LIMIT,
      window: "24 hours",
      current: dailyCount,
    };
  }
  return { ok: true };
}

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly limit: number;
  readonly window: string;
  readonly current: number;
  constructor(denied: RateLimitDenied) {
    super(denied.reason);
    this.name = "RateLimitError";
    this.retryAfterSeconds = denied.retry_after_seconds;
    this.limit = denied.limit;
    this.window = denied.window;
    this.current = denied.current;
  }
}

// Per-project ingestion limit on POST /v1/traces. Counts rows in `runs`
// (each accepted trace produces one runs row + N traces rows; we count
// runs so a single multi-step run = one unit of "ingestion").
export async function checkTracesRateLimit(
  projectId: string,
): Promise<RateLimitResult> {
  const supabase = getServiceSupabase();
  const now = Date.now();
  const dailyCutoff = new Date(now - DAILY_WINDOW_SECONDS * 1000).toISOString();
  const burstCutoff = new Date(
    now - TRACES_BURST_WINDOW_SECONDS * 1000,
  ).toISOString();

  const [dailyRes, burstRes] = await Promise.all([
    supabase
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("started_at", dailyCutoff),
    supabase
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("started_at", burstCutoff),
  ]);

  const dailyCount = dailyRes.count ?? 0;
  const burstCount = burstRes.count ?? 0;

  if (burstCount >= TRACES_BURST_LIMIT) {
    return {
      ok: false,
      reason: "burst_limit_exceeded",
      retry_after_seconds: TRACES_BURST_WINDOW_SECONDS,
      limit: TRACES_BURST_LIMIT,
      window: `${TRACES_BURST_WINDOW_SECONDS}s`,
      current: burstCount,
    };
  }
  if (dailyCount >= TRACES_DAILY_LIMIT) {
    return {
      ok: false,
      reason: "daily_limit_exceeded",
      retry_after_seconds: DAILY_WINDOW_SECONDS,
      limit: TRACES_DAILY_LIMIT,
      window: "24 hours",
      current: dailyCount,
    };
  }
  return { ok: true };
}
