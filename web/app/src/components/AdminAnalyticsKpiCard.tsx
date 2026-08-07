/** Carte KPI avec variation vs période précédente (flèche verte/rouge). */
export function AdminAnalyticsKpiCard({
  label,
  value,
  deltaPct,
  invertColors = false,
  sub,
}: {
  label: string;
  value: string;
  /** % de variation vs la période précédente équivalente. undefined = pas de comparaison. */
  deltaPct?: number;
  /** true pour les métriques où une baisse est positive (ex: churn, temps de chargement). */
  invertColors?: boolean;
  sub?: string;
}) {
  const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct);
  const isUp = hasDelta && (deltaPct as number) > 0;
  const isFlat = hasDelta && Math.abs(deltaPct as number) < 0.05;
  const isGood = hasDelta && !isFlat && (invertColors ? !isUp : isUp);
  const deltaColor = isFlat ? 'text-gray-500' : isGood ? 'text-emerald-400' : 'text-red-400';
  const arrow = isFlat ? '→' : isUp ? '▲' : '▼';

  return (
    <div className="bg-gradient-to-br from-purple-600/15 to-[#0f0f17] border border-[#232336] rounded-2xl p-4 transition hover:border-purple-500/40">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-white leading-tight">{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {hasDelta && (
          <span className={`text-xs font-semibold ${deltaColor}`}>
            {arrow} {Math.abs(deltaPct as number).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-[11px] text-gray-500 truncate">{sub}</span>}
      </div>
    </div>
  );
}
