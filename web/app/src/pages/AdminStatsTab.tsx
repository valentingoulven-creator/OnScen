import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { StatsOverviewResponse, StatsTopLive, StatsTopReel, StatsTopSalon } from '../types';
import { downloadAdminStatsPdf } from '../lib/adminStatsPdfExport';

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

function formatEuro(value: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(value);
}

function LeaderboardSection<T>({
  title,
  emptyLabel,
  items,
  renderRow,
}: {
  title: string;
  emptyLabel: string;
  items: T[];
  renderRow: (item: T, rank: number) => React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600 bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl py-6 text-center">
          {emptyLabel}
        </p>
      ) : (
        <div className="bg-[#0f0f17] border border-[#1e1e2f] rounded-2xl divide-y divide-[#1e1e2f]">
          {items.map((item, i) => renderRow(item, i + 1))}
        </div>
      )}
    </section>
  );
}

function LeaderboardRow({
  rank,
  title,
  subtitle,
  value,
  valueLabel,
}: {
  rank: number;
  title: string;
  subtitle: string;
  value: number;
  valueLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-11">
      <span className="shrink-0 w-6 text-center text-xs font-bold text-gray-600">{rank}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-purple-300">{value}</p>
        <p className="text-[10px] text-gray-600">{valueLabel}</p>
      </div>
    </div>
  );
}

/**
 * Onglet Admin → Statistiques : audience (inscrits, connectés maintenant /
 * jour / semaine / mois), volumes de contenu (reels, salons, lives,
 * événements) et classements (reels les plus vus, salons/lives les plus
 * regardés en ce moment). Lecture seule — agrégats calculés côté backend
 * (`commun/backend/src/lib/statsOverview.ts`), aucune action d'écriture ici.
 */
export function AdminStatsTab({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<StatsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .getStatsOverview(token)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('admin.stats.loadError')))
      .finally(() => setLoading(false));
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className={`flex items-center gap-2 ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded ? (
          <div>
            <h2 className="text-base font-bold text-white">{t('admin.stats.title')}</h2>
            <p className="text-xs text-gray-500 mt-1">{t('admin.stats.hint')}</p>
          </div>
        ) : null}
        <div className="flex items-center gap-2 shrink-0">
          {data && (
            <button
              type="button"
              disabled={exportingPdf || loading}
              onClick={() => {
                setExportingPdf(true);
                void downloadAdminStatsPdf(data, t, i18n.language)
                  .catch(() => setError(t('admin.analytics.pdf.exportError')))
                  .finally(() => setExportingPdf(false));
              }}
              className="px-3 py-1.5 min-h-11 text-xs font-semibold border border-purple-500/40 text-purple-300 hover:bg-purple-600/20 rounded-full disabled:opacity-50 touch-manipulation"
            >
              {exportingPdf ? t('admin.stats.pdf.exporting') : t('admin.stats.pdf.export')}
            </button>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 min-h-11 text-xs border border-[#2d2d3d] text-gray-400 hover:text-white rounded-full disabled:opacity-50 touch-manipulation"
          >
            {loading ? t('admin.stats.refreshing') : t('admin.stats.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500 text-sm">{t('admin.stats.loading')}</p>
        </div>
      )}

      {data && (
        <>
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.usersTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.usersTotal')} value={data.users.total} color="purple" />
              <StatCard label={t('admin.stats.usersOnlineNow')} value={data.users.onlineNow} color="green" />
              <StatCard label={t('admin.stats.usersActiveToday')} value={data.users.activeToday} color="blue" />
              <StatCard label={t('admin.stats.usersActiveWeek')} value={data.users.activeWeek} color="yellow" />
              <StatCard
                label={t('admin.stats.usersActiveMonth')}
                value={data.users.activeMonth}
                color="red"
              />
              <StatCard
                label={t('admin.stats.usersActiveTodayTracked')}
                value={data.users.activeTodayTracked}
                sub={t('admin.stats.dauTrackedHint')}
                color="green"
              />
              <StatCard
                label={t('admin.stats.usersActiveTodayLastSeen')}
                value={data.users.activeTodayLastSeen}
                sub={t('admin.stats.dauLastSeenHint')}
                color="blue"
              />
              <StatCard label={t('admin.stats.usersNew7d')} value={data.users.newLast7Days} color="green" />
              <StatCard label={t('admin.stats.usersNew30d')} value={data.users.newLast30Days} color="blue" />
              <StatCard label={t('admin.stats.usersInactive30d')} value={data.users.inactive30Days} color="yellow" />
              <StatCard label={t('admin.stats.usersWithGeo')} value={data.users.withGeoOrCity} color="purple" />
              <StatCard label={t('admin.stats.usersPending')} value={data.users.pendingAccounts} color="red" />
              <StatCard label={t('admin.stats.usersBlocked')} value={data.users.blockedAccounts} color="red" />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.contentTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.totalReels')} value={data.content.totalReels} color="blue" />
              <StatCard
                label={t('admin.stats.activeSalonsNow')}
                value={data.content.activeSalonsNow}
                sub={t('admin.stats.totalSalonsCreated', { count: data.content.totalSalonsCreated })}
                color="purple"
              />
              <StatCard
                label={t('admin.stats.activeLivesNow')}
                value={data.content.activeLivesNow}
                sub={t('admin.stats.totalLivesStarted', { count: data.content.totalLivesStarted })}
                color="red"
              />
              <StatCard label={t('admin.stats.totalEvents')} value={data.content.totalEvents} color="green" />
              <StatCard label={t('admin.stats.totalUpvotes')} value={data.content.totalUpvotes} color="yellow" />
              <StatCard label={t('admin.stats.totalAlbums')} value={data.content.totalAlbums} color="purple" />
              <StatCard label={t('admin.stats.totalCompositions')} value={data.content.totalCompositions} color="blue" />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.musicTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.compositionUpvotes')} value={data.music.compositionUpvotes} color="yellow" />
              <StatCard label={t('admin.stats.eventUpvotes')} value={data.music.eventUpvotes} color="green" />
              <StatCard label={t('admin.stats.compositionPlaysTotal')} value={data.music.compositionPlaysTotal} color="purple" />
              <StatCard label={t('admin.stats.compositionPlays7d')} value={data.music.compositionPlays7d} color="blue" />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.engagementTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.followRelations')} value={data.engagement.followRelations} color="purple" />
              <StatCard label={t('admin.stats.usersFollowing')} value={data.engagement.usersFollowingSomeone} color="blue" />
              <StatCard label={t('admin.stats.feedPostLikes')} value={data.engagement.feedPostLikes} color="green" />
              <StatCard label={t('admin.stats.feedPostComments')} value={data.engagement.feedPostComments} color="yellow" />
              <StatCard label={t('admin.stats.feedPostFavorites')} value={data.engagement.feedPostFavorites} color="red" />
              <StatCard label={t('admin.stats.totalMatches')} value={data.engagement.totalMatches} color="purple" />
              <StatCard label={t('admin.stats.reelLikes')} value={data.engagement.reelLikes} color="blue" />
              <StatCard label={t('admin.stats.reelComments')} value={data.engagement.reelComments} color="green" />
              <StatCard label={t('admin.stats.directMessages')} value={data.engagement.directMessages} color="yellow" />
              <StatCard
                label={t('admin.stats.activeCreatorSubscriptions')}
                value={data.engagement.activeCreatorSubscriptions}
                color="red"
              />
              <StatCard
                label={t('admin.stats.activePlatformSubscriptions')}
                value={data.engagement.activePlatformSubscriptions}
                color="purple"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.communityTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.totalStories')} value={data.community.totalStories} color="blue" />
              <StatCard label={t('admin.stats.supportThreadsTotal')} value={data.community.supportThreadsTotal} color="purple" />
              <StatCard label={t('admin.stats.supportOpen')} value={data.community.supportOpen} color="red" />
              <StatCard label={t('admin.stats.reportsPending')} value={data.moderation.reportsPending} color="yellow" />
              <StatCard label={t('admin.stats.reportsTotal')} value={data.moderation.reportsTotal} color="green" />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.monetizationTitle')}
            </h2>
            {data.monetization.donationsSimulationMode ? (
              <p className="text-[10px] text-amber-500/90 mb-2">{t('admin.stats.monetizationSimulationHint')}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t('admin.stats.mrrEstimated')}
                value={formatEuro(data.monetization.estimatedMrrCents / 100)}
                color="purple"
              />
              <StatCard
                label={t('admin.stats.mrrPlatform')}
                value={formatEuro(data.monetization.estimatedMrrPlatformCents / 100)}
                color="green"
              />
              <StatCard
                label={t('admin.stats.tipsMonth')}
                value={formatEuro(data.monetization.tipsMonthCents / 100)}
                color="blue"
              />
              <StatCard
                label={t('admin.stats.platformFeesMonth')}
                value={formatEuro(data.monetization.platformFeesMonthCents / 100)}
                color="yellow"
              />
              <StatCard
                label={t('admin.stats.platformRevenueMonth')}
                value={formatEuro(data.monetization.platformRevenueMonthEstimateCents / 100)}
                sub={t('admin.stats.platformRevenueMonthHint', {
                  fee: data.monetization.platformFeePercent,
                })}
                color="red"
              />
              <StatCard
                label={t('admin.stats.mrrStripe')}
                value={formatEuro(data.monetization.stripeMrrCents / 100)}
                color="green"
              />
              <StatCard
                label={t('admin.stats.mrrStripeReconciled')}
                value={formatEuro(data.monetization.stripeReconciledMrrCents / 100)}
                sub={
                  data.monetization.stripeReconciledMrrCents > 0
                    ? t('admin.stats.mrrStripeReconcileDelta', {
                        delta: formatEuro(data.monetization.stripeMrrReconcileDeltaCents / 100),
                      })
                    : t('admin.stats.mrrStripeReconcileEmpty')
                }
                color="purple"
              />
              <StatCard
                label={t('admin.stats.subscriptionInvoicesMonth')}
                value={formatEuro(data.monetization.subscriptionInvoicesPaidMonthCents / 100)}
                color="yellow"
              />
              <StatCard
                label={t('admin.stats.platformRevenueStripeMonth')}
                value={formatEuro(data.monetization.platformRevenueMonthStripeCents / 100)}
                color="blue"
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.sponsorsTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.sponsorsTotal')} value={data.sponsors.total} color="purple" />
              <StatCard label={t('admin.stats.sponsorsActiveNow')} value={data.sponsors.activeNow} color="green" />
              <StatCard label={t('admin.stats.sponsorImpressions30d')} value={data.sponsors.impressions30d} color="blue" />
              <StatCard label={t('admin.stats.sponsorClicks30d')} value={data.sponsors.clicks30d} color="yellow" />
              <StatCard
                label={t('admin.stats.sponsorCtr30d')}
                value={`${data.sponsors.ctr30d} %`}
                color="red"
              />
              <StatCard label={t('admin.stats.sponsorImpressions7d')} value={data.sponsors.impressions7d} color="purple" />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.retentionTitle')}
            </h2>
            <p className="text-[10px] text-gray-600 mb-3">{t('admin.stats.retentionHint')}</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[20rem] text-xs border border-[#1e1e2f] rounded-2xl overflow-hidden">
                <thead className="bg-[#14141f] text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">{t('admin.stats.retentionCohortWeek')}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t('admin.stats.retentionRegistered')}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t('admin.stats.retentionS1')}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t('admin.stats.retentionS4')}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t('admin.stats.retentionS1Login')}</th>
                    <th className="text-right px-3 py-2 font-semibold">{t('admin.stats.retentionS4Login')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2f] bg-[#0f0f17]">
                  {data.retention.cohorts.map((row) => (
                    <tr key={row.cohortWeek}>
                      <td className="px-3 py-2 text-white font-medium">{row.cohortWeek}</td>
                      <td className="px-3 py-2 text-right text-gray-300">{row.registered}</td>
                      <td className="px-3 py-2 text-right text-purple-300">
                        {row.week1Mature && row.registered > 0
                          ? `${row.week1Rate} %`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-300">
                        {row.week4Mature && row.registered > 0 ? `${row.week4Rate} %` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-300">
                        {row.week1Mature && row.registered > 0 ? `${row.week1RateLogin} %` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-teal-300">
                        {row.week4Mature && row.registered > 0 ? `${row.week4RateLogin} %` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t('admin.stats.analytics30dTitle')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t('admin.stats.analyticsLogins30d')} value={data.analytics30d.logins} color="blue" />
              <StatCard label={t('admin.stats.analyticsMessages30d')} value={data.analytics30d.messagesSent} color="green" />
              <StatCard label={t('admin.stats.analyticsSalons30d')} value={data.analytics30d.salonsCreated} color="purple" />
              <StatCard label={t('admin.stats.analyticsLives30d')} value={data.analytics30d.livesStarted} color="red" />
              <StatCard label={t('admin.stats.analyticsReelViews30d')} value={data.analytics30d.reelsViewed} color="yellow" />
              <StatCard label={t('admin.stats.analyticsMatches30d')} value={data.analytics30d.matchesCreated} color="blue" />
              <StatCard label={t('admin.stats.analyticsFavorites30d')} value={data.analytics30d.favoritesAdded} color="green" />
              <StatCard label={t('admin.stats.analyticsReelsCreated30d')} value={data.analytics30d.reelsCreated} color="purple" />
            </div>
          </section>

          <LeaderboardSection<StatsTopReel>
            title={t('admin.stats.topReelsTitle')}
            emptyLabel={t('admin.stats.noReels')}
            items={data.topReels}
            renderRow={(reel, rank) => (
              <LeaderboardRow
                key={reel.id}
                rank={rank}
                title={reel.title}
                subtitle={`@${reel.authorName}`}
                value={reel.viewCount}
                valueLabel={t('admin.stats.views')}
              />
            )}
          />

          <LeaderboardSection<StatsTopSalon>
            title={t('admin.stats.topSalonsTitle')}
            emptyLabel={t('admin.stats.noActiveSalons')}
            items={data.topSalons}
            renderRow={(salon, rank) => (
              <LeaderboardRow
                key={salon.id}
                rank={rank}
                title={salon.title}
                subtitle={salon.hostName}
                value={salon.listenersCount}
                valueLabel={t('admin.stats.listeners')}
              />
            )}
          />

          <LeaderboardSection<StatsTopLive>
            title={t('admin.stats.topLivesTitle')}
            emptyLabel={t('admin.stats.noActiveLives')}
            items={data.topLives}
            renderRow={(live, rank) => (
              <LeaderboardRow
                key={live.id}
                rank={rank}
                title={live.title}
                subtitle={live.hostName}
                value={live.viewersCount}
                valueLabel={t('admin.stats.viewers')}
              />
            )}
          />

          <p className="text-center text-[10px] text-gray-700 pb-4">
            {t('admin.stats.generatedAt', { time: new Date(data.generatedAt).toLocaleTimeString() })}
          </p>
        </>
      )}
    </div>
  );
}
