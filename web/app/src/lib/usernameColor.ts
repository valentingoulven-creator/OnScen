import type { CSSProperties } from 'react';

/** Dégradé OnScen (header App.tsx). */
export const USERNAME_COLOR_WAVE = 'wave';

/** Dégradé wave par défaut (Tailwind purple-400 → pink-400). */
export const DEFAULT_USERNAME_WAVE_FROM = '#c084fc';
export const DEFAULT_USERNAME_WAVE_TO = '#f472b6';

export const ONSCEN_WAVE_BG_CLASS = 'bg-gradient-to-r from-purple-400 to-pink-400';

export const USERNAME_WAVE_CLASS = `${ONSCEN_WAVE_BG_CLASS} bg-clip-text text-transparent`;

export type UsernameWaveTint = {
  from?: string | null;
  to?: string | null;
};

/** Couleurs unies proposées dans l’édition profil. */
export const USERNAME_SOLID_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: 'default', label: 'Par défaut', hex: '' },
  { id: 'purple', label: 'Violet', hex: '#c4b5fd' },
  { id: 'pink', label: 'Rose', hex: '#f9a8d4' },
  { id: 'cyan', label: 'Cyan', hex: '#67e8f9' },
  { id: 'amber', label: 'Ambre', hex: '#fcd34d' },
  { id: 'green', label: 'Vert', hex: '#86efac' },
  { id: 'red', label: 'Rouge', hex: '#fca5a5' },
];

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isWaveUsernameColor(color?: string | null): boolean {
  return color === USERNAME_COLOR_WAVE;
}

export function isDefaultUsernameWaveTint(wave?: UsernameWaveTint | null): boolean {
  const { from, to } = resolveUsernameWaveColors(wave);
  return from === DEFAULT_USERNAME_WAVE_FROM && to === DEFAULT_USERNAME_WAVE_TO;
}

export function resolveUsernameWaveColors(wave?: UsernameWaveTint | null): {
  from: string;
  to: string;
} {
  const from =
    wave?.from && HEX_RE.test(wave.from) ? wave.from : DEFAULT_USERNAME_WAVE_FROM;
  const to = wave?.to && HEX_RE.test(wave.to) ? wave.to : DEFAULT_USERNAME_WAVE_TO;
  return { from, to };
}

export function usernameWaveDisplayStyle(wave?: UsernameWaveTint | null): CSSProperties {
  const { from, to } = resolveUsernameWaveColors(wave);
  return {
    backgroundImage: `linear-gradient(to right, ${from}, ${to})`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
}

export function usernameDisplayClassName(
  color?: string | null,
  wave?: UsernameWaveTint | null,
  extra?: string
): string | undefined {
  if (!color) return extra;
  if (isWaveUsernameColor(color)) {
    const clip = 'bg-clip-text text-transparent';
    if (isDefaultUsernameWaveTint(wave)) {
      return [USERNAME_WAVE_CLASS, extra].filter(Boolean).join(' ');
    }
    return [clip, extra].filter(Boolean).join(' ');
  }
  return extra;
}

export function usernameDisplayStyle(
  color?: string | null,
  wave?: UsernameWaveTint | null
): CSSProperties | undefined {
  if (!color) return undefined;
  if (isWaveUsernameColor(color)) return usernameWaveDisplayStyle(wave);
  return { color };
}

function waveMarkerInlineStyle(from: string, to: string): string {
  return [
    `background-image:linear-gradient(to right,${from},${to})`,
    '-webkit-background-clip:text',
    'background-clip:text',
    'color:transparent',
  ].join(';');
}

/** Style inline + classes pour libellés HTML (Leaflet divIcon). */
export function getUsernameStyle(
  usernameColor?: string | null,
  wave?: UsernameWaveTint | null
): {
  className: string;
  style: string;
} {
  const parts = ['map-marker-username'];
  if (isWaveUsernameColor(usernameColor)) {
    if (isDefaultUsernameWaveTint(wave)) {
      parts.push('map-marker-username--wave');
      return { className: parts.join(' '), style: '' };
    }
    const { from, to } = resolveUsernameWaveColors(wave);
    return {
      className: parts.join(' '),
      style: waveMarkerInlineStyle(from, to),
    };
  }
  // Couleur unie : validée en hex strict (comme le chemin wave ci-dessus) au
  // lieu d'un simple `.replace(/"/g, '')` — sinon une valeur usernameColor
  // non hex (donnée historique/legacy non validée en DB) s'injecte telle
  // quelle dans l'attribut `style`, permettant une injection CSS arbitraire
  // (ex. `position:fixed;...` pour du défacement) même si le breakout HTML
  // par guillemet reste bloqué.
  if (usernameColor && HEX_RE.test(usernameColor)) {
    return {
      className: parts.join(' '),
      style: `color:${usernameColor}`,
    };
  }
  return { className: parts.join(' '), style: '' };
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Span HTML pour pseudo sur marqueurs carte (échappe le texte). */
export function usernameMapLabelHtml(
  text: string,
  usernameColor?: string | null,
  opts?: { maxLength?: number; wave?: UsernameWaveTint | null }
): string {
  const max = opts?.maxLength ?? 12;
  const label = text.slice(0, max);
  const { className, style } = getUsernameStyle(usernameColor, opts?.wave);
  const styleAttr = style ? ` style="${escapeHtmlAttr(style)}"` : '';
  return `<span class="${className}"${styleAttr}>${escapeHtmlAttr(label)}</span>`;
}

/** Libellé carte neutre (titre piste, etc.) — reste blanc sur fond sombre. */
export function mapMarkerLabelHtml(text: string, maxLength = 12): string {
  const label = text.slice(0, maxLength);
  return `<span class="map-marker-label">${escapeHtmlAttr(label)}</span>`;
}
