import { Skeleton } from "@/components/Skeleton";

// Mirrors BillingView's general shape: header + status banner + plan card
// + action buttons row. Stripe sub state varies but the layout is stable.
export default function BillingLoading() {
  return (
    <main className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-48" />
      </header>

      <section
        className="rounded-2xl border border-line-strong p-6"
        style={{
          background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        }}
      >
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-16 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-4 h-4 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-6 flex gap-2.5">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
      </section>

      <section
        className="rounded-2xl border border-line p-6"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="mb-1.5 h-3 w-full" />
        <Skeleton className="mb-1.5 h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
      </section>
    </main>
  );
}
