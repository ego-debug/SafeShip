import { Skeleton, SkeletonCard } from "@/components/Skeleton";

// Mirrors the real DashboardView layout (header + score chart panel +
// recent runs panel + recent failures grid) so the page "fills in"
// rather than snapping from blank.
export default function DashboardLoading() {
  return (
    <main className="flex flex-col gap-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-32" />
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonCard>
          <PanelHeader />
          <div className="flex flex-col gap-4 p-5">
            <Skeleton className="h-16 w-40" />
            <Skeleton className="h-[220px] w-full" />
            <div className="flex justify-between">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-2 w-6" />
              ))}
            </div>
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <PanelHeader />
          <ul className="flex flex-col">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i === 0 ? "" : "border-t border-line"
                }`}
              >
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-3 flex-1" style={{ maxWidth: 200 }} />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </li>
            ))}
          </ul>
        </SkeletonCard>
      </section>

      <section className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i}>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </section>
    </main>
  );
}

function PanelHeader() {
  return (
    <header
      className="flex items-baseline justify-between border-b border-line px-5 py-3"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-20" />
    </header>
  );
}
