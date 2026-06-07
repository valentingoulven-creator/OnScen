export type TabId = 'actualite' | 'map' | 'live' | 'dm' | 'reels';

interface TabIconProps {
  tab: TabId;
  className?: string;
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

/** Icônes SVG maison (~28px), currentColor = état actif/inactif du bouton. */
export function TabIcon({ tab, className = 'w-7 h-7 shrink-0' }: TabIconProps) {
  switch (tab) {
    case 'actualite':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6 9.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'map':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <path d="M12 21s-6-4.9-6-9.5a6 6 0 1 1 12 0C18 16.1 12 21 12 21z" />
          <circle cx="12" cy="11.5" r="2.25" />
        </svg>
      );
    case 'live':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 240"
          className={className}
          aria-hidden="true"
        >
          <g transform="translate(100, 105)">
            <circle cx="0" cy="0" r="16" fill="currentColor" />
            <path
              d="M -30,0 A 30,30 0 0,1 30,0"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M -52,0 A 52,52 0 0,1 52,0"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M -74,0 A 74,74 0 0,1 74,0"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </g>
          <text
            x="100"
            y="205"
            fill="currentColor"
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
    case 'dm':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-1.1 3.8 8.5 8.5 0 0 1-7.4 4.3 8.4 8.4 0 0 1-3.8-1.1L3 21l1.9-5.7A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 7.3 3.6 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 8 8.5z" />
        </svg>
      );
    case 'reels':
      return (
        <svg {...svgBase} className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
