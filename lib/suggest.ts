/**
 * Server-side suggest-engine entrypoint for the Next.js app.
 *
 * The pure engine logic lives in `./suggest-core` so the offline eval
 * runner (`evals/suggest/run.ts`) can exercise it without going through
 * Next.js' bundler — `server-only` throws when imported by plain Node.
 *
 * Application code should always import from `./suggest`, never
 * `./suggest-core`, so the server-only guard stays in place.
 */
import "server-only";

export {
  SYSTEM_PROMPT,
  isSuggestEngineConfigured,
  suggestFromRun,
  type Suggestion,
} from "./suggest-core";
