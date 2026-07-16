import { useMemo } from 'react';
import { BORDER_RADIUS } from '../../constants';
import { buildBordersGeometry } from '../../utils/countryGeometry';
import type { PreparedCountry } from '../../types';

interface CountryBordersProps {
  countries: PreparedCountry[];
  color: string;
}

/**
 * Toutes les frontières du monde fusionnées en une seule géométrie de segments
 * (un unique draw call plutôt qu'un `<line>` par pays) — essentiel pour rester
 * fluide avec ~180 pays / plusieurs milliers de sommets.
 */
export function CountryBorders({ countries, color }: CountryBordersProps) {
  const geometry = useMemo(() => buildBordersGeometry(countries, BORDER_RADIUS), [countries]);

  if (countries.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.55} />
    </lineSegments>
  );
}
