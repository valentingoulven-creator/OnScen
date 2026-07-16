import { useRef } from 'react';
import type { BufferGeometry } from 'three';
import { HIGHLIGHT_RADIUS } from '../../constants';
import { buildCountryFillGeometry } from '../../utils/countryGeometry';
import type { PreparedCountry } from '../../types';

/** Cache mémoire : évite de re-trianguler un pays déjà survolé/sélectionné précédemment. */
function useFillGeometryCache() {
  const cache = useRef(new Map<string, BufferGeometry | null>());
  return function getFillGeometry(country: PreparedCountry): BufferGeometry | null {
    const cached = cache.current.get(country.name);
    if (cached !== undefined) return cached;
    const built = buildCountryFillGeometry(country.polygons, HIGHLIGHT_RADIUS);
    cache.current.set(country.name, built);
    return built;
  };
}

interface CountryHighlightProps {
  hoveredCountry: PreparedCountry | null;
  selectedCountry: PreparedCountry | null;
}

/**
 * Surbrillance des pays : remplissage plein sur la surface du globe.
 * - survol : jaune doux, disparaît quand le curseur quitte le pays ;
 * - sélection (clic / recherche) : orange plus soutenu, persiste jusqu'à la sélection suivante.
 */
export function CountryHighlight({ hoveredCountry, selectedCountry }: CountryHighlightProps) {
  const getFillGeometry = useFillGeometryCache();

  const isSameAsSelected = hoveredCountry && selectedCountry && hoveredCountry.name === selectedCountry.name;

  return (
    <>
      {selectedCountry && (
        <mesh geometry={getFillGeometry(selectedCountry) ?? undefined} renderOrder={2}>
          <meshBasicMaterial color="#ff8a3d" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      {hoveredCountry && !isSameAsSelected && (
        <mesh geometry={getFillGeometry(hoveredCountry) ?? undefined} renderOrder={3}>
          <meshBasicMaterial color="#ffd166" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
