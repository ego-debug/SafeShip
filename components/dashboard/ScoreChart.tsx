type Point = { day: string; score: number | null };

export function ScoreChart({ series }: { series: Point[] }) {
  const valued = series.filter((p): p is { day: string; score: number } => p.score != null);
  const latest = valued[valued.length - 1];
  const earliest = valued[0];
  const delta = latest && earliest ? latest.score - earliest.score : 0;

  const width = 700;
  const height = 220;
  const padX = 24;
  const padY = 28;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const n = series.length;
  const xFor = (i: number) =>
    n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
  const yFor = (score: number) =>
    padY + (1 - Math.max(0, Math.min(100, score)) / 100) * innerH;

  const pathPoints = series.map((p, i) => {
    if (p.score == null) return null;
    return `${xFor(i)},${yFor(p.score)}`;
  });

  const linePath = pathPoints
    .filter((p): p is string => p != null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
    .join(" ");

  // Area fill — close path back to baseline at the lowest x
  const firstIdx = series.findIndex((p) => p.score != null);
  const lastIdx = (() => {
    for (let i = series.length - 1; i >= 0; i--) if (series[i].score != null) return i;
    return -1;
  })();
  const areaPath =
    firstIdx >= 0 && lastIdx >= 0
      ? `${linePath} L${xFor(lastIdx)},${height - padY} L${xFor(firstIdx)},${height - padY} Z`
      : "";

  const dropIdx = series.findIndex((p) => p.score != null && p.score < 80);
  const isUnhealthy = latest != null && latest.score < 80;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        {latest ? (
          <>
            <span className="font-semibold leading-none tracking-[-0.04em] text-[64px] tabular-nums text-fg">
              {latest.score}
              <span className="text-[28px] text-fg-3">/100</span>
            </span>
            {valued.length > 1 && (
              <span
                className={`font-mono text-sm font-medium ${
                  delta < 0 ? "text-danger" : "text-accent"
                }`}
              >
                {delta < 0 ? "▼" : "▲"} {Math.abs(delta)}
              </span>
            )}
          </>
        ) : (
          <span className="font-semibold text-[28px] tracking-tight text-fg-3">
            No scored runs yet
          </span>
        )}
      </div>

      {latest && (
        <p className="text-sm text-fg-2">
          {isUnhealthy ? (
            <>
              Below the 80 deploy-gate line —{" "}
              <span className="text-danger">
                <b>{latest.score}</b> on {fmtDay(latest.day)}
              </span>
              . Check recent failures below.
            </>
          ) : (
            <>
              Healthy — at or above the 80 deploy-gate line. Last run{" "}
              {fmtRelative(latest.day)}.
            </>
          )}
        </p>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[220px] w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="area-ok" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c2f970" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#c2f970" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="area-bad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff6b6b" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#ff6b6b" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines at 25/50/75 */}
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={padX}
            x2={width - padX}
            y1={yFor(v)}
            y2={yFor(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 5"
          />
        ))}

        {areaPath && (
          <path
            d={areaPath}
            fill={isUnhealthy ? "url(#area-bad)" : "url(#area-ok)"}
          />
        )}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={isUnhealthy ? "#ff6b6b" : "#c2f970"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {series.map((p, i) =>
          p.score == null ? null : (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(p.score)}
              r={dropIdx === i ? 5 : 3}
              fill={
                dropIdx === i && p.score < 80 ? "#ff6b6b" : "#c2f970"
              }
              stroke="#0a0a0b"
              strokeWidth="2"
            />
          ),
        )}
      </svg>

      <div className="flex justify-between font-mono text-[11px] text-fg-4">
        {series.map((p) => (
          <span key={p.day} className="tracking-wide">
            {fmtAxis(p.day)}
          </span>
        ))}
      </div>
    </div>
  );
}

function fmtDay(day: string) {
  const d = new Date(day + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtAxis(day: string) {
  const d = new Date(day + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}
function fmtRelative(day: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(day + "T00:00:00Z");
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  return diff + " days ago";
}
