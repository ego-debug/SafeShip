// Live integration check against a locally-running SafeShip dev server.
// Not part of `npm test` (needs the Next.js app up). Run manually:
//   node test/integration-local.mjs [port]
//
// Proves the BUILT package (dist/) speaks the real wire protocol: the
// request must reach the API's auth layer and come back 401
// invalid_api_key for a bogus key. A 401 here is success: wire format,
// headers, and endpoint are all correct, only the key is fake.

import { safeship } from "../dist/index.js";

const port = process.argv[2] ?? "3026";

let sawAuthRejection = false;
const origWarn = console.warn;
console.warn = (...args) => {
  if (args.join(" ").includes("ingest rejected trace (401)")) sawAuthRejection = true;
  origWarn(...args);
};

safeship.init({
  apiKey: "sk_live_integration_bogus_key",
  // 127.0.0.1, not localhost: Node's fetch tries IPv6 ::1 first on
  // Windows while Next dev binds IPv4, which reads as a timeout.
  endpoint: `http://127.0.0.1:${port}/v1/traces`,
  debug: true,
});

const agent = safeship.wrap(async (q) => `answered: ${q}`, "integration_agent");
const out = await agent("does the wire protocol work?");
await safeship.flush();

if (out !== "answered: does the wire protocol work?") {
  console.error("FAIL: wrapped agent returned wrong value:", out);
  process.exit(1);
}
if (!sawAuthRejection) {
  console.error("FAIL: never saw the API's 401 invalid_api_key rejection");
  process.exit(1);
}
console.log("PASS: built package reached the real API auth layer (401 on bogus key, agent unaffected)");
