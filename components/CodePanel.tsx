const tokens = {
  kw: "text-[#c084fc]",
  fn: "text-[#7dd3fc]",
  str: "text-accent",
  cm: "text-fg-4",
  v: "text-[#fde68a]",
};

export function CodePanel() {
  return (
    <div
      className="relative animate-rise overflow-hidden rounded-2xl border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)",
        animationDelay: "0.44s",
      }}
      role="img"
      aria-label="SafeLoop SDK code snippet and a live trace"
    >
      <div
        className="flex items-center gap-[10px] border-b border-line px-[14px] py-[10px]"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <span className="h-[9px] w-[9px] rounded-full bg-[#2a2a2e]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#2a2a2e]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#2a2a2e]" />
        <span className="ml-1.5 font-mono text-xs text-fg-3">
          agent<span className="text-fg-4">.ts</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-fg-4">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ boxShadow: "0 0 8px rgba(194,249,112,0.7)" }}
          />
          live · 2 traces/sec
        </span>
      </div>

      <div className="px-[22px] py-[18px] font-mono text-[13px] leading-[1.65]">
        <CodeLine n={1}>
          <span className={tokens.kw}>import</span>
          {" { "}
          <span className={tokens.fn}>safeloop</span>
          {" } "}
          <span className={tokens.kw}>from</span>{" "}
          <span className={tokens.str}>&quot;safeloop&quot;</span>;
        </CodeLine>
        <CodeLine n={2}>{" "}</CodeLine>
        <CodeLine n={3}>
          <span className={tokens.kw}>const</span>{" "}
          <span className={tokens.v}>agent</span> ={" "}
          <span className={tokens.fn}>safeloop</span>(
          <span className={tokens.v}>myAgent</span>, {"{"}
        </CodeLine>
        <CodeLine n={4}>
          {"  "}
          <span className={tokens.v}>name</span>:{" "}
          <span className={tokens.str}>&quot;support-triage&quot;</span>,
        </CodeLine>
        <CodeLine n={5}>
          {"  "}
          <span className={tokens.v}>gate</span>:{" "}
          <span className={tokens.str}>&quot;main&quot;</span>{" "}
          <span className={tokens.cm}>// block deploys on regression</span>
        </CodeLine>
        <CodeLine n={6}>{"});"}</CodeLine>
      </div>

      <div
        className="border-t border-line px-[18px] py-[14px]"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <div className="mb-2.5 flex items-center justify-between font-mono text-[11.5px] text-fg-3">
          <span>
            run <span className="text-fg-2">#4,829</span> ·{" "}
            <span className="text-accent">142 ok</span> ·{" "}
            <span className="text-danger">1 regressed</span>
          </span>
          <span>just now</span>
        </div>
        <div className="flex flex-col gap-[7px]">
          <TraceBar label="classify_intent" fill="ok" left="0%" width="18%" ms="214ms" />
          <TraceBar label="fetch_context" fill="ok" left="18%" width="22%" ms="261ms" />
          <TraceBar label="tool: search_kb" fill="warn" left="40%" width="34%" ms="408ms" />
          <TraceBar label="draft_reply ✗" fill="fail" left="74%" width="24%" ms="err" labelClass="text-[#ff9b9b]" msClass="text-[#ff9b9b]" />
        </div>
      </div>
    </div>
  );
}

function CodeLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-[18px]">
      <span className="w-[14px] flex-none select-none text-right text-fg-4">
        {n}
      </span>
      <span className="whitespace-pre text-fg">{children}</span>
    </div>
  );
}

function TraceBar({
  label,
  fill,
  left,
  width,
  ms,
  labelClass,
  msClass,
}: {
  label: string;
  fill: "ok" | "warn" | "fail";
  left: string;
  width: string;
  ms: string;
  labelClass?: string;
  msClass?: string;
}) {
  const fillBg = {
    ok: "linear-gradient(90deg, #8aac4a, #c2f970)",
    warn: "linear-gradient(90deg, #b08a30, #f5c14a)",
    fail: "linear-gradient(90deg, #803838, #ff6b6b)",
  }[fill];

  return (
    <div
      className="grid items-center gap-2.5 font-mono text-[11px]"
      style={{ gridTemplateColumns: "88px 1fr 52px" }}
    >
      <span
        className={`overflow-hidden text-ellipsis whitespace-nowrap ${
          labelClass ?? "text-fg-3"
        }`}
      >
        {label}
      </span>
      <span
        className="relative h-1.5 overflow-hidden rounded"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <span
          className="absolute bottom-0 top-0 rounded"
          style={{ left, width, background: fillBg }}
        />
      </span>
      <span className={`text-right ${msClass ?? "text-fg-3"}`}>{ms}</span>
    </div>
  );
}
