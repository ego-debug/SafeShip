/**
 * Inline-SVG charts for the owner dashboard. Server components — no
 * client JS. Hover a bar for the exact number (native <title>).
 */

const W = 560;
const H = 150;
const PAD_X = 6;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;

function niceDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * One bar per day for `primary`; `secondary` (a subset, e.g. failures
 * within runs) is drawn as a red block at the base of the same bar.
 */
export function StackedBars({
  days,
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  days: string[];
  primary: number[];
  secondary: number[];
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const max = Math.max(1, ...primary);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_BOTTOM - PAD_TOP;
  const slot = innerW / days.length;
  const barW = Math.max(4, slot * 0.55);
  const empty = primary.every((v) => v === 0);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={primaryLabel}>
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} stroke="rgba(255,255,255,0.12)" />
        {days.map((d, i) => {
          const v = primary[i];
          const f = secondary[i];
          const x = PAD_X + i * slot + (slot - barW) / 2;
          const h = (v / max) * innerH;
          const fh = (f / max) * innerH;
          const y = H - PAD_BOTTOM - h;
          return (
            <g key={d}>
              <title>{`${niceDate(d)}: ${v} ${primaryLabel}${f ? `, ${f} ${secondaryLabel}` : ""}`}</title>
              <rect x={x} y={y} width={barW} height={Math.max(h, v > 0 ? 2 : 0)} rx={2} fill="rgba(194,249,112,0.45)" />
              {f > 0 && (
                <rect x={x} y={H - PAD_BOTTOM - fh} width={barW} height={Math.max(fh, 2)} rx={2} fill="rgba(255,99,99,0.85)" />
              )}
            </g>
          );
        })}
        <text x={PAD_X} y={H - 6} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
          {niceDate(days[0])}
        </text>
        <text x={W - PAD_X} y={H - 6} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="monospace" textAnchor="end">
          {niceDate(days[days.length - 1])}
        </text>
        <text x={W - PAD_X} y={PAD_TOP + 4} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="monospace" textAnchor="end">
          peak {max}
        </text>
        {empty && (
          <text x={W / 2} y={H / 2} fontSize="12" fill="rgba(255,255,255,0.3)" textAnchor="middle">
            no activity in this window yet
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wide text-fg-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[rgba(194,249,112,0.45)]" /> {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[rgba(255,99,99,0.85)]" /> {secondaryLabel}
        </span>
      </figcaption>
    </figure>
  );
}

/** Two independent series drawn as side-by-side bars per day. */
export function PairedBars({
  days,
  a,
  b,
  aLabel,
  bLabel,
}: {
  days: string[];
  a: number[];
  b: number[];
  aLabel: string;
  bLabel: string;
}) {
  const max = Math.max(1, ...a, ...b);
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_BOTTOM - PAD_TOP;
  const slot = innerW / days.length;
  const barW = Math.max(3, slot * 0.3);
  const empty = a.every((v) => v === 0) && b.every((v) => v === 0);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${aLabel} and ${bLabel}`}>
        <line x1={PAD_X} x2={W - PAD_X} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} stroke="rgba(255,255,255,0.12)" />
        {days.map((d, i) => {
          const ha = (a[i] / max) * innerH;
          const hb = (b[i] / max) * innerH;
          const xa = PAD_X + i * slot + slot / 2 - barW - 1;
          const xb = PAD_X + i * slot + slot / 2 + 1;
          return (
            <g key={d}>
              <title>{`${niceDate(d)}: ${a[i]} ${aLabel}, ${b[i]} ${bLabel}`}</title>
              <rect x={xa} y={H - PAD_BOTTOM - ha} width={barW} height={Math.max(ha, a[i] > 0 ? 2 : 0)} rx={2} fill="rgba(194,249,112,0.6)" />
              <rect x={xb} y={H - PAD_BOTTOM - hb} width={barW} height={Math.max(hb, b[i] > 0 ? 2 : 0)} rx={2} fill="rgba(125,211,252,0.55)" />
            </g>
          );
        })}
        <text x={PAD_X} y={H - 6} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
          {niceDate(days[0])}
        </text>
        <text x={W - PAD_X} y={H - 6} fontSize="10" fill="rgba(255,255,255,0.35)" fontFamily="monospace" textAnchor="end">
          {niceDate(days[days.length - 1])}
        </text>
        {empty && (
          <text x={W / 2} y={H / 2} fontSize="12" fill="rgba(255,255,255,0.3)" textAnchor="middle">
            no signups in this window yet
          </text>
        )}
      </svg>
      <figcaption className="mt-2 flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-wide text-fg-4">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[rgba(194,249,112,0.6)]" /> {aLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-[rgba(125,211,252,0.55)]" /> {bLabel}
        </span>
      </figcaption>
    </figure>
  );
}
