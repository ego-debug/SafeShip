import { redirect } from "next/navigation";

// The owner metrics page moved to /admin (standalone login, outside the
// customer app shell). Keep this path working for old bookmarks.
export default function LegacyAdminRedirect() {
  redirect("/admin");
}
