export type DonutSlice = { label: string; pct: number; color: string };

/** Camembert / donut — SVG léger, sans dépendance externe. */
export function AdminAnalyticsDonutChart({
  slices,
  size = 132,
}: {
  slices: DonutSlice[];
  size?: number;
}) {
  const total = slices.reduce((a, s) => a + s.pct, 0) || 1;
  const r = 42;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * r;
  let offsetAcc = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a26" strokeWidth={strokeWidth} />
        {slices.map((s) => {
          const frac = s.pct / total;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetAcc}
              strokeLinecap="butt"
            />
          );
          offsetAcc += dash;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate flex-1">{s.label}</span>
            <span className="font-semibold text-gray-200 shrink-0">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
