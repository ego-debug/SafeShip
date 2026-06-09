const FEATURES = [
  "Unlimited agent traces",
  "Auto-suggested tests from real failures, you accept in one tap",
  "Deploy gating on every PR",
  "Slack + email alerts",
  "All your projects, no seat fees",
];

const COMPARE: Array<{
  vendor: string;
  tag: string;
  detail: string;
  us?: boolean;
}> = [
  { vendor: "Per-seat eval platforms", tag: "seats", detail: "$39–$249+ / mo, built for ML teams of 5+" },
  { vendor: "Free OSS CLIs", tag: "DIY", detail: "Free + you wire it up, run it, write the YAML" },
  { vendor: "SafeShip", tag: "managed", detail: "$29.99 / mo flat. Managed, one-tap, no seats", us: true },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative pb-10 pt-24">
      <div className="mb-14 flex max-w-[720px] flex-col gap-3.5">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
          />
          Simple pricing
        </span>
        <h2 className="text-[clamp(28px,3.2vw,40px)] font-semibold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
          One tier. No seats. No&nbsp;surprises.
        </h2>
        <p className="max-w-[560px] text-[16.5px] text-fg-2">
          Everything SafeShip does, for one flat price. Add your whole team.
          We don&apos;t care.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2">
        <div
          className="relative rounded-2xl border border-line-strong px-7 pb-[26px] pt-7"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, rgba(194,249,112,0.06), transparent 60%), linear-gradient(180deg, #121215 0%, #0c0c0e 100%)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
          }}
        >
          <div className="mb-[18px] flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
              <span
                className="h-2 w-2 rounded-full bg-accent"
              />
              Pro
            </span>
            <span
              className="rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent"
              style={{
                background: "rgba(194,249,112,0.10)",
                borderColor: "rgba(194,249,112,0.25)",
              }}
            >
              7-day free trial
            </span>
          </div>

          <div className="my-1.5 flex items-baseline gap-1.5">
            <span className="-translate-y-3 text-[28px] font-medium text-fg-2">
              $
            </span>
            <span className="text-[80px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-fg">
              29
            </span>
            <span className="-translate-y-3 text-[28px] font-medium text-fg-2">
              .99
            </span>
            <span className="ml-1 text-[15px] text-fg-3">/ month</span>
          </div>
          <p className="mb-[22px] font-mono text-xs text-fg-3">
            billed monthly · cancel anytime
          </p>

          <div className="mb-5 h-px bg-line" />

          <ul className="mb-[26px] flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-3 text-[14.5px] text-fg"
              >
                <span
                  className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full border text-accent"
                  style={{
                    background: "rgba(194,249,112,0.12)",
                    borderColor: "rgba(194,249,112,0.3)",
                  }}
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[9px] w-[9px]"
                  >
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>

          <a
            href="/sign-up"
            className="flex w-full items-center justify-center rounded-[9px] bg-accent px-[18px] py-3 text-[14.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
          >
            Start 7-day free trial <span aria-hidden="true">→</span>
          </a>
          <p className="mt-3.5 text-center font-mono text-[11.5px] text-fg-3">
            card required · cancel anytime ·{" "}
            <b className="font-medium text-fg-2">$0 if you cancel before day 7</b>
          </p>
        </div>

        <aside
          className="overflow-hidden rounded-2xl border border-line-strong"
          style={{
            background: "linear-gradient(180deg, #0f0f12 0%, #0b0b0d 100%)",
          }}
          aria-label="Comparison versus alternatives"
        >
          <header
            className="flex items-center justify-between border-b border-line px-5 py-4"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <h4 className="text-[13.5px] font-semibold text-fg-2">
              vs the alternatives
            </h4>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-4">
              pricing model
            </span>
          </header>
          {COMPARE.map((row, i) => (
            <div
              key={row.vendor}
              className={`relative grid items-center gap-4 px-5 py-4 ${
                i < COMPARE.length - 1 ? "border-b border-line" : ""
              } ${row.us ? "" : ""}`}
              style={{
                gridTemplateColumns: "minmax(0, 145px) minmax(0, 1fr)",
                background: row.us
                  ? "linear-gradient(90deg, rgba(194,249,112,0.07), rgba(194,249,112,0.015))"
                  : undefined,
              }}
            >
              {row.us && (
                <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-accent" />
              )}
              <span className="text-sm font-medium text-fg">
                {row.vendor}
                <small
                  className={`mt-0.5 block font-mono text-[10.5px] tracking-wide ${
                    row.us ? "text-accent" : "text-fg-4"
                  }`}
                >
                  {row.tag}
                </small>
              </span>
              <span
                className={`font-mono text-[13.5px] ${
                  row.us ? "text-fg" : "text-fg-2"
                }`}
              >
                {row.detail}
              </span>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
