/** Icône filtre Accueil (stories) — trois barres horizontales dégressives. */
export const FILTER_ICON_CLASS = 'w-7 h-7';

export function FilterIcon({ className = FILTER_ICON_CLASS }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
