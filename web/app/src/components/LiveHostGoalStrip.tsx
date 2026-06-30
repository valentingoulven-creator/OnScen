/**
 * LiveHostGoalStrip — Bande goal actif sous la Quick Bar
 * Affiche le premier goal actif avec sa barre de progression.
 * Tap → ouvre le panel Goals.
 */
import type { LiveGoal } from '../lib/liveHostTypes';

interface LiveHostGoalStripProps {
  goal: LiveGoal;
  onClick: () => void;
}

function goalUnit(type: LiveGoal['type']): string {
  switch (type) {
    case 'amount':   return '€';
    case 'dons':     return 'dons';
    case 'likes':    return 'likes';
    case 'viewers':  return 'spec.';
    case 'duration': return 'min';
  }
}

export function LiveHostGoalStrip({ goal, onClick }: LiveHostGoalStripProps) {
  const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const done = pct >= 100;
  const nearDone = pct >= 90 && !done;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 w-full flex items-center gap-3 px-4 py-2 border-b ${
        done
          ? 'border-emerald-500/30 bg-emerald-950/20'
          : nearDone
          ? 'border-amber-500/30 bg-amber-950/15'
          : 'border-[#1e1e2f] bg-[#0d0d16]'
      } transition hover:brightness-110 active:brightness-90`}
      aria-label={`Goal ${goal.label} — ${pct}%`}
    >
      {/* Label + valeurs */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${done ? 'text-emerald-400' : nearDone ? 'text-amber-400' : 'text-purple-400'}`}>
            {done ? 'ATTEINT' : 'GOAL'}
          </span>
          <span className="text-xs font-semibold text-white truncate">{goal.label}</span>
        </div>
        {/* Barre */}
        <div className="h-1 rounded-full bg-[#1e1e2f] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              done ? 'bg-emerald-500' : nearDone ? 'bg-amber-500 live-goal-pulse' : 'bg-purple-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Valeur chiffrée */}
      <div className="shrink-0 text-right">
        <p className={`text-xs font-black tabular-nums ${done ? 'text-emerald-400' : 'text-white'}`}>
          {goal.current}<span className="text-gray-500 font-normal">/</span>{goal.target}
          <span className="text-gray-500 text-[10px] ml-0.5">{goalUnit(goal.type)}</span>
        </p>
        <p className={`text-[10px] font-bold ${done ? 'text-emerald-400' : nearDone ? 'text-amber-400' : 'text-purple-400'}`}>
          {pct}%
        </p>
      </div>

      {/* Chevron */}
      <svg className="shrink-0 w-3 h-3 text-gray-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
}
