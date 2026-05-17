import { Skeleton } from "@/components/Skeleton";

// Mirrors TestsView: header + heads-up banner + filter bar + tests table
// + sidebar (suite health donut + coverage card).
export default function TestsLoading() {
  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-60" />
          </div>
        </header>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-16" />
            ))}
          </div>
          <Skeleton className="h-7 w-64" />
        </div>

        {/* Table */}
        <div
          className="overflow-hidden rounded-2xl border border-line-strong"
          style={{
            background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          }}
        >
          <div
            className="grid items-center gap-4 border-b border-line px-4 py-2.5"
            style={{ gridTemplateColumns: "20px 1fr 80px 100px 110px 32px" }}
          >
            <span />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12 justify-self-end" />
            <Skeleton className="h-3 w-16 justify-self-end" />
            <Skeleton className="h-3 w-14 justify-self-end" />
            <span />
          </div>
          <ul className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className={`grid items-center gap-4 px-4 py-3 ${
                  i === 0 ? "" : "border-t border-line"
                }`}
                style={{ gridTemplateColumns: "20px 1fr 80px 100px 110px 32px" }}
              >
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-72" />
                  <div className="mt-1 flex gap-1.5">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12 justify-self-end" />
                <Skeleton className="h-3 w-4 justify-self-end" />
                <Skeleton className="h-3 w-14 justify-self-end" />
                <Skeleton className="h-4 w-4 justify-self-end" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <section
            key={i}
            className="rounded-2xl border border-line-strong p-5"
            style={{
              background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
            }}
          >
            <Skeleton className="mb-3 h-3 w-28" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          </section>
        ))}
      </aside>
    </main>
  );
}
