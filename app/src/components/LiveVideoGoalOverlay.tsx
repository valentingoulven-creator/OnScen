/**
 * LiveVideoGoalOverlay — Barre de goal visible sur la vidéo (public + host).
 */
import type { LiveGoal } from '../lib/liveHostTypes';

interface LiveVideoGoalOverlayProps {
  goal: LiveGoal;
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

export function LiveVideoGoalOverlay({ goal }: LiveVideoGoalOverlayProps) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;

  return (
    <div
      className={`absolute bottom-2 left-2 right-2 z-20 pointer-events-none rounded-xl border px-3 py-2 backdrop-blur-md ${
        done ? 'border-emerald-500/40 bg-emerald-950/75' : 'border-purple-500/30 bg-black/70'
      }`}
      aria-label={`Goal ${goal.label} — ${pct}%`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex items-center gap-1.5">
          <span
            className={`text-[9px] font-black uppercase tracking-widest shrink-0 ${
              done ? 'text-emerald-400' : 'text-purple-400'
            }`}
          >
            {done ? 'ATTEINT' : 'GOAL'}
          </span>
          <span className="text-xs font-semibold text-white truncate">{goal.label}</span>
        </div>
        <span className={`text-[10px] font-black tabular-nums shrink-0 ${done ? 'text-emerald-400' : 'text-white'}`}>
          {goal.current}/{goal.target}
          {goalUnit(goal.type)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done ? 'bg-emerald-500' : 'bg-purple-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
