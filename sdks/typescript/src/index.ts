/** SafeShip TypeScript SDK.
 *
 * Quickstart:
 *
 *   import { safeship } from "safeship";
 *
 *   safeship.init({ apiKey: process.env.SAFESHIP_API_KEY! });
 *   const agent = safeship.wrap(myAgent);
 *
 * Every call to agent(...) ships a trace to your SafeShip dashboard.
 * Tracing failures NEVER crash your agent.
 *
 * On serverless platforms (Vercel, Lambda), await safeship.flush() before
 * the handler returns so background trace delivery isn't frozen mid-send.
 */

import { resolveConfig, setConfig, getConfig, resetConfig, type InitOptions } from "./config.js";
import { installInstrumentation, uninstallInstrumentation } from "./instrument.js";
import { flush } from "./transport.js";
import { step, wrap, type StepOptions } from "./wrap.js";

export type { InitOptions, StepOptions };

/** Configure the SDK. Call once near process startup. */
export function init(opts: InitOptions = {}): void {
  const cfg = resolveConfig(opts);
  setConfig(cfg);
  if (cfg.autoInstrument) {
    installInstrumentation();
  } else {
    uninstallInstrumentation();
  }
}

/** Disable the SDK and restore the unpatched fetch. Mostly for tests. */
export function shutdown(): void {
  uninstallInstrumentation();
  resetConfig();
}

export { wrap, step, flush, getConfig };

/** Namespace export so `import { safeship } from "safeship"` works. */
export const safeship = { init, wrap, step, flush, shutdown };

export default safeship;
