import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type AnalyticsSummary = Awaited<ReturnType<typeof api.getAnalyticsSummary>>;

function StatCard({
  label,
  value,
  sub,
  color = 'purple',
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: 'purple' | 'green' | 'blue' | 'red' | 'yellow';
}) {
  const colorMap = {
    purple: 'from-purple-600/20 to-purple-900/10 border-purple-500/20 text-purple-300',
    green: 'from-green-600/20 to-green-900/10 border-green-500/20 text-green-300',
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/20 text-blue-300',
    red: 'from-red-600/20 to-red-900/10 border-red-500/20 text-red-300',
    yellow: 'from-yellow-600/20 to-yellow-900/10 border-yellow-500/20 text-yellow-300',
  };
  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-4`}>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colorMap[color].split(' ')[3]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({
  labels,
  values,
  color = '#9b7bd4',
  height = 80,
}: {
  labels: string[];
  values: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => {
        const pct = (v / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span
              className="text-[9px] text-gray-500 font-mono"
              style={{ visibility: v > 0 ? 'visible' : 'hidden' }}
            >
              {v}
            </span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                opacity: v === 0 ? 0.2 : 0.85,
              }}
            />
            <span className="text-[8px] text-gray-600 truncate w-full text-center">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({
  title,
  labels,
  values,
  color,
}: {
  title: string;
  labels: string[];
  values: number[];
  color?: string;
}) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-xs text-gray-500">{total} / 7j</span>
      </div>
      <BarChart labels={labels} values={values} color={color} height={72} />
    </div>
  );
}

export function AnalyticsPage({ onBack, embedded = false }: { onBack?: () => void; embedded?: boolean }) {
  const { token } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!token) return;
    setLoading(true);
    api
      .getAnalyticsSummary(token)
      .then((r) => {
        setSummary(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div className={`flex flex-col ${embedded ? '' : 'h-full min-h-0'} bg-[#0b0b0f]`}>
      {!embedded && (
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f] bg-[#0e0e14]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-gray-400 hover:text-white text-xl shrink-0"
            >
              ←
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white">Analytics</h1>
            <p className="text-xs text-gray-500">Tableau de bord — msdev</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
          >
            {loading ? '...' : '↻ Actualiser'}
          </button>
        </header>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">Tableau de bord — msdev</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50"
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      )}

      <div className={`${embedded ? '' : 'flex-1 min-h-0 overflow-y-auto'} p-4 space-y-6`}>
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && !summary && (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 text-sm">Chargement des statistiques…</p>
          </div>
        )}

        {summary && (
          <>
            {/* Snapshot temps réel */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Snapshot en temps réel
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Utilisateurs total"
                  value={summary.snapshot.totalUsers}
                  color="purple"
                />
                <StatCard
                  label="Actifs 24h (DAU)"
                  value={summary.snapshot.dau24h}
                  sub={`${summary.snapshot.dau30d} sur 30j`}
                  color="green"
                />
                <StatCard
                  label="Nouveaux aujourd'hui"
                  value={summary.snapshot.newUsersToday}
                  color="blue"
                />
                <StatCard
                  label="Salons actifs"
                  value={summary.snapshot.activeSalons}
                  sub={`${summary.snapshot.activeLives} live${summary.snapshot.activeLives !== 1 ? 's' : ''}`}
                  color="red"
                />
                <StatCard
                  label="Messages envoyés"
                  value={summary.snapshot.totalMessages}
                  color="yellow"
                />
                <StatCard
                  label="Matchs musicaux"
                  value={summary.snapshot.totalMatches}
                  color="purple"
                />
                <StatCard
                  label="Reels publiés"
                  value={summary.snapshot.totalReels}
                  color="blue"
                />
                <StatCard
                  label="Posts fil d'actu"
                  value={summary.snapshot.totalFeedPosts}
                  color="green"
                />
              </div>
            </section>

            {/* Graphiques 7 jours */}
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Activité — 7 derniers jours
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <ChartCard
                  title="Connexions"
                  labels={summary.series.labels}
                  values={summary.series.logins}
                  color="#9b7bd4"
                />
                <ChartCard
                  title="Messages envoyés"
                  labels={summary.series.labels}
                  values={summary.series.messagesSent}
                  color="#f59e0b"
                />
                <ChartCard
                  title="Matchs créés"
                  labels={summary.series.labels}
                  values={summary.series.matchesCreated}
                  color="#ec4899"
                />
                <ChartCard
                  title="Salons créés"
                  labels={summary.series.labels}
                  values={summary.series.salonsCreated}
                  color="#6366f1"
                />
                <ChartCard
                  title="Lives démarrés"
                  labels={summary.series.labels}
                  values={summary.series.livesStarted}
                  color="#ef4444"
                />
                <ChartCard
                  title="Reels visionnés"
                  labels={summary.series.labels}
                  values={summary.series.reelsViewed}
                  color="#22c55e"
                />
                <ChartCard
                  title="Favoris ajoutés"
                  labels={summary.series.labels}
                  values={summary.series.favoritesAdded}
                  color="#f97316"
                />
              </div>
            </section>

            <p className="text-center text-[10px] text-gray-700 pb-4">
              Données en mémoire — réinitialisées au redémarrage du serveur
            </p>
          </>
        )}
      </div>
    </div>
  );
}
