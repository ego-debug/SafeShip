// Reusable skeleton primitive. Matches the panel border/background tokens
// used elsewhere in the signed-in UI so loading state visually rhymes
// with the eventual rendered content (shape-first, content-next).

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-pulse rounded bg-[rgba(255,255,255,0.06)] ${className}`}
      style={style}
    />
  );
}

// Convenience wrapper for skeleton "cards" that match the gradient
// background + line border used for real Panel components.
export function SkeletonCard({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-line-strong ${className}`}
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      {children}
    </section>
  );
}
