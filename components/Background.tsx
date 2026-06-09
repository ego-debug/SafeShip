export function Background() {
  // Absolute, not fixed: the grid is a top-of-page treatment that scrolls
  // away as content begins, not wallpaper that follows every screen.
  // Persistent full-page grids are the most recognizable template-site
  // tell; a texture that dissolves after the hero reads as deliberate.
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[860px] overflow-hidden"
      aria-hidden="true"
    >
      <div className="bg-radial-glow absolute left-1/2 top-[-200px] h-[700px] w-[900px] -translate-x-1/2 blur-2xl" />
      <div className="bg-grid absolute inset-0 opacity-60" />
    </div>
  );
}
