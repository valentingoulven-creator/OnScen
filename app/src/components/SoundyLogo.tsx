import { useId } from 'react';
import type { ButtonHTMLAttributes, SVGAttributes } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_USERNAME_WAVE_FROM, DEFAULT_USERNAME_WAVE_TO } from '../lib/usernameColor';

/** Profondeur 3D — dérivés du violet wave. */
const DEPTH_LAYERS = [
  { dx: 3, dy: 3, fill: '#6b21a8' },
  { dx: 2, dy: 2, fill: '#7e22ce' },
  { dx: 1, dy: 1, fill: '#9333ea' },
] as const;

const LOGO_TEXT = {
  fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  fontSize: 36,
  fontWeight: 800,
  letterSpacing: -1,
} as const;

const LOGO_X = 2;
const LOGO_Y = 34;

type SoundyLogoProps = {
  className?: string;
} & Omit<SVGAttributes<SVGSVGElement>, 'children' | 'viewBox'>;

/** Wordmark « Soundy » 3D style diamant (dégradé wave #c084fc → #f472b6). */
export function SoundyLogo({ className = 'h-7 sm:h-8 w-auto shrink-0', ...props }: SoundyLogoProps) {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const waveId = `soundy-logo-wave-${uid}`;
  const facetId = `soundy-logo-facet-${uid}`;
  const shineId = `soundy-logo-shine-${uid}`;

  return (
    <svg
      role="img"
      aria-label={t('app.name', { defaultValue: 'Soundy' })}
      viewBox="0 0 176 44"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={waveId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={DEFAULT_USERNAME_WAVE_FROM} />
          <stop offset="100%" stopColor={DEFAULT_USERNAME_WAVE_TO} />
        </linearGradient>
        <linearGradient id={facetId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="30%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="70%" stopColor={DEFAULT_USERNAME_WAVE_TO} stopOpacity="0.2" />
          <stop offset="100%" stopColor={DEFAULT_USERNAME_WAVE_FROM} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={shineId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="22%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {DEPTH_LAYERS.map(({ dx, dy, fill }) => (
        <text key={`${dx}-${dy}`} x={LOGO_X + dx} y={LOGO_Y + dy} fill={fill} {...LOGO_TEXT}>
          Soundy
        </text>
      ))}

      <text x={LOGO_X} y={LOGO_Y} fill={`url(#${waveId})`} {...LOGO_TEXT}>
        Soundy
      </text>

      <text x={LOGO_X} y={LOGO_Y} fill={`url(#${facetId})`} {...LOGO_TEXT}>
        Soundy
      </text>

      <text x={LOGO_X} y={LOGO_Y} fill={`url(#${shineId})`} {...LOGO_TEXT}>
        Soundy
      </text>

      <text
        x={LOGO_X}
        y={LOGO_Y}
        fill="none"
        stroke={DEFAULT_USERNAME_WAVE_TO}
        strokeWidth={0.4}
        strokeOpacity={0.45}
        {...LOGO_TEXT}
      >
        Soundy
      </text>
    </svg>
  );
}

type SoundyLogoButtonProps = {
  className?: string;
  logoClassName?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/** Bouton logo (ex. header → Accueil). */
export function SoundyLogoButton({
  className = 'shrink-0 cursor-pointer hover:opacity-85 active:scale-95 transition',
  logoClassName,
  ...props
}: SoundyLogoButtonProps) {
  const { t } = useTranslation();
  return (
    <button type="button" className={className} title={t('nav.home')} aria-label={t('nav.home')} {...props}>
      <SoundyLogo className={logoClassName ?? 'h-7 sm:h-8 w-auto block'} />
    </button>
  );
}
