export function Background() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    >
      <div className="bg-radial-glow absolute left-1/2 top-[-200px] h-[700px] w-[900px] -translate-x-1/2 blur-2xl" />
      <div className="bg-grid absolute inset-0 opacity-70" />
    </div>
  );
}
