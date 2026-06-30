/**
 * LiveVideoGoalOverlay — Goal compact sur la scène vidéo (coin bas-gauche).
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
      className={`absolute bottom-2 left-2 z-20 pointer-events-none max-w-[min(calc(100%-1rem),13rem)] rounded-lg border px-2 py-1.5 backdrop-blur-md shadow-lg ${
        done ? 'border-emerald-500/40 bg-emerald-950/80' : 'border-purple-500/25 bg-black/75'
      }`}
      aria-label={`Goal ${goal.label} — ${pct}%`}
    >
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
    </div>
  );
}
