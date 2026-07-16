import type { RefObject } from 'react';

interface TooltipProps {
  elRef: RefObject<HTMLDivElement>;
  countryName: string | null;
}

/**
 * Infobulle DOM qui suit le curseur. Le CONTENU est piloté par React (props),
 * la POSITION est mise à jour de façon impérative (voir `GlobeExperience`) pour
 * ne provoquer aucun re-rendu React à chaque pixel de mouvement de la souris.
 */
export function Tooltip({ elRef, countryName }: TooltipProps) {
  return (
    <div ref={elRef} className="globe-tooltip" style={{ opacity: countryName ? 1 : 0 }} aria-hidden={!countryName}>
      {countryName}
    </div>
  );
}
