import { useEffect, useMemo } from 'react';
import { BORDER_RADIUS } from '../../lib/globe3d/constants';
import { buildBordersGeometry } from '../../lib/globe3d/countryGeometry';
import type { PreparedCountry } from '../../lib/globe3d/types';

interface CountryBordersProps {
  countries: PreparedCountry[];
}

export function CountryBorders({ countries }: CountryBordersProps) {
  const geometry = useMemo(() => buildBordersGeometry(countries, BORDER_RADIUS), [countries]);

  // `countries` change de référence rarement (chargement GeoJSON), mais sans
  // ce cleanup l'ancienne géométrie fusionnée (potentiellement volumineuse)
  // reste allouée côté GPU jusqu'au garbage collection du composant.
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (countries.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="rgba(130, 150, 180, 0.14)" transparent opacity={0.28} />
    </lineSegments>
  );
}
