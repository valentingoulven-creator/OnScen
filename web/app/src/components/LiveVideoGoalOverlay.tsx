/**
 * LiveVideoGoalOverlay — Goal sur la scène vidéo (positionnable ; édition hôte).
 */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LiveGoal } from '../lib/liveHostTypes';
import { clampGoalOverlayPosition } from '../lib/liveGoalOverlay';

export interface LiveVideoGoalOverlayProps {
  goal: LiveGoal;
  xPct: number;
  yPct: number;
  /** Hôte : déplacer la barre et ajuster la progression. */
  editable?: boolean;
  onPositionChange?: (pos: { xPct: number; yPct: number }) => void;
  onManualCurrentChange?: (value: number | null) => void;
}

function goalUnit(type: LiveGoal['type']): string {
  switch (type) {
    case 'amount':
      return '€';
    case 'dons':
      return 'dons';
    case 'likes':
      return 'likes';
    case 'viewers':
      return 'spec.';
    case 'duration':
      return 'min';
  }
}

export function LiveVideoGoalOverlay({
  goal,
  xPct,
  yPct,
  editable = false,
  onPositionChange,
  onManualCurrentChange,
}: LiveVideoGoalOverlayProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [editing, setEditing] = useState(false);

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editable || !onPositionChange) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: xPct, origY: yPct };
    },
    [editable, onPositionChange, xPct, yPct],
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !onPositionChange) return;
      const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
      const w = parent?.clientWidth ?? 360;
      const h = parent?.clientHeight ?? 640;
      const dx = ((e.clientX - dragRef.current.startX) / w) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / h) * 100;
      onPositionChange(
        clampGoalOverlayPosition(dragRef.current.origX + dx, dragRef.current.origY + dy),
      );
    },
    [onPositionChange],
  );

  const onDragPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      className={`absolute z-20 max-w-[min(calc(100%-1rem),14rem)] rounded-lg border px-2 py-1.5 backdrop-blur-md shadow-lg ${
        done ? 'border-emerald-500/40 bg-emerald-950/80' : 'border-purple-500/25 bg-black/75'
      } ${editable ? 'pointer-events-auto touch-none' : 'pointer-events-none'}`}
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      aria-label={`Goal ${goal.label} — ${pct}%`}
    >
      {editable ? (
        <button
          type="button"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
          className="absolute -top-2 -left-1 w-8 h-8 flex items-center justify-center rounded-full bg-purple-600/90 border border-purple-400/50 text-[10px] cursor-grab active:cursor-grabbing touch-manipulation"
          aria-label={t('live.goalOverlayDrag')}
          title={t('live.goalOverlayDrag')}
        >
          ⠿
        </button>
      ) : null}

      <div className="flex items-center gap-1 min-w-0">
        <span
          className={`text-[7px] font-black uppercase tracking-wider shrink-0 leading-none ${
            done ? 'text-emerald-400' : 'text-purple-400'
          }`}
        >
          {done ? 'OK' : 'Goal'}
        </span>
        <span className="text-[10px] font-semibold text-white truncate min-w-0 flex-1 leading-tight">
          {goal.label}
        </span>
        <span
          className={`text-[9px] font-bold tabular-nums shrink-0 leading-none ${
            done ? 'text-emerald-400' : 'text-gray-300'
          }`}
        >
          {goal.current}/{goal.target}
          {goalUnit(goal.type)}
        </span>
      </div>
      <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done ? 'bg-emerald-500' : 'bg-purple-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {editable && onManualCurrentChange ? (
        <div className="mt-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-[9px] font-bold text-purple-300 hover:text-purple-200 touch-manipulation min-h-8 px-1"
          >
            {editing ? t('live.goalOverlayHideAdjust') : t('live.goalOverlayAdjust')}
          </button>
          {editing ? (
            <div className="mt-1 space-y-1.5">
              <input
                type="range"
                min={0}
                max={goal.target}
                step={goal.type === 'amount' ? 1 : 1}
                value={Math.min(goal.target, goal.current)}
                onChange={(e) => onManualCurrentChange(Number(e.target.value))}
                className="w-full h-2 accent-purple-500 touch-manipulation"
                aria-label={t('live.goalOverlayProgress')}
              />
              <button
                type="button"
                onClick={() => {
                  onManualCurrentChange(null);
                  setEditing(false);
                }}
                className="text-[9px] text-gray-400 hover:text-gray-200 touch-manipulation min-h-8"
              >
                {t('live.goalOverlayAutoProgress')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
