export type StackedBarSeries = { label: string; color: string; values: number[] };

/** Barres empilées — SVG léger, sans dépendance externe. */
export function AdminAnalyticsStackedBarChart({
  labels,
  series,
  height = 140,
}: {
  labels: string[];
  series: StackedBarSeries[];
  height?: number;
}) {
  const totals = labels.map((_, i) => series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals, 1);

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {labels.map((label, i) => {
          const total = totals[i] ?? 0;
          const barH = total === 0 ? 0 : Math.max((total / max) * 100, 2);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                style={{ height: `${barH}%`, opacity: total === 0 ? 0 : 1 }}
              >
                {series.map((s) => {
                  const v = s.values[i] ?? 0;
                  const segPct = total === 0 ? 0 : (v / total) * 100;
                  return (
                    <div
                      key={s.label}
                      style={{ height: `${segPct}%`, backgroundColor: s.color }}
                      title={`${s.label}: ${v}`}
                    />
                  );
                })}
              </div>
              <span className="text-[8px] text-gray-600 truncate w-full text-center">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
