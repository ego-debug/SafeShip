// Client-safe helpers only. Anything that imports `node:*` lives in
// `apiKey.server.ts` so it never gets bundled into the browser.

const PREFIX = "sk_live_";

export function maskApiKey(key: string) {
  if (!key.startsWith(PREFIX)) return "•".repeat(8);
  const tail = key.slice(-4);
  return `${PREFIX}••••••••${tail}`;
}
