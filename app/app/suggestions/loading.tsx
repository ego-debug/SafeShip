import { Skeleton } from "@/components/Skeleton";

// Mirrors SuggestionsView: header + focus card + up-next preview + sidebar.
export default function SuggestionsLoading() {
  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-60" />
          </div>
          <Skeleton className="h-9 w-56" />
        </header>

        {/* Focus card */}
        <article
          className="flex flex-col gap-5 rounded-2xl border border-line-strong p-6"
          style={{
            background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-72" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
          </div>

          <div
            className="rounded-xl border px-4 py-3"
            style={{
              background: "rgba(194,249,112,0.04)",
              borderColor: "rgba(194,249,112,0.18)",
            }}
          >
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-1.5 h-4 w-5/6" />
          </div>

          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-14" />
            <div className="flex flex-col gap-2 rounded-md border border-line p-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>

          <div className="flex gap-2.5">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-24" />
          </div>
        </article>

        {/* Up next preview */}
        <div className="mt-2 flex flex-col gap-1.5">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3" style={{ opacity: 0.85 - i * 0.18 }}>
              <Skeleton className="h-3 w-3" />
              <Skeleton className="h-3 flex-1" style={{ maxWidth: 240 }} />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <section
            key={i}
            className="rounded-2xl border border-line-strong p-5"
            style={{
              background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
            }}
          >
            <Skeleton className="mb-3 h-3 w-28" />
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </section>
        ))}
      </aside>
    </main>
  );
}
