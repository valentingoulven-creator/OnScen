/**
 * LiveHostTopBar — Barre de navigation compacte hôte
 * Remplace la bande 1 du header : ← | titre + LIVE + viewers + chrono | [⋯] [↗]
 */
import type { ReactNode } from 'react';

interface LiveHostTopBarProps {
  title: string;
  viewers: number;
  remainingMs: number | null;
  onBack: () => void;
  onShare: () => void;
  /** Contrôles hôte (MIC, CAM, Board…) — à droite, avant partager */
  hostControls?: ReactNode;
  /** Action centrée dans la barre (ex. arrêter le live) */
  centerControls?: ReactNode;
  trailing?: ReactNode;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function LiveHostTopBar({
  title,
  viewers,
  remainingMs,
  onBack,
  onShare,
  hostControls,
  centerControls,
  trailing,
}: LiveHostTopBarProps) {
  return (
    <div className="relative shrink-0 flex items-center gap-2 px-3 min-h-11 py-1 bg-[#0b0b0f] border-b border-[#1e1e2f]">
      {/* Retour */}
      <button
        onClick={onBack}
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1a1a26] transition"
        aria-label="Retour"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Titre + badges */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-sm font-bold text-white truncate leading-none">{title}</p>

        {/* Badge LIVE */}
        <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-black text-white uppercase tracking-wide leading-none">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" aria-hidden />
          LIVE
        </span>

        {/* Viewers */}
        <span className="shrink-0 flex items-center gap-1 text-[11px] text-gray-400 font-medium">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
          {formatViewers(viewers)}
        </span>

        {/* Timer */}
        {remainingMs !== null && remainingMs > 0 && (
          <span className={`shrink-0 text-[11px] font-mono font-semibold ${remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#4a4a6a]'}`}>
            {formatRemaining(remainingMs)}
          </span>
        )}
      </div>

      {centerControls ? (
        <div className="absolute inset-x-0 flex justify-center pointer-events-none z-10 px-[4.5rem] sm:px-20">
          <div className="pointer-events-auto">{centerControls}</div>
        </div>
      ) : null}

      {/* Actions droite */}
      <div className="shrink-0 flex items-center gap-0.5 max-w-[min(52vw,16rem)] sm:max-w-none overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trailing}
        {hostControls}
        <button
          type="button"
          onClick={onShare}
          className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-[#1a1a26] transition"
          aria-label="Partager"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
