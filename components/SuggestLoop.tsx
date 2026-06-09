/**
 * SuggestLoop - landing-page section showing the product's defining
 * moment: a real production failure rendered as a draft regression
 * test, with one-tap accept/skip.
 *
 * Lives between <HowItWorks /> and <Pricing />. The three step cards
 * above sell the story (install → catch → block); this section sells
 * the *product*. Prospects scroll here and see the actual UI of the
 * feature no competitor ships: a queue of drafted tests waiting on a
 * human thumb.
 *
 * The card is intentionally close to the real /app/suggestions
 * FocusCard styling (plain English ↔ YAML two-column, severity chip,
 * Accept/Skip buttons) so the marketing visual matches what the
 * customer gets in-product on day one.
 */
export function SuggestLoop() {
  return (
    <section id="suggest-loop" className="relative py-24">
      <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-14">
        <div className="flex flex-col gap-5">
          <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
            The suggest loop
          </span>
          <h2 className="text-[clamp(28px,3.2vw,40px)] font-semibold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
            Real failures become regression tests. One tap to
            accept.
          </h2>
          <p className="max-w-[520px] text-[16.5px] leading-[1.55] text-fg-2">
            When your agent breaks in production, SafeShip drafts the
            test that would have caught it. Plain English on the left,
            ready-to-run YAML on the right. Accept and it lands in your
            suite. Skip and it&apos;s gone. No writing tests by hand.
          </p>
          <ul className="mt-1 flex flex-col gap-2.5 text-[14.5px] text-fg-2">
            <Bullet>Drafted from the actual failing trace, not from a template.</Bullet>
            <Bullet>Runs in CI on every PR. Score drops → deploy blocks.</Bullet>
            <Bullet>You stay in control. Nothing ships without your thumb.</Bullet>
          </ul>
        </div>

        <SuggestionStack />
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-1 grid h-4 w-4 flex-none place-items-center rounded-full text-accent"
        style={{ background: "rgba(194,249,112,0.14)" }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * The visual: a stacked queue with one focused card on top. The two
 * ghost cards behind it communicate "there's a queue waiting" without
 * cluttering. Pure CSS transforms - no images, no animations on load
 * (kept calm for marketing).
 */
function SuggestionStack() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* Ghost card 2 (deepest) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-6 top-7 h-32 rounded-2xl border border-line opacity-50"
        style={{
          background: "linear-gradient(180deg, #0f0f12 0%, #0a0a0c 100%)",
          transform: "rotate(-1.5deg)",
        }}
      />
      {/* Ghost card 1 (middle) */}
      <div
        aria-hidden="true"
        className="absolute inset-x-3 top-4 h-36 rounded-2xl border border-line opacity-70"
        style={{
          background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          transform: "rotate(0.8deg)",
        }}
      />

      <FocusedSuggestionCard />

      {/* Queue counter pill, floating top-right */}
      <span
        className="absolute -right-2 -top-3 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-2"
        style={{
          background: "rgba(15,15,18,0.96)",
          boxShadow: "0 8px 18px -10px rgba(0,0,0,0.55)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-accent"
          style={{ boxShadow: "0 0 6px rgba(194,249,112,0.6)" }}
        />
        3 waiting
      </span>
    </div>
  );
}

function FocusedSuggestionCard() {
  return (
    <article
      className="relative rounded-2xl border border-line-strong p-5"
      style={{
        background: "linear-gradient(180deg, #131318 0%, #0c0c0f 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 60px -28px rgba(0,0,0,0.7)",
      }}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]"
          style={{
            background: "rgba(244,114,114,0.10)",
            borderColor: "rgba(244,114,114,0.30)",
            color: "#f47272",
          }}
        >
          <span className="h-1 w-1 rounded-full bg-[#f47272]" />
          High severity
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4">
          run #4,829 · 12s ago
        </span>
      </header>

      <h3 className="mb-3 text-[15.5px] font-semibold leading-snug text-fg">
        send_email called with empty subject. It reached the customer.
      </h3>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-line bg-black/30 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">
            What this test enforces
          </p>
          <p className="text-[13px] leading-relaxed text-fg-2">
            Block the run when the agent invokes{" "}
            <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px] text-fg">
              send_email
            </code>{" "}
            with an empty <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px] text-fg">subject</code>{" "}
            field.
          </p>
        </div>
        <div className="rounded-xl border border-line bg-black/40 p-3">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">
            The YAML SafeShip will add
          </p>
          <pre className="overflow-x-auto font-mono text-[11.5px] leading-[1.55] text-fg">
            <code>{`test: empty_subject_blocks_send
when: tool == 'send_email'
assert: input.subject != ''`}</code>
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            aria-label="Accept this suggested test (preview only)"
            className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)]"
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
              <polyline points="2 6 5 9 10 3" />
            </svg>
            Accept
            <KeyHint k="A" />
          </button>
          <button
            type="button"
            disabled
            aria-label="Skip this suggested test (preview only)"
            className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3.5 py-2 text-[13px] text-fg"
          >
            Skip
            <KeyHint k="N" />
          </button>
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
          drafted by SafeShip
        </span>
      </div>
    </article>
  );
}

function KeyHint({ k }: { k: string }) {
  return (
    <kbd
      className="ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[rgba(0,0,0,0.18)] bg-[rgba(0,0,0,0.10)] px-1 font-mono text-[10px] font-medium text-bg/80"
      aria-hidden="true"
    >
      {k}
    </kbd>
  );
}
