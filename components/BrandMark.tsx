export function BrandMark() {
  return (
    <span
      className="relative grid h-[22px] w-[22px] place-items-center rounded-md border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #1a1a1c 0%, #0a0a0b 100%)",
      }}
      aria-hidden="true"
    >
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.4px] border-accent" />
      <span
        className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.4px] border-dashed"
        style={{ borderColor: "rgba(194,249,112,0.35)" }}
      />
    </span>
  );
}
