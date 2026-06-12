"use client";

import type { AdminUserRow } from "@/lib/admin";

export function UsersSection({
  users,
  deleteUser,
}: {
  users: AdminUserRow[];
  deleteUser: (formData: FormData) => Promise<void>;
}) {
  return (
    <section
      className="rounded-2xl border border-line-strong p-5"
      style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
    >
      <h2 className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
        Registered users
      </h2>
      <p className="mb-4 text-[12.5px] text-fg-3">
        Deleting a user removes all their SafeShip data (projects, traces,
        tests). It does not touch their sign-in account; if they sign in
        again they start fresh. Your own accounts can't be deleted from
        here.
      </p>

      {users.length === 0 ? (
        <p className="text-sm text-fg-3">No users yet.</p>
      ) : (
        <ul className="flex flex-col">
          {users.map((u, i) => (
            <li
              key={u.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 ${i === 0 ? "" : "border-t border-line"}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-[13px] text-fg">
                    {u.email}
                  </span>
                  {u.isAdmin && (
                    <span className="rounded-full border border-[rgba(194,249,112,0.35)] bg-[rgba(194,249,112,0.08)] px-2 py-[1px] font-mono text-[10px] uppercase text-accent">
                      you
                    </span>
                  )}
                  {isTestEmail(u.email) && (
                    <span className="rounded-full border border-[rgba(245,193,74,0.3)] bg-[rgba(245,193,74,0.08)] px-2 py-[1px] font-mono text-[10px] uppercase text-[#f5c14a]">
                      test data
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-fg-4">
                  {u.id} · joined {new Date(u.created_at).toLocaleDateString()} ·{" "}
                  {u.subscription_status}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-fg-3">
                {u.projects} project{u.projects === 1 ? "" : "s"} · {u.runs} run
                {u.runs === 1 ? "" : "s"}
              </span>
              {!u.isAdmin && (
                <form
                  action={deleteUser}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        `Delete ${u.email} and all their data (${u.projects} projects, ${u.runs} runs)? This can't be undone.`,
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-[7px] border border-[rgba(255,99,99,0.3)] bg-[rgba(255,99,99,0.06)] px-2.5 py-1 text-[12px] text-[#ff9c9c] transition-colors hover:bg-[rgba(255,99,99,0.14)]"
                  >
                    Delete
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isTestEmail(email: string): boolean {
  return (
    email.endsWith("@test.invalid") ||
    email.endsWith("@example.com") ||
    email.includes("+clerk_test") ||
    email.startsWith("e2e-")
  );
}
