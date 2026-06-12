import { redirect } from "next/navigation";
import { hasAdminSession, isAdminLoginConfigured } from "@/lib/adminAuth";
import { adminLogin } from "./actions";

export const dynamic = "force-dynamic";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (hasAdminSession()) redirect("/admin");

  const error =
    searchParams.error === "bad"
      ? "Wrong username or password."
      : searchParams.error === "unconfigured"
        ? "Owner login isn't configured. Set ADMIN_LOGIN_USER, ADMIN_LOGIN_PASS and ADMIN_SESSION_SECRET in the environment."
        : null;

  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-16">
      <div
        className="w-full max-w-sm rounded-2xl border border-line-strong p-7"
        style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
      >
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Owner access
        </span>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
          SafeShip metrics
        </h1>
        <p className="mt-1 text-[13px] text-fg-3">
          This page is for the founder only.
        </p>

        {error && (
          <p
            className="mt-4 rounded-lg border px-3 py-2 text-[13px]"
            style={{
              background: "rgba(255,99,99,0.06)",
              borderColor: "rgba(255,99,99,0.3)",
              color: "#ff9c9c",
            }}
          >
            {error}
          </p>
        )}

        {isAdminLoginConfigured() && (
          <form action={adminLogin} className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-fg-4">
                Username
              </span>
              <input
                name="user"
                autoComplete="username"
                required
                className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-[rgba(255,255,255,0.25)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-fg-4">
                Password
              </span>
              <input
                name="pass"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-[rgba(255,255,255,0.25)]"
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
            >
              Sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
