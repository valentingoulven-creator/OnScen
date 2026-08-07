import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import {
  buildCreatorStatsYears,
  formatCreatorEuros,
  isCurrentCalendarMonth,
  type CreatorDashboardStats,
} from '../lib/creatorDashboardStats';
import { useLiveHostSession } from '../hooks/useLiveHostSession';
import { withGoalsProgress, type GoalProgressStats } from '../lib/liveGoalProgress';
import type {
  LiveGoal,
  LiveStats,
  RewardQueueItem,
  GoalType,
  TriggerAction,
  RewardType,
} from '../lib/liveHostTypes';
import { LiveChatConfigFields } from './LiveChatConfigFields';
import { LiveHostMediaSettings, type LiveHostMediaSettingsProps } from './LiveHostMediaSettings';
import { LiveHostMetaSettings } from './LiveHostMetaSettings';
import { LiveHostAnnouncementSettings } from './LiveHostAnnouncementSettings';
import { LiveHostPollSettings } from './LiveHostPollSettings';
import { LiveKitCdnEgressSettings } from './LiveKitCdnEgressSettings';
import { LiveObsIngestSettings } from './LiveCloudflareHostPanel';
import { CreatorStripeConnectCard } from './CreatorStripeConnectCard';
import { DONATION_MIN_AGE } from '../lib/donations';
import type { User, LivePinnedAnnouncement, LivePoll } from '../types';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function goalTypeLabel(t: GoalType): string {
  switch (t) {
    case 'amount': return 'Montant (€)';
    case 'dons': return 'Nombre de dons';
    case 'likes': return 'Likes';
    case 'viewers': return 'Spectateurs';
    case 'duration': return 'Durée (min)';
  }
}

function goalUnit(t: GoalType): string {
  switch (t) {
    case 'amount': return '€';
    case 'dons': return 'dons';
    case 'likes': return 'likes';
    case 'viewers': return 'spec.';
    case 'duration': return 'min';
  }
}

function actionLabel(a: TriggerAction): string {
  switch (a) {
    case 'hearts_animation': return 'Animation cœurs';
    case 'voice_thanks': return 'Message vocal';
    case 'fullscreen_donor': return 'Nom plein écran';
    case 'confetti': return 'Confettis';
    case 'chat_pin': return 'Pin dans le chat';
    case 'custom_alert': return 'Alerte personnalisée';
  }
}

function rewardTypeLabel(r: RewardType): string {
  switch (r) {
    case 'music_request': return 'Demande de musique';
    case 'dedication': return 'Dédicace';
    case 'dance': return 'Danse spécifique';
    case 'backstage': return 'Accès backstage';
    case 'badge': return 'Badge fan';
    case 'custom': return 'Récompense perso';
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Defaults                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const ALL_ACTIONS: TriggerAction[] = [
  'hearts_animation', 'voice_thanks', 'fullscreen_donor', 'confetti', 'chat_pin', 'custom_alert',
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared UI                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function HostPanelEmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-4 rounded-2xl border border-dashed border-[#2a2a3a] bg-gradient-to-b from-[#14141c]/80 to-[#0e0e14]/40">
      <span className="text-4xl mb-3" aria-hidden>{icon}</span>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-gray-500 mt-1.5 max-w-[18rem] leading-relaxed">{hint}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-11 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition touch-manipulation"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function HostPanelSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-0.5">{title}</p>
      {children}
    </section>
  );
}

function HostPanelStatTile({
  value,
  label,
  accent = false,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 text-center min-w-0 ${
        accent
          ? 'bg-purple-950/30 border-purple-500/25'
          : 'bg-[#12121a] border-[#1e1e2f]'
      }`}
    >
      <p className="text-base font-black text-white tabular-nums leading-tight truncate">{value}</p>
      <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function HostConfigSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-3 min-h-11 text-left touch-manipulation hover:bg-white/[0.03] transition"
        aria-expanded={open}
      >
        <span className="text-base shrink-0" aria-hidden>{icon}</span>
        <span className="flex-1 text-sm font-semibold text-white">{title}</span>
        <span className="text-[10px] text-gray-500 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 pt-1 border-t border-[#1e1e2f] space-y-3">{children}</div>
      ) : null}
    </div>
  );
}

function GoalProgressBar({
  goal,
  onComplete,
  onRemove,
  completeLabel,
  removeLabel,
}: {
  goal: LiveGoal;
  onComplete?: () => void;
  onRemove?: () => void;
  completeLabel?: string;
  removeLabel?: string;
}) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;
  return (
    <div
      className={`rounded-xl border overflow-hidden ${done ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-[#2a2a3a] bg-[#12121a]'}`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${done ? 'text-emerald-300' : 'text-white'}`}>
              {done ? '✓ ' : ''}{goal.label}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {goalTypeLabel(goal.type)} · {goal.target} {goalUnit(goal.type)}
            </p>
          </div>
          <span className={`shrink-0 text-xs font-black tabular-nums ${done ? 'text-emerald-400' : 'text-purple-400'}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#1e1e2f] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-600 to-purple-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-[10px] mt-1.5 tabular-nums ${done ? 'text-emerald-400' : 'text-gray-400'}`}>
          {goal.current} / {goal.target} {goalUnit(goal.type)}
        </p>
      </div>
      {(onComplete || onRemove) && (
        <div className="flex border-t border-[#1e1e2f] divide-x divide-[#1e1e2f]">
          {onComplete ? (
            <button
              type="button"
              onClick={onComplete}
              className="flex-1 min-h-10 py-2 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 transition touch-manipulation"
            >
              {completeLabel ?? '✓'}
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex-1 min-h-10 py-2 text-[10px] font-bold text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition touch-manipulation"
            >
              {removeLabel ?? '×'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard tab ── */
function DashboardTab({
  stats,
  goals,
  liveId,
  token,
}: {
  stats: LiveStats;
  goals: LiveGoal[];
  liveId: string;
  token?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [periodStats, setPeriodStats] = useState<CreatorDashboardStats | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [elapsed, setElapsed] = useState(Date.now() - stats.startedAt);
  const isCurrentMonth = isCurrentCalendarMonth(selectedYear, selectedMonth);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - stats.startedAt), 1000);
    return () => clearInterval(id);
  }, [stats.startedAt]);

  useEffect(() => {
    if (!token) {
      setPeriodStats(null);
      return;
    }
    let cancelled = false;
    setPeriodLoading(true);
    api
      .getCreatorStats(token, { year: selectedYear, month: selectedMonth })
      .then((r) => {
        if (!cancelled) setPeriodStats(r.stats);
      })
      .catch(() => {
        if (!cancelled) setPeriodStats(null);
      })
      .finally(() => {
        if (!cancelled) setPeriodLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedYear, selectedMonth]);

  const activeGoals = goals.filter((g) => !g.completedAt && g.liveId === liveId);
  const years = useMemo(() => buildCreatorStatsYears(), []);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const label = new Intl.DateTimeFormat(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US', {
          month: 'long',
        }).format(new Date(selectedYear, i, 1));
        return { month, label };
      }),
    [i18n.language, selectedYear]
  );

  const periodDonLabel = periodStats
    ? formatCreatorEuros(periodStats.tipsTotalCents, i18n.language)
    : '—';

  const topDonors =
    periodStats && periodStats.topDonors.length > 0
      ? periodStats.topDonors.map((d) => ({
          name: d.name,
          amount: d.amountCents / 100,
        }))
      : isCurrentMonth
        ? stats.topDonors
        : [];

  return (
    <div className="flex flex-col gap-5 pb-2">
      {isCurrentMonth && (
        <HostPanelSection title={t('live.hostPanelLiveNow')}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: stats.viewers, label: t('live.hostPanelStatViewers') },
              { value: stats.newSubscribers, label: t('live.hostPanelStatNewSubs') },
              { value: `${stats.totalDonations.toFixed(0)}€`, label: t('live.hostPanelStatTips') },
              { value: formatElapsed(elapsed), label: t('live.hostPanelStatDuration') },
            ].map(({ value, label }) => (
              <HostPanelStatTile key={`live-${label}`} value={value} label={label} accent />
            ))}
          </div>
        </HostPanelSection>
      )}

      <HostPanelSection title={t('live.hostPanelPeriodStats')}>
        <div className="flex gap-2 mb-3">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="host-dash-month" className="text-[10px] font-medium text-gray-500 px-0.5">
              {t('live.hostPanelPeriodMonth')}
            </label>
            <select
              id="host-dash-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 capitalize touch-manipulation"
            >
              {monthOptions.map(({ month, label }) => (
                <option key={month} value={month}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24 shrink-0 space-y-1">
            <label htmlFor="host-dash-year" className="text-[10px] font-medium text-gray-500 px-0.5">
              {t('live.hostPanelPeriodYear')}
            </label>
            <select
              id="host-dash-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 touch-manipulation"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${periodLoading ? 'opacity-60' : ''}`}>
          {[
            { value: periodStats?.totalLivePeakViews ?? '—', label: t('live.hostPanelStatPeakViews') },
            { value: periodStats?.newSubscribers ?? '—', label: t('live.hostPanelStatNewSubs') },
            { value: periodDonLabel, label: t('live.hostPanelStatTips') },
            { value: periodStats?.liveCount ?? '—', label: t('live.hostPanelStatLives') },
          ].map(({ value, label }) => (
            <HostPanelStatTile key={label} value={value} label={label} />
          ))}
        </div>
      </HostPanelSection>

      {activeGoals.length > 0 && (
        <HostPanelSection title={t('live.hostPanelActiveGoals')}>
          <div className="flex flex-col gap-2">
            {activeGoals.map((g) => <GoalProgressBar key={g.id} goal={g} />)}
          </div>
        </HostPanelSection>
      )}

      {topDonors.length > 0 && (
        <HostPanelSection title={t('live.hostPanelTopDonors')}>
          <div className="flex flex-col gap-1.5">
            {topDonors.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#12121a] border border-[#1e1e2f]">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : 'bg-[#2d2d3d] text-gray-300'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs text-white truncate">{d.name}</span>
                <span className="text-xs font-bold text-amber-300 tabular-nums shrink-0">{d.amount}€</span>
              </div>
            ))}
          </div>
        </HostPanelSection>
      )}
    </div>
  );
}

/* ── Goals tab ── */
function GoalsTab({
  liveId,
  goalStats,
}: {
  liveId: string;
  goalStats: GoalProgressStats;
}) {
  const { t } = useTranslation();
  const { session, update } = useLiveHostSession(liveId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ type: GoalType; target: string; label: string }>({
    type: 'amount', target: '100', label: '',
  });

  const goals = useMemo(
    () => withGoalsProgress(session.goals, goalStats),
    [session.goals, goalStats],
  );
  const activeGoals = goals.filter((g) => !g.completedAt);
  const doneGoals = goals.filter((g) => !!g.completedAt);

  const overlayVisibleToViewers = session.goalOverlay.visibleToViewers;

  const addGoal = () => {
    const target = parseFloat(form.target);
    if (!form.label.trim() || isNaN(target) || target <= 0) return;
    const g: LiveGoal = {
      id: `g_${Date.now()}`,
      type: form.type,
      target,
      current: 0,
      label: form.label.trim(),
      liveId,
      createdAt: Date.now(),
    };
    update((prev) => ({ goals: [...prev.goals, g] }));
    setForm({ type: 'amount', target: '100', label: '' });
    setCreating(false);
  };

  const removeGoal = (id: string) =>
    update((prev) => ({ goals: prev.goals.filter((g) => g.id !== id) }));
  const completeGoal = (id: string) =>
    update((prev) => ({
      goals: prev.goals.map((g) => (g.id === id ? { ...g, completedAt: Date.now() } : g)),
    }));

  const GOAL_TYPES: GoalType[] = ['amount', 'dons', 'likes', 'viewers', 'duration'];

  return (
    <div className="flex flex-col gap-4 pb-2">
      <HostPanelSection title={t('live.goalOverlaySectionTitle')}>
        <label className="flex items-start gap-3 min-h-11 touch-manipulation cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 w-4 h-4 rounded border-[#333] accent-purple-500"
            checked={overlayVisibleToViewers}
            onChange={(e) =>
              update((prev) => ({
                goalOverlay: { ...prev.goalOverlay, visibleToViewers: e.target.checked },
              }))
            }
          />
          <span className="text-xs text-gray-300 leading-snug">
            {t('live.goalOverlayVisibleToViewers')}
          </span>
        </label>
        <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">{t('live.goalOverlayHostHint')}</p>
      </HostPanelSection>

      {activeGoals.length === 0 && !creating && (
        <HostPanelEmptyState
          icon="🎯"
          title={t('live.hostPanelGoalsEmptyTitle')}
          hint={t('live.hostPanelGoalsEmptyHint')}
          actionLabel={t('live.hostPanelGoalsCreate')}
          onAction={() => setCreating(true)}
        />
      )}

      {activeGoals.length > 0 && (
        <HostPanelSection title={t('live.hostPanelGoalsActive')}>
          <div className="flex flex-col gap-2">
            {activeGoals.map((g) => (
              <GoalProgressBar
                key={g.id}
                goal={g}
                onComplete={() => completeGoal(g.id)}
                onRemove={() => removeGoal(g.id)}
                completeLabel={t('live.hostPanelGoalsComplete')}
                removeLabel={t('live.hostPanelGoalsRemove')}
              />
            ))}
          </div>
        </HostPanelSection>
      )}

      {creating && (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 flex flex-col gap-3">
          <p className="text-sm font-bold text-purple-200">{t('live.hostPanelGoalsNew')}</p>
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5">{t('live.hostPanelGoalsType')}</p>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_TYPES.map((gt) => (
                <button
                  key={gt}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: gt }))}
                  className={`min-h-9 px-2.5 py-1 rounded-full text-[10px] font-medium border transition touch-manipulation ${form.type === gt ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'}`}
                >
                  {goalTypeLabel(gt)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 mb-1">{t('live.hostPanelGoalsTarget')}</p>
              <input
                type="number"
                min="1"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none touch-manipulation"
                placeholder="100"
              />
            </div>
            <div className="shrink-0 w-8 flex items-end pb-2">
              <span className="text-xs text-gray-500">{goalUnit(form.type)}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 mb-1">{t('live.hostPanelGoalsPromise')}</p>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none touch-manipulation"
              placeholder={t('live.hostPanelGoalsPromisePlaceholder')}
              maxLength={60}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addGoal} className="flex-1 min-h-11 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition touch-manipulation">
              {t('live.hostPanelGoalsCreateBtn')}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="flex-1 min-h-11 py-2 rounded-xl bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs transition touch-manipulation">
              {t('live.hostPanelGoalsCancel')}
            </button>
          </div>
        </div>
      )}

      {!creating && activeGoals.length > 0 && (
        <button type="button" onClick={() => setCreating(true)} className="w-full min-h-11 py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition touch-manipulation">
          + {t('live.hostPanelGoalsCreate')}
        </button>
      )}

      {doneGoals.length > 0 && (
        <HostPanelSection title={t('live.hostPanelGoalsDone')}>
          <div className="flex flex-col gap-1.5">
            {doneGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-emerald-400 text-xs">✓</span>
                <span className="flex-1 text-xs text-emerald-300 truncate">{g.label}</span>
                <span className="text-[10px] text-emerald-500 shrink-0">{g.target}{goalUnit(g.type)}</span>
              </div>
            ))}
          </div>
        </HostPanelSection>
      )}
    </div>
  );
}

/* ── Rewards tab ── */
function RewardsTab({ liveId }: { liveId: string }) {
  const { t } = useTranslation();
  const { session, update } = useLiveHostSession(liveId);
  const rewards = session.rewards;
  const queue = session.rewardQueue;
  const [tab, setTab] = useState<'queue' | 'catalog'>('queue');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ type: RewardType; label: string; price: string }>({
    type: 'custom', label: '', price: '10',
  });

  const updateQueue = (id: string, status: RewardQueueItem['status']) =>
    update((prev) => ({
      rewardQueue: prev.rewardQueue.map((i) => (i.id === id ? { ...i, status } : i)),
    }));

  const toggleReward = (id: string) =>
    update((prev) => ({
      rewards: prev.rewards.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));

  const addReward = () => {
    const price = parseFloat(form.price);
    if (!form.label.trim() || isNaN(price) || price <= 0) return;
    update((prev) => ({
      rewards: [
        ...prev.rewards,
        { id: `r_${Date.now()}`, type: form.type, label: form.label.trim(), price, enabled: true },
      ],
    }));
    setForm({ type: 'custom', label: '', price: '10' });
    setCreating(false);
  };

  const REWARD_TYPES: RewardType[] = ['music_request', 'dedication', 'dance', 'backstage', 'badge', 'custom'];
  const pending = queue.filter((i) => i.status === 'pending');
  const actionable = queue.filter((i) => i.status === 'pending' || i.status === 'accepted');

  const statusLabel = (status: RewardQueueItem['status']) => {
    switch (status) {
      case 'pending': return t('live.hostPanelRewardsPending');
      case 'accepted': return t('live.hostPanelRewardsAccepted');
      case 'done': return t('live.hostPanelRewardsDone');
      case 'refused': return t('live.hostPanelRewardsRefused');
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-2">
      <div className="flex p-1 rounded-xl bg-[#0a0a10] border border-[#1e1e2f]">
        {(['queue', 'catalog'] as const).map((qt) => (
          <button
            key={qt}
            type="button"
            onClick={() => setTab(qt)}
            className={`flex-1 min-h-10 py-2 rounded-lg text-xs font-bold transition touch-manipulation ${
              tab === qt ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            {qt === 'queue'
              ? `${t('live.hostPanelRewardsQueue')}${pending.length > 0 ? ` (${pending.length})` : ''}`
              : t('live.hostPanelRewardsCatalog')}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <>
          {actionable.length === 0 && queue.length === 0 && (
            <HostPanelEmptyState
              icon="🎁"
              title={t('live.hostPanelRewardsEmptyTitle')}
              hint={t('live.hostPanelRewardsEmptyHint')}
              actionLabel={t('live.hostPanelRewardsCreate')}
              onAction={() => { setTab('catalog'); setCreating(true); }}
            />
          )}
          {queue.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border overflow-hidden ${
                item.status === 'pending'
                  ? 'border-amber-500/30 bg-amber-950/10'
                  : item.status === 'accepted'
                    ? 'border-emerald-500/30 bg-emerald-950/15'
                    : 'border-[#1e1e2f] bg-[#0e0e16] opacity-60'
              }`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.rewardLabel}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.donorName} · {item.amount}€</p>
                    {item.note ? (
                      <p className="text-[10px] text-purple-300 mt-1 italic truncate">&ldquo;{item.note}&rdquo;</p>
                    ) : null}
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    item.status === 'pending' ? 'bg-amber-500/20 text-amber-300'
                      : item.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-300'
                        : item.status === 'done' ? 'bg-[#2d2d3d] text-gray-400'
                          : 'bg-red-500/20 text-red-300'
                  }`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
              </div>
              {(item.status === 'pending' || item.status === 'accepted') && (
                <div className="flex border-t border-[#1e1e2f] divide-x divide-[#1e1e2f]">
                  {item.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => updateQueue(item.id, 'accepted')}
                      className="flex-1 min-h-10 py-2 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/30 transition touch-manipulation"
                    >
                      {t('live.hostPanelRewardsAccept')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => updateQueue(item.id, 'done')}
                    className="flex-1 min-h-10 py-2 text-[10px] font-bold text-purple-300 hover:bg-purple-950/30 transition touch-manipulation"
                  >
                    {t('live.hostPanelRewardsMarkDone')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQueue(item.id, 'refused')}
                    className="flex-1 min-h-10 py-2 text-[10px] font-bold text-gray-500 hover:text-red-400 hover:bg-red-950/20 transition touch-manipulation"
                  >
                    {t('live.hostPanelRewardsRefuse')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === 'catalog' && (
        <>
          {rewards.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#1e1e2f] bg-[#12121a]">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{r.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {rewardTypeLabel(r.type)} · {r.price}€
                  {r.limitPerLive ? ` · max ${r.remainingCount}/${r.limitPerLive}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleReward(r.id)}
                className={`shrink-0 min-h-9 px-3 py-1 rounded-full text-[10px] font-bold border transition touch-manipulation ${
                  r.enabled ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400' : 'border-[#232330] bg-[#1a1a26] text-gray-500'
                }`}
              >
                {r.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          ))}

          {creating && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 flex flex-col gap-3">
              <p className="text-sm font-bold text-purple-200">{t('live.hostPanelRewardsNew')}</p>
              <div className="flex flex-wrap gap-1.5">
                {REWARD_TYPES.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: rt }))}
                    className={`min-h-9 px-2 py-1 rounded-full text-[10px] font-medium border transition touch-manipulation ${
                      form.type === rt ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {rewardTypeLabel(rt)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none touch-manipulation"
                placeholder={t('live.hostPanelRewardsNew')}
              />
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-24 px-2.5 py-2 min-h-11 rounded-lg bg-[#1a1a26] border border-[#232330] text-white text-xs focus:border-purple-500/50 outline-none touch-manipulation"
                />
                <span className="text-xs text-gray-500">{t('live.hostPanelRewardsMinAmount')}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={addReward} className="flex-1 min-h-11 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition touch-manipulation">
                  {t('live.hostPanelRewardsAdd')}
                </button>
                <button type="button" onClick={() => setCreating(false)} className="flex-1 min-h-11 py-2 rounded-xl bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs transition touch-manipulation">
                  {t('live.hostPanelGoalsCancel')}
                </button>
              </div>
            </div>
          )}
          {!creating && (
            <button type="button" onClick={() => setCreating(true)} className="w-full min-h-11 py-2.5 rounded-xl border border-dashed border-[#2a2a3a] text-gray-500 text-xs hover:border-purple-500/40 hover:text-purple-300 transition touch-manipulation">
              + {t('live.hostPanelRewardsCreate')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ── Triggers tab ── */
function TriggersTab({ liveId }: { liveId: string }) {
  const { t } = useTranslation();
  const { session, update } = useLiveHostSession(liveId);
  const rules = session.triggers;
  const [editId, setEditId] = useState<string | null>(null);

  const toggleRule = (id: string) =>
    update((prev) => ({
      triggers: prev.triggers.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r),
    }));

  const toggleAction = (ruleId: string, action: TriggerAction) =>
    update((prev) => ({
      triggers: prev.triggers.map((r) => {
        if (r.id !== ruleId) return r;
        const actions = r.actions.includes(action)
          ? r.actions.filter((a) => a !== action)
          : [...r.actions, action];
        return { ...r, actions };
      }),
    }));

  return (
    <div className="flex flex-col gap-3 pb-2">
      <p className="text-[11px] text-gray-500 leading-relaxed px-0.5">
        {t('live.hostPanelAutoHint')}
      </p>
      {rules.map((rule) => (
        <div key={rule.id} className={`rounded-xl border overflow-hidden ${rule.enabled ? 'border-[#2a2a3a] bg-[#12121a]' : 'border-[#1a1a26] bg-[#0e0e16] opacity-60'}`}>
          <div className="flex items-center gap-2 p-3">
            <span className="flex-1 text-xs font-bold text-white min-w-0">
              {t('live.hostPanelAutoIfDon', { amount: rule.minAmount })}
            </span>
            <button
              type="button"
              onClick={() => setEditId(editId === rule.id ? null : rule.id)}
              className="min-h-9 px-2.5 py-1 rounded-lg text-[10px] border border-[#232330] text-gray-400 hover:text-white transition touch-manipulation"
            >
              {editId === rule.id ? '▲' : t('live.hostPanelAutoEdit')}
            </button>
            <button
              type="button"
              onClick={() => toggleRule(rule.id)}
              className={`min-h-9 px-3 py-1 rounded-full text-[10px] font-bold border transition touch-manipulation ${
                rule.enabled ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400' : 'border-[#232330] bg-[#1a1a26] text-gray-500'
              }`}
            >
              {rule.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="px-3 pb-3 flex flex-wrap gap-1">
            {rule.actions.map((a) => (
              <span key={a} className="px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[10px] font-medium">
                → {actionLabel(a)}
              </span>
            ))}
          </div>
          {editId === rule.id && (
            <div className="px-3 pb-3 pt-0 border-t border-[#1e1e2f]">
              <p className="text-[10px] text-gray-400 mb-2 pt-3">{t('live.hostPanelAutoActions')}</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_ACTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAction(rule.id, a)}
                    className={`min-h-9 px-2.5 py-1 rounded-full text-[10px] font-medium border transition touch-manipulation ${
                      rule.actions.includes(a) ? 'border-purple-500/50 bg-purple-900/40 text-purple-200' : 'border-[#232330] text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {actionLabel(a)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Don tab (goals + rewards + auto) ── */
type DonSubTab = 'goals' | 'rewards' | 'auto';

function DonTab({
  liveId,
  goalStats,
  initialSubTab = 'goals',
}: {
  liveId: string;
  goalStats: GoalProgressStats;
  initialSubTab?: DonSubTab;
}) {
  const { t } = useTranslation();
  const { session } = useLiveHostSession(liveId);
  const [subTab, setSubTab] = useState<DonSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const pendingRewards = session.rewardQueue.filter((i) => i.status === 'pending').length;

  const SUB_TABS: { id: DonSubTab; label: string; badge?: number }[] = [
    { id: 'goals', label: t('live.hostPanelDonGoals') },
    { id: 'rewards', label: t('live.hostPanelDonRewards'), badge: pendingRewards || undefined },
    { id: 'auto', label: t('live.hostPanelDonAuto') },
  ];

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex p-1 rounded-xl bg-[#0a0a10] border border-[#1e1e2f]">
        {SUB_TABS.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setSubTab(st.id)}
            className={`relative flex-1 min-h-10 py-2 rounded-lg text-xs font-bold transition touch-manipulation ${
              subTab === st.id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            {st.label}
            {st.badge ? (
              <span className="absolute -top-1 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black tabular-nums">
                {st.badge > 9 ? '9+' : st.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {subTab === 'goals' && <GoalsTab liveId={liveId} goalStats={goalStats} />}
      {subTab === 'rewards' && <RewardsTab liveId={liveId} />}
      {subTab === 'auto' && <TriggersTab liveId={liveId} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main LiveHostPanel                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

type PanelTab = 'dashboard' | 'don' | 'config';
export type LiveHostPanelTab = PanelTab;
export type LiveHostPanelDonSubTab = DonSubTab;

interface LiveHostPanelProps {
  liveId: string;
  viewers: number;
  totalDonations: number;
  donationCount: number;
  liveStartedAt: number;
  initialTab?: LiveHostPanelTab;
  initialDonSubTab?: LiveHostPanelDonSubTab;
  chatConfig?: {
    noLinksForParticipants?: boolean;
    slowModeSeconds?: number;
    subscribersOnly?: boolean;
    blockedTerms?: string[];
  };
  token?: string | null;
  isCloudflareStream?: boolean;
  isLiveKitStream?: boolean;
  obsIngestLive?: boolean;
  hostMediaSettings?: LiveHostMediaSettingsProps;
  user?: User | null;
  onUserUpdated?: () => void;
  onClose: () => void;
  /** Titre courant du live (modifiable en direct — Config). */
  liveTitle?: string;
  liveDescription?: string;
  isSensitive?: boolean;
  replayEnabled?: boolean;
  pinnedAnnouncement?: LivePinnedAnnouncement;
  activePoll?: LivePoll;
}

export function LiveHostPanel({
  liveId,
  viewers,
  totalDonations,
  donationCount,
  liveStartedAt,
  initialTab = 'dashboard',
  initialDonSubTab = 'goals',
  chatConfig: initialChatConfig,
  token,
  isCloudflareStream = false,
  isLiveKitStream = false,
  obsIngestLive = false,
  hostMediaSettings,
  user,
  onUserUpdated,
  onClose,
  liveTitle = '',
  liveDescription,
  isSensitive,
  replayEnabled,
  pinnedAnnouncement,
  activePoll,
}: LiveHostPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);
  const [newSubscribers, setNewSubscribers] = useState(0);
  const [topDonors, setTopDonors] = useState<{ name: string; amount: number }[]>([]);
  const startedAtRef = useRef(liveStartedAt);
  const [chatConfig, setChatConfig] = useState({
    noLinksForParticipants: initialChatConfig?.noLinksForParticipants ?? false,
    slowModeSeconds: initialChatConfig?.slowModeSeconds ?? 0,
    subscribersOnly: initialChatConfig?.subscribersOnly ?? false,
    blockedTerms: initialChatConfig?.blockedTerms ?? [],
  });

  const emitConfigUpdate = (patch: Partial<typeof chatConfig>) => {
    const next = { ...chatConfig, ...patch };
    setChatConfig(next);
    const socket = getSocket();
    socket?.emit('live_update_config', { liveId, config: next });
  };

  const emitMetaUpdate = (patch: {
    title?: string;
    description?: string;
    isSensitive?: boolean;
    replayEnabled?: boolean;
  }) => {
    getSocket()?.emit('live_update_meta', { liveId, ...patch });
  };

  const emitAnnouncement = (text: string | null) => {
    getSocket()?.emit('live_pin_announcement', { liveId, text });
  };

  const emitPollCreate = (question: string, options: string[]) => {
    getSocket()?.emit('live_poll_create', { liveId, question, options });
  };

  const emitPollClose = () => {
    getSocket()?.emit('live_poll_close', { liveId });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!initialChatConfig) return;
    setChatConfig({
      noLinksForParticipants: initialChatConfig.noLinksForParticipants ?? false,
      slowModeSeconds: initialChatConfig.slowModeSeconds ?? 0,
      subscribersOnly: initialChatConfig.subscribersOnly ?? false,
      blockedTerms: initialChatConfig.blockedTerms ?? [],
    });
  }, [initialChatConfig]);

  const goalStats: GoalProgressStats = useMemo(
    () => ({
      totalDonations,
      donationCount,
      viewers,
      startedAt: startedAtRef.current,
    }),
    [totalDonations, donationCount, viewers]
  );

  const { session: hostSession } = useLiveHostSession(liveId);
  const goalsWithProgress = useMemo(
    () => withGoalsProgress(hostSession.goals, goalStats),
    [hostSession.goals, goalStats],
  );

  // Écoute les dons pour le classement top donateurs
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onGift = (gift: { liveId: string; senderName: string; amount?: number }) => {
      if (gift.liveId !== liveId || !gift.amount) return;
      setTopDonors((prev) => {
        const existing = prev.find((d) => d.name === gift.senderName);
        const updated = existing
          ? prev.map((d) => d.name === gift.senderName ? { ...d, amount: d.amount + gift.amount! } : d)
          : [...prev, { name: gift.senderName, amount: gift.amount! }];
        return updated.sort((a, b) => b.amount - a.amount).slice(0, 5);
      });
    };
    const onSub = (data: { liveId: string }) => {
      if (data.liveId === liveId) setNewSubscribers((n) => n + 1);
    };
    socket.on('gift_animation', onGift);
    socket.on('live_subscription', onSub);
    return () => {
      socket.off('gift_animation', onGift);
      socket.off('live_subscription', onSub);
    };
  }, [liveId]);

  const stats: LiveStats = {
    viewers,
    newSubscribers,
    totalDonations,
    donationCount,
    startedAt: startedAtRef.current,
    topDonors,
  };

  const TABS: { id: PanelTab; label: string; icon: string; subtitle: string }[] = [
    { id: 'dashboard', label: t('live.hostDockDashboard'), icon: '📊', subtitle: t('live.hostPanelSubtitleDashboard') },
    { id: 'don', label: t('live.hostPanelTabDon'), icon: '💰', subtitle: t('live.hostPanelSubtitleDon') },
    { id: 'config', label: t('live.hostPanelTabConfig'), icon: '⚙', subtitle: t('live.hostPanelSubtitleConfig') },
  ];

  const activeMeta = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div className="fixed inset-0 z-[91] flex items-end sm:items-center justify-center pointer-events-none p-0 sm:p-4">
        <div
          className="pointer-events-auto w-full sm:max-w-lg bg-[#0f0f1a] border border-[#1e1e2f] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl"
          style={{ maxHeight: 'min(90dvh, 680px)' }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="live-host-panel-title"
        >
          <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
            <span className="w-10 h-1 rounded-full bg-[#2a2a3a]" aria-hidden />
          </div>

          <div className="flex items-start gap-3 px-4 pt-3 sm:pt-4 pb-2 shrink-0">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="text-xl shrink-0 mt-0.5" aria-hidden>{activeMeta.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" aria-hidden />
                  <p id="live-host-panel-title" className="text-sm font-bold text-white truncate">
                    {t('live.hostPanelTitle')}
                  </p>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{activeMeta.subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1a1a26] text-gray-400 hover:text-white text-lg transition shrink-0 touch-manipulation"
              aria-label={t('live.hostPanelClose')}
            >
              ×
            </button>
          </div>

          <div className="flex border-b border-[#1e1e2f] px-2 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 min-h-11 py-2.5 text-xs font-bold transition touch-manipulation ${
                  activeTab === tab.id ? 'text-purple-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="hidden sm:inline">{tab.icon} </span>
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-purple-500 rounded-full" aria-hidden />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {activeTab === 'dashboard' && (
              <DashboardTab stats={stats} goals={goalsWithProgress} liveId={liveId} token={token} />
            )}
            {activeTab === 'don' && (
              <DonTab liveId={liveId} goalStats={goalStats} initialSubTab={initialDonSubTab} />
            )}
            {activeTab === 'config' && (
              <div className="flex flex-col gap-3">
                <HostConfigSection title={t('live.hostPanelConfigMeta')} icon="📝" defaultOpen>
                  <LiveHostMetaSettings
                    value={{ title: liveTitle, description: liveDescription, isSensitive, replayEnabled }}
                    onChange={emitMetaUpdate}
                  />
                </HostConfigSection>
                <HostConfigSection title={t('live.hostPanelConfigAnnouncement')} icon="📌">
                  <LiveHostAnnouncementSettings
                    announcement={pinnedAnnouncement}
                    onPublish={(text) => emitAnnouncement(text)}
                    onClear={() => emitAnnouncement(null)}
                  />
                </HostConfigSection>
                <HostConfigSection title={t('live.hostPanelConfigPoll')} icon="🗳">
                  <LiveHostPollSettings
                    activePoll={activePoll}
                    onCreate={emitPollCreate}
                    onClose={emitPollClose}
                  />
                </HostConfigSection>
                {hostMediaSettings ? (
                  <HostConfigSection title={t('live.hostPanelConfigMedia')} icon="🎥" defaultOpen>
                    <LiveHostMediaSettings {...hostMediaSettings} />
                  </HostConfigSection>
                ) : null}
                {token && isLiveKitStream ? (
                  <HostConfigSection title={t('live.hostPanelConfigStream')} icon="📡">
                    <LiveKitCdnEgressSettings liveId={liveId} token={token} />
                  </HostConfigSection>
                ) : null}
                {token && isCloudflareStream ? (
                  <HostConfigSection title={t('live.hostPanelConfigStream')} icon="📡">
                    <LiveObsIngestSettings token={token} liveId={liveId} obsIngestLive={obsIngestLive} />
                  </HostConfigSection>
                ) : null}
                {token && user && typeof user.age === 'number' && user.age >= DONATION_MIN_AGE ? (
                  <HostConfigSection title={t('live.hostPanelConfigStripe')} icon="💳">
                    <CreatorStripeConnectCard
                      token={token}
                      user={user}
                      onUserUpdated={onUserUpdated}
                    />
                  </HostConfigSection>
                ) : null}
                <HostConfigSection title={t('live.hostPanelConfigChat')} icon="💬" defaultOpen={!hostMediaSettings}>
                  <LiveChatConfigFields
                    value={chatConfig}
                    onChange={(patch) => emitConfigUpdate(patch)}
                  />
                </HostConfigSection>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
