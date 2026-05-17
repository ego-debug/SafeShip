import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Skeleton } from "@/components/Skeleton";

// /status does a real Supabase round-trip + an Anthropic Statuspage fetch
// + a `health_checks` p95 aggregation on every render (cached 60s, but
// the first render after the TTL expires can take 1-2s). Without a
// loading state, that delay shows as a blank white page on cold cache.
export default function StatusLoading() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />
        <main className="flex flex-col gap-12 py-16">
          <header className="flex flex-col gap-4">
            <Skeleton className="h-3 w-16" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-9 w-72" />
            </div>
            <Skeleton className="h-3 w-72" />
          </header>

          <section className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <div className="overflow-hidden rounded-xl border border-line">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 ${
                    i === 5 ? "" : "border-b border-line"
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <Skeleton className="h-4 w-56" />
                    </div>
                    <Skeleton className="ml-[18px] h-3 w-72" />
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-7 w-36" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-5"
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-7 w-20" />
                  <Skeleton className="mt-2 h-3 w-16" />
                  <Skeleton className="mt-3 h-3 w-40" />
                </div>
              ))}
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
