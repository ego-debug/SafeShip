/** Best-effort JSON-friendly snapshot of arbitrary values. Mirrors the
 * Python SDK's _safe(): caps string size, bounds collections, never throws. */

const MAX_CHARS = 8 * 1024;
const MAX_ITEMS = 200;
const MAX_DEPTH = 6;

export function safe(value: unknown, depth = 0): unknown {
  try {
    if (value == null) return value;
    const t = typeof value;
    if (t === "string") {
      const s = value as string;
      return s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + "…" : s;
    }
    if (t === "number" || t === "boolean") return value;
    if (depth >= MAX_DEPTH) return "<max depth>";
    if (Array.isArray(value)) {
      return value.slice(0, MAX_ITEMS).map((v) => safe(v, depth + 1));
    }
    if (t === "object") {
      const out: Record<string, unknown> = {};
      let i = 0;
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (i++ >= MAX_ITEMS) break;
        out[String(k)] = safe(v, depth + 1);
      }
      return out;
    }
    // functions, symbols, bigints: stringify defensively
    const s = String(value);
    return s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + "…" : s;
  } catch {
    return "<unrepresentable>";
  }
}
