export type TabId = 'actualite' | 'map' | 'live' | 'dm' | 'music' | 'reels';

/** ID partagé pour le dégradé wave des icônes dock (defs dans MainTabNav). */
export const SOUNDY_TAB_WAVE_GRADIENT_ID = 'soundy-tab-wave';

interface TabIconProps {
  tab: TabId;
  className?: string;
  /** Dégradé Soundly purple → pink (onglet actif). */
  wave?: boolean;
}

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function waveStroke(wave?: boolean): string {
  return wave ? `url(#${SOUNDY_TAB_WAVE_GRADIENT_ID})` : 'currentColor';
}

function waveFill(wave?: boolean): string {
  return wave ? `url(#${SOUNDY_TAB_WAVE_GRADIENT_ID})` : 'currentColor';
}

/** Icône « LIVE » (vinyle + ondes) — hub carte. */
function LiveBrandIcon({ className = 'w-7 h-7 shrink-0', wave = false }: { className?: string; wave?: boolean }) {
  const stroke = waveStroke(wave);
  const fill = waveFill(wave);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" className={className} aria-hidden="true">
      <g transform="translate(100, 105)">
        <circle cx="0" cy="0" r="16" fill={fill} />
        <path
          d="M -30,0 A 30,30 0 0,1 30,0"
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M -52,0 A 52,52 0 0,1 52,0"
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M -74,0 A 74,74 0 0,1 74,0"
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <text
        x="100"
        y="205"
        fill={fill}
        fontFamily="Arial Black, Impact, -apple-system, sans-serif"
        fontWeight="900"
        fontSize="46"
        letterSpacing="0.5"
        textAnchor="middle"
      >
        LIVE
      </text>
    </svg>
  );
}

/** Icônes SVG maison (~28px), currentColor = état actif/inactif du bouton. */
export function TabIcon({ tab, className = 'w-7 h-7 shrink-0', wave = false }: TabIconProps) {
  const stroke = waveStroke(wave);
  const fill = waveFill(wave);
  switch (tab) {
    case 'actualite':
      return (
        <svg {...svgBase} stroke={stroke} className={className} aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'map':
    case 'live':
      return <LiveBrandIcon className={className} wave={wave} />;
    case 'dm':
      return (
        <svg {...svgBase} stroke={stroke} className={className} aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-1.1 3.8 8.5 8.5 0 0 1-7.4 4.3 8.4 8.4 0 0 1-3.8-1.1L3 21l1.9-5.7A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 7.3 3.6 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 8 8.5z" />
        </svg>
      );
    case 'music':
      return (
        <svg {...svgBase} stroke={stroke} className={className} aria-hidden="true">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill={fill} stroke="none" />
          <circle cx="18" cy="16" r="3" fill={fill} stroke="none" />
        </svg>
      );
    case 'reels':
      return (
        <svg {...svgBase} stroke={stroke} className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill={fill} stroke="none" />
        </svg>
      );
  }
}
