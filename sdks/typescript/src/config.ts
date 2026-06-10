/** SDK configuration. Resolved once at init(); env vars fill gaps. */

export type SafeShipConfig = {
  apiKey: string | null;
  endpoint: string;
  projectName: string | null;
  environment: string;
  timeoutMs: number;
  debug: boolean;
  enabled: boolean;
  autoInstrument: boolean;
};

export type InitOptions = Partial<{
  apiKey: string;
  endpoint: string;
  projectName: string;
  environment: string;
  timeoutMs: number;
  debug: boolean;
  enabled: boolean;
  autoInstrument: boolean;
}>;

// www is the canonical host. The apex 307-redirects to www and some HTTP
// clients drop the Authorization header when following it.
const DEFAULT_ENDPOINT = "https://www.safeship.dev/v1/traces";

let current: SafeShipConfig = defaults();

function defaults(): SafeShipConfig {
  return {
    apiKey: null,
    endpoint: DEFAULT_ENDPOINT,
    projectName: null,
    environment: "prod",
    timeoutMs: 10000,
    debug: false,
    enabled: true,
    autoInstrument: true,
  };
}

function env(name: string): string | undefined {
  // process may be absent in non-Node runtimes; never crash on access.
  try {
    return typeof process !== "undefined" ? process.env?.[name] : undefined;
  } catch {
    return undefined;
  }
}

export function resolveConfig(opts: InitOptions): SafeShipConfig {
  const envAuto = env("SAFESHIP_AUTO_INSTRUMENT");
  return {
    apiKey: opts.apiKey ?? env("SAFESHIP_API_KEY") ?? null,
    endpoint: opts.endpoint ?? env("SAFESHIP_ENDPOINT") ?? DEFAULT_ENDPOINT,
    projectName: opts.projectName ?? null,
    environment: opts.environment ?? "prod",
    // Generous on purpose: delivery is fire-and-forget, so a long timeout
    // never blocks the agent. A tight one silently drops traces when the
    // ingest API is slow (cold start, cross-region round-trip).
    timeoutMs: opts.timeoutMs ?? 10000,
    debug: opts.debug ?? false,
    enabled: opts.enabled ?? true,
    autoInstrument:
      opts.autoInstrument ??
      (envAuto != null ? envAuto.toLowerCase() !== "false" : true),
  };
}

export function setConfig(cfg: SafeShipConfig): void {
  current = cfg;
}

export function getConfig(): SafeShipConfig {
  return current;
}

export function resetConfig(): void {
  current = defaults();
}

export function debugLog(...args: unknown[]): void {
  if (current.debug) {
    // eslint-disable-next-line no-console
    console.warn("[safeship]", ...args);
  }
}
