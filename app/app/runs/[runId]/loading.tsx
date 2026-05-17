import { Skeleton } from "@/components/Skeleton";

// Mirrors TraceDetailView: breadcrumb → status banner → run meta grid →
// timeline of step cards → action bar → raw trace sidebar.
export default function RunDetailLoading() {
  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <span className="text-fg-4">/</span>
          <Skeleton className="h-3 w-12" />
          <span className="text-fg-4">/</span>
          <Skeleton className="h-3 w-28" />
        </div>

        {/* Status banner */}
        <div
          className="rounded-xl border px-5 py-4"
          style={{
            background: "rgba(194,249,112,0.04)",
            borderColor: "rgba(194,249,112,0.18)",
          }}
        >
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>

        {/* Run meta grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        {/* Timeline */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <ol className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="overflow-hidden rounded-xl border border-line"
                style={{
                  background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
                }}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-3" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong px-4 py-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-9 w-44" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <aside>
        <section
          className="rounded-xl border border-line-strong"
          style={{
            background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          }}
        >
          <div
            className="flex items-center justify-between border-b border-line px-4 py-3"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-3" />
          </div>
        </section>
      </aside>
    </main>
  );
}
