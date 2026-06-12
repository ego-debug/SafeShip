/**
 * Verifies the admin snapshot loader and the isAdmin gate.
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/verify-admin.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}

async function main() {
  const { isAdmin, getAdminSnapshot } = await import("../lib/admin");

  const admins = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  console.log(`ADMIN_USER_IDS configured: ${admins.length} id(s)`);
  console.log(`isAdmin(first admin): ${admins.length ? isAdmin(admins[0].trim()) : "n/a"}`);
  console.log(`isAdmin(random stranger): ${isAdmin("user_not_an_admin")}`);

  const s = await getAdminSnapshot();
  console.log("snapshot:", JSON.stringify({
    waitlist: { total: s.waitlist.total, last7d: s.waitlist.last7d, recent: s.waitlist.recent.length },
    users: s.users,
    projects: s.projects,
    runs: s.runs,
    suggestions: s.suggestions,
    tests: s.tests,
  }, null, 2));
}

main().catch((e) => {
  console.error("verify-admin crashed:", e);
  process.exit(1);
});
