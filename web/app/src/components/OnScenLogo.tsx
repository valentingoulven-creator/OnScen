import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import onscenLogoMark from '../assets/onscen-logo.png';

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

function OnScenMarkImg({ className }: { className?: string }) {
  return (
    <img
      src={onscenLogoMark}
      alt=""
      draggable={false}
      className={className ?? 'h-full w-full object-contain'}
    />
  );
}

/** Logo OnScen — étoile + anneau (dégradé jaune → magenta). */
export function OnScenLogo({
  className = '',
  variant = 'mark',
  density = 'default',
  showTagline = true,
  showMark = true,
  ...props
}: OnScenLogoProps) {
  const { t } = useTranslation();
  const alt = t('app.name', { defaultValue: 'OnScen' });

  if (variant === 'lockup') {
    const compact = density === 'compact';
    const textOnly = !showMark;
    return (
      <div
        className={`mx-auto flex w-fit flex-col items-center justify-center text-center ${className}`.trim()}
        role="img"
        aria-label={alt}
      >
        {showMark ? (
        <span
          className={
            compact
              ? 'mb-1.5 inline-flex h-14 w-14 shrink-0 overflow-visible drop-shadow-[0_0_20px_rgba(236,72,153,0.35)]'
              : 'mb-3 mt-1 inline-flex h-16 w-16 shrink-0 overflow-visible sm:h-[4.5rem] sm:w-[4.5rem] drop-shadow-[0_0_28px_rgba(236,72,153,0.4)]'
          }
        >
          <OnScenMarkImg className="h-full w-full object-contain" />
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
      <OnScenMarkImg className="h-full w-full object-contain" />
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
