import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

type OnScenLogoVariant = 'mark' | 'lockup';

type OnScenLogoProps = {
  className?: string;
  /** `mark` = icône seule (header). `lockup` = icône + wordmark (+ tagline sur auth). */
  variant?: OnScenLogoVariant;
  density?: 'default' | 'compact';
  showTagline?: boolean;
  /** Afficher le pictogramme (désactivé sur la page connexion si besoin). */
  showMark?: boolean;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;

function OnScenMarkSvg({
  gradientId,
  className,
}: {
  gradientId: string;
  className?: string;
}) {
  const grad = `url(#${gradientId})`;
  return (
    <svg
      className={className}
      viewBox="-2 0 68 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--onscen-logo-wave-from, #22d3ee)" />
          <stop offset="0.52" stopColor="var(--onscen-logo-wave-mid, #a855f7)" />
          <stop offset="1" stopColor="var(--onscen-logo-wave-to, #f472b6)" />
        </linearGradient>
        <radialGradient
          id={`${gradientId}-glow`}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(46 18) rotate(90) scale(14)"
        >
          <stop stopColor="#f472b6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f472b6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Anneau scène / projecteur */}
      <circle cx="32" cy="34" r="26" stroke={grad} strokeWidth="1.75" opacity="0.28" />
      <path
        d="M10 42c0-16 9.8-28 22-28s22 12 22 28"
        stroke={grad}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M14 42h36" stroke={grad} strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      {/* Onde sonore — salons & musique */}
      <rect x="21" y="27" width="4.5" height="13" rx="2.25" fill={grad} opacity="0.72" />
      <rect x="29.75" y="21" width="4.5" height="19" rx="2.25" fill={grad} />
      <rect x="38.5" y="25" width="4.5" height="15" rx="2.25" fill={grad} opacity="0.88" />
      {/* Direct / live */}
      <circle cx="46" cy="16" r="9" fill={`url(#${gradientId}-glow)`} />
      <circle cx="46" cy="16" r="4.25" fill="var(--onscen-logo-wave-to, #f472b6)" />
      <circle cx="46" cy="16" r="4.25" stroke="#fff" strokeWidth="1.25" strokeOpacity="0.35" />
    </svg>
  );
}

/** Logo OnScen — scène, live et son (dégradé cyan → violet → rose). */
export function OnScenLogo({
  className = '',
  variant = 'mark',
  density = 'default',
  showTagline = true,
  showMark = true,
  ...props
}: OnScenLogoProps) {
  const { t } = useTranslation();
  const gradientId = `onscen-logo-${useId().replace(/:/g, '')}`;
  const alt = t('app.name', { defaultValue: 'OnScen' });

  if (variant === 'lockup') {
    const compact = density === 'compact';
    const textOnly = !showMark;
    return (
      <div
        className={`flex flex-col items-center text-center ${className}`.trim()}
        role="img"
        aria-label={alt}
      >
        {showMark ? (
        <span
          className={
            compact
              ? 'mb-1.5 inline-flex h-11 w-11 shrink-0 overflow-visible drop-shadow-[0_0_20px_rgba(168,85,247,0.32)]'
              : 'mb-3 mt-1 inline-flex h-14 w-14 shrink-0 overflow-visible sm:h-[4.25rem] sm:w-[4.25rem] drop-shadow-[0_0_28px_rgba(168,85,247,0.38)]'
          }
        >
          <OnScenMarkSvg gradientId={gradientId} className="h-full w-full" />
        </span>
        ) : null}
        <p
          className={
            textOnly && compact
              ? 'text-[1.875rem] sm:text-[2rem] font-extrabold tracking-tight leading-none'
              : compact
                ? 'text-xl font-extrabold tracking-tight leading-none'
                : 'text-[1.625rem] sm:text-[1.875rem] font-extrabold tracking-tight leading-none'
          }
        >
          <span className="text-white">On</span>
          <span className="ms-onscen-wordmark">Scen</span>
        </p>
        {showTagline ? (
          <p
            className={
              textOnly && compact
                ? 'mt-1.5 max-w-[18rem] text-xs text-gray-400/90 tracking-wide leading-snug'
                : compact
                  ? 'mt-1 text-[11px] text-gray-400/95 tracking-wide leading-snug'
                  : 'mt-2.5 text-sm text-gray-400/95 tracking-wide'
            }
          >
            {t('app.tagline')}
          </p>
        ) : null}
      </div>
    );
  }

  const sizeClass = className.trim();
  const markWrapperClass = sizeClass
    ? sizeClass.includes('inline') || sizeClass.includes('h-') || sizeClass.includes('w-')
      ? sizeClass
      : `inline-flex shrink-0 ${sizeClass}`
    : 'inline-flex h-7 w-7 shrink-0 sm:h-8 sm:w-8';

  return (
    <span className={markWrapperClass} role="img" aria-label={alt} {...props}>
      <OnScenMarkSvg gradientId={gradientId} className="h-full w-full" />
    </span>
  );
}

type OnScenLogoButtonProps = {
  className?: string;
  logoClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/** Bouton logo (ex. header → Accueil). */
export function OnScenLogoButton({
  className = 'shrink-0 cursor-pointer hover:opacity-85 active:scale-95 transition',
  logoClassName,
  ...props
}: OnScenLogoButtonProps) {
  const { t } = useTranslation();
  return (
    <button type="button" className={className} title={t('nav.home')} aria-label={t('nav.home')} {...props}>
      <OnScenLogo className={logoClassName ?? 'h-7 w-7 sm:h-8 sm:w-8'} />
    </button>
  );
}
