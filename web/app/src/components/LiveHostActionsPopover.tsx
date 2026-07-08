import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAnchoredPopoverPosition } from '../hooks/useAnchoredPopoverPosition';
import { useLiveHostSession } from '../hooks/useLiveHostSession';
import {
  type GoalProgressStats,
  withGoalsProgress,
} from '../lib/liveGoalProgress';
import type { LiveGoal, RewardQueueItem } from '../lib/liveHostTypes';
import { LIVE_THEATER_CHROME_BTN_CLASS } from './LiveVideoTheaterChrome';

type LiveHostActionsPopoverProps = {
  liveId: string;
  goalStats: GoalProgressStats;
  panelAbove?: boolean;
  variant?: 'default' | 'theater-chrome';
  onOpenDonPanel?: (subTab: 'goals' | 'rewards') => void;
};

const POPOVER_TRIGGER_CLASS =
  'relative w-11 h-11 flex items-center justify-center rounded-lg transition text-sm leading-none touch-manipulation';

const THEATER_CHROME_TRIGGER_CLASS = `relative ${LIVE_THEATER_CHROME_BTN_CLASS} text-sm leading-none`;

function goalUnit(type: LiveGoal['type']): string {
  switch (type) {
    case 'amount':
      return '€';
    case 'duration':
      return 'min';
    default:
      return '';
  }
}

function ActionRow({
  title,
  subtitle,
  note,
  badge,
  onValidate,
  onDelete,
  validateLabel,
  deleteLabel,
}: {
  title: string;
  subtitle: string;
  note?: string;
  badge: string;
  onValidate: () => void;
  onDelete: () => void;
  validateLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#12121a] p-2.5">
      <div className="flex items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-purple-300">
              {badge}
            </span>
          </div>
          <p className="text-xs font-bold text-white truncate">{title}</p>
          <p className="text-[10px] text-gray-500 truncate">{subtitle}</p>
          {note ? (
            <p className="text-[10px] text-purple-300 mt-0.5 italic truncate">&ldquo;{note}&rdquo;</p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onValidate}
          className="flex-1 min-h-9 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-900 transition touch-manipulation"
        >
          {validateLabel}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 min-h-9 py-1.5 rounded-lg bg-[#1a1a26] border border-[#232330] text-gray-400 text-[10px] font-bold hover:text-red-400 hover:border-red-500/30 transition touch-manipulation"
        >
          {deleteLabel}
        </button>
      </div>
    </div>
  );
}

export function LiveHostActionsPopover({
  liveId,
  goalStats,
  panelAbove = false,
  variant = 'default',
  onOpenDonPanel,
}: LiveHostActionsPopoverProps) {
  const { t } = useTranslation();
  const { session, update } = useLiveHostSession(liveId);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const goals = useMemo(
    () => withGoalsProgress(session.goals, goalStats).filter((g) => g.liveId === liveId),
    [session.goals, goalStats, liveId],
  );
  const activeGoals = goals.filter((g) => !g.completedAt);
  const rewardActions = session.rewardQueue.filter(
    (i) => i.status === 'pending' || i.status === 'accepted',
  );

  const todoCount = rewardActions.length + activeGoals.length;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const updateQueue = (id: string, status: RewardQueueItem['status']) =>
    update((prev) => ({
      rewardQueue: prev.rewardQueue.map((i) => (i.id === id ? { ...i, status } : i)),
    }));

  const completeGoal = (id: string) =>
    update((prev) => ({
      goals: prev.goals.map((g) => (g.id === id ? { ...g, completedAt: Date.now() } : g)),
    }));

  const removeGoal = (id: string) =>
    update((prev) => ({ goals: prev.goals.filter((g) => g.id !== id) }));

  const countLabel =
    todoCount === 0
      ? t('live.hostActionsCountNone')
      : t('live.hostActionsCount', { count: todoCount });

  const panelPos = useAnchoredPopoverPosition(open, buttonRef, panelRef, [
    todoCount,
    rewardActions.length,
    activeGoals.length,
  ], { estimatedWidth: 320, estimatedHeight: 320, preferAbove: panelAbove });

  const panel =
    open && typeof document !== 'undefined' ? (
      <div
        ref={panelRef}
        className="fixed z-[70] w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-purple-500/30 bg-[#0e0e14] shadow-2xl overflow-hidden"
        style={{
          top: panelPos?.top ?? (buttonRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
          left: panelPos?.left ?? 8,
          visibility: panelPos ? 'visible' : 'hidden',
        }}
      >
          <div className="px-3 py-2 border-b border-purple-500/20 bg-[#14101c]/90">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500 tabular-nums min-w-0 truncate">{countLabel}</p>
              <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest shrink-0">
                {t('live.hostActionsShort')}
              </p>
            </div>
          </div>

          <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
            {todoCount === 0 ? (
              <p className="text-[11px] text-gray-500 px-1 py-2">{t('live.hostActionsEmpty')}</p>
            ) : null}

            {rewardActions.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-0.5">
                  {t('live.hostActionsRewardsSection')}
                </p>
                {rewardActions.map((item) => (
                  <ActionRow
                    key={item.id}
                    badge={
                      item.status === 'accepted'
                        ? t('live.hostActionsRewardAccepted')
                        : t('live.hostActionsRewardPending')
                    }
                    title={item.rewardLabel}
                    subtitle={`${item.donorName} · ${item.amount}€`}
                    note={item.note}
                    validateLabel={t('live.hostActionsValidate')}
                    deleteLabel={t('live.hostActionsDelete')}
                    onValidate={() => updateQueue(item.id, 'done')}
                    onDelete={() => updateQueue(item.id, 'refused')}
                  />
                ))}
              </div>
            ) : null}

            {activeGoals.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-0.5">
                  {t('live.hostActionsGoalsSection')}
                </p>
                {activeGoals.map((g) => {
                  const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                  const ready = pct >= 100;
                  return (
                    <ActionRow
                      key={g.id}
                      badge={
                        ready
                          ? t('live.hostActionsGoalReady')
                          : t('live.hostActionsGoalProgress', { pct })
                      }
                      title={g.label}
                      subtitle={`${g.current} / ${g.target}${goalUnit(g.type) ? ` ${goalUnit(g.type)}` : ''}`}
                      validateLabel={t('live.hostActionsValidate')}
                      deleteLabel={t('live.hostActionsDelete')}
                      onValidate={() => completeGoal(g.id)}
                      onDelete={() => removeGoal(g.id)}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>

          {onOpenDonPanel ? (
            <div className="px-2 pb-2 border-t border-[#1e1e2f] pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenDonPanel(rewardActions.length > 0 ? 'rewards' : 'goals');
                  setOpen(false);
                }}
                className="w-full min-h-9 py-2 rounded-lg bg-purple-900/40 border border-purple-500/30 text-purple-200 text-[10px] font-bold hover:bg-purple-900/60 transition touch-manipulation"
              >
                {t('live.hostActionsOpenDonPanel')}
              </button>
            </div>
          ) : null}
      </div>
    ) : null;

  const triggerBaseClass = variant === 'theater-chrome' ? THEATER_CHROME_TRIGGER_CLASS : POPOVER_TRIGGER_CLASS;
  const triggerStateClass =
    variant === 'theater-chrome'
      ? open
        ? 'ring-2 ring-purple-400/60'
        : todoCount > 0
          ? 'ring-2 ring-amber-400/50'
          : ''
      : open
        ? 'text-purple-300 bg-purple-950/50'
        : todoCount > 0
          ? 'text-amber-300 hover:bg-white/10'
          : 'text-gray-500 hover:text-purple-300 hover:bg-white/10';

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${triggerBaseClass} ${triggerStateClass}`}
        aria-label={t('live.hostActionsTodo')}
        aria-expanded={open}
        title={t('live.hostActionsTodo')}
      >
        <span aria-hidden>📋</span>
        {todoCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black tabular-nums">
            {todoCount > 9 ? '9+' : todoCount}
          </span>
        ) : null}
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
