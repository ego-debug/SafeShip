import Link from "next/link";

export default function RunNotFound() {
  return (
    <main className="grid place-items-center py-24">
      <div
        className="flex max-w-md flex-col gap-4 rounded-2xl border border-line-strong p-8 text-center"
        style={{
          background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        }}
      >
        <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          404
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          Run not found.
        </h1>
        <p className="text-fg-2">
          Either this run doesn&apos;t exist, or it belongs to a different
          project. Check the URL or jump back to the dashboard.
        </p>
        <Link
          href="/app/dashboard"
          className="mx-auto inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
        >
          ← back to dashboard
        </Link>
      </div>
    </main>
  );
}
