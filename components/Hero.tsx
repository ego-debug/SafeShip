import { CodePanel } from "./CodePanel";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section className="grid grid-cols-1 items-start gap-14 pb-14 pt-[88px] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-center md:gap-16">
      <div>
        <div
          className="mb-7 inline-flex animate-rise items-center gap-2.5 rounded-full border border-line-strong py-[5px] pl-3 pr-[5px] text-[12.5px] text-fg-2"
          style={{ background: "rgba(255,255,255,0.02)", animationDelay: "0.05s" }}
        >
          <span
            className="rounded-full px-2 py-[3px] font-mono text-[11px] tracking-wide text-accent"
            style={{ background: "rgba(194,249,112,0.12)" }}
          >
            NEW
          </span>
          <span>Deploy gating on regression — now in beta</span>
          <span className="mx-1.5 text-fg-3">→</span>
        </div>

        <h1
          className="mb-[22px] animate-rise text-[clamp(40px,5.6vw,68px)] font-semibold leading-[1.02] tracking-[-0.035em] text-fg [text-wrap:balance]"
          style={{ animationDelay: "0.12s" }}
        >
          Catch your AI agent{" "}
          <span className="underline-highlight whitespace-nowrap">failing</span>{" "}
          before your users&nbsp;do.
        </h1>

        <p
          className="mb-8 max-w-[520px] animate-rise text-lg leading-[1.5] text-fg-2 [text-wrap:pretty]"
          style={{ animationDelay: "0.2s" }}
        >
          Drop a 4-line SDK into your agent. SafeLoop traces every run, turns
          production failures into test cases, and blocks the deploy when it
          regresses.
        </p>

        <div
          className="mb-7 animate-rise"
          style={{ animationDelay: "0.28s" }}
          id="waitlist"
        >
          <WaitlistForm />
        </div>

        <div
          className="flex animate-rise items-center gap-3 text-[13.5px] text-fg-3"
          style={{ animationDelay: "0.36s" }}
        >
          <div className="flex" aria-hidden="true">
            <Avatar from="#c2f970" to="#6fa820" />
            <Avatar from="#ff9d6b" to="#b54820" offset />
            <Avatar from="#6bb1ff" to="#2a5cad" offset />
            <Avatar from="#d36bff" to="#6e2098" offset />
            <span
              className="-ml-2 grid h-6 w-6 place-items-center rounded-full border-2 border-bg font-mono text-[10px] font-semibold text-bg"
              style={{
                background: "linear-gradient(135deg, #f5f5f6, #76767c)",
              }}
            >
              +
            </span>
          </div>
          <span>
            Trusted by <b className="font-medium text-fg-2">200+ developers</b>{" "}
            shipping agents
          </span>
          <span className="text-fg-4">·</span>
          <span className="font-mono text-xs">$29/mo · no seats</span>
        </div>
      </div>

      <CodePanel />
    </section>
  );
}

function Avatar({
  from,
  to,
  offset,
}: {
  from: string;
  to: string;
  offset?: boolean;
}) {
  return (
    <span
      className={`h-6 w-6 rounded-full border-2 border-bg ${
        offset ? "-ml-2" : ""
      }`}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    />
  );
}
