import "server-only";
import { randomBytes } from "node:crypto";

const PREFIX = "sk_live_";

export function generateApiKey() {
  return PREFIX + randomBytes(24).toString("base64url");
}
