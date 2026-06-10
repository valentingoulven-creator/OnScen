import { isMsdevEnvironment } from '../lib/liveCameraSupport';

const badgeClassName =
  'inline-block text-[9px] sm:text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-amber-500/55 bg-amber-950/85 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.12)]';

/** Pill « MSDEV » — visible uniquement quand VITE_APP_ENV=msdev (build prod : production). */
export function MsdevEnvBadge({ className = '' }: { className?: string }) {
  if (!isMsdevEnvironment()) return null;

  return (
    <span
      role="status"
      aria-label="Environnement de développement local MSDEV"
      className={`${badgeClassName}${className ? ` ${className}` : ''}`}
    >
      MSDEV
    </span>
  );
}

/** Indicateur fixe en haut à droite — connexion, chargement, app connectée. */
export function MsdevEnvIndicator() {
  if (!isMsdevEnvironment()) return null;

  return (
    <div
      className="fixed top-[max(0.4rem,env(safe-area-inset-top))] right-2 z-[110] pointer-events-none select-none"
      aria-hidden={false}
    >
      <MsdevEnvBadge />
    </div>
  );
}
