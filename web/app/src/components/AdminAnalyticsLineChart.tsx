/** Courbe d'évolution (aire dégradée) — SVG léger, sans dépendance externe. */
export function AdminAnalyticsLineChart({
  labels,
  values,
  color = '#a78bfa',
  height = 140,
  formatValue,
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const w = 600;
  const h = height;
  const padX = 6;
  const padY = 10;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const stepX = values.length > 1 ? (w - padX * 2) / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.[0].toFixed(1) ?? 0},${h - padY} L${points[0]?.[0].toFixed(1) ?? 0},${h - padY} Z`;

  const gradId = `admin-line-grad-${color.replace('#', '')}`;
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {values.length > 0 && (
          <>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.length > 0 && (
              <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={3} fill={color} />
            )}
          </>
        )}
      </svg>
      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-600">
        <span>{labels[0] ?? ''}</span>
        <span className="text-gray-500">
          {formatValue ? formatValue(first) : first} → {formatValue ? formatValue(last) : last}
        </span>
        <span>{labels[labels.length - 1] ?? ''}</span>
      </div>
    </div>
  );
}
