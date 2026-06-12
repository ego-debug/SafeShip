/**
 * Verifies the owner user-management functions:
 * - listAdminUsers includes a freshly created throwaway user
 * - deleteUserEverywhere removes it (and cascades its project)
 * - deleteUserEverywhere refuses admin accounts
 *
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/verify-admin-delete.ts
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

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (!ok) failures += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const { getServiceSupabase } = await import("../lib/supabase");
  const { listAdminUsers, deleteUserEverywhere } = await import("../lib/admin");
  const supabase = getServiceSupabase();

  const tempId = "user_delete_me_test";
  await supabase.from("users").upsert({ id: tempId, email: "delete-me@test.invalid" }, { onConflict: "id" });
  await supabase.from("projects").insert({
    user_id: tempId,
    name: "throwaway",
    environment: "prod",
    api_key: "sk_live_throwaway_delete_me_0000000",
  });

  const before = await listAdminUsers();
  const row = before.find((u) => u.id === tempId);
  check("throwaway user appears in list", Boolean(row), row ? `${row.projects} project(s)` : "");
  check("throwaway user shows its project", (row?.projects ?? 0) === 1);

  const del = await deleteUserEverywhere(tempId);
  check("delete succeeds", del.ok, del.ok ? "" : del.error);

  const after = await listAdminUsers();
  check("user gone from list", !after.some((u) => u.id === tempId));
  const { data: orphanProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", tempId);
  check("project cascaded away", (orphanProjects ?? []).length === 0);

  const adminId = (process.env.ADMIN_USER_IDS ?? "").split(",")[0]?.trim();
  if (adminId) {
    const refuse = await deleteUserEverywhere(adminId);
    check("refuses to delete an admin account", !refuse.ok);
  }

  console.log("");
  console.log(failures === 0 ? "ADMIN DELETE VERIFICATION: ALL PASSED" : `ADMIN DELETE VERIFICATION: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("crashed:", e);
  process.exit(1);
});
