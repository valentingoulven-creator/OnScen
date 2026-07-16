import { useCallback, useRef, useState } from 'react';
import { useCountriesData } from '../hooks/useCountriesData';
import { useGlobeSettings } from '../context/globeSettingsContextObject';
import { GlobeCanvas } from './canvas/GlobeCanvas';
import { SearchBar } from './ui/SearchBar';
import { ControlsPanel } from './ui/ControlsPanel';
import { Tooltip } from './ui/Tooltip';
import { LoadingOverlay } from './ui/LoadingOverlay';
import type { PreparedCountry } from '../types';

/** Décalage (px) entre le curseur et le coin de l'infobulle, pour ne pas le masquer. */
const TOOLTIP_OFFSET_X = 18;
const TOOLTIP_OFFSET_Y = 14;

/**
 * Compose la scène 3D et l'interface (recherche, contrôles, infobulle, écran de
 * chargement). Point d'entrée unique consommant le contexte `GlobeSettings`.
 */
export function GlobeExperience() {
  const { countries, loading: countriesLoading } = useCountriesData();
  const { darkMode, toggleDarkMode, selectedCountry, selectCountry, focusTarget, consumeFocusTarget } =
    useGlobeSettings();

  const [hoveredCountryName, setHoveredCountryName] = useState<string | null>(null);
  const tooltipElRef = useRef<HTMLDivElement>(null);

  /** Mutation DOM directe (pas de re-rendu React) — appelée à chaque mouvement du curseur. */
  const updateTooltipPosition = useCallback((clientX: number, clientY: number) => {
    const el = tooltipElRef.current;
    if (el) el.style.transform = `translate(${clientX + TOOLTIP_OFFSET_X}px, ${clientY + TOOLTIP_OFFSET_Y}px)`;
  }, []);

  const handleHoverCountry = useCallback((country: PreparedCountry | null) => {
    setHoveredCountryName(country?.name ?? null);
  }, []);

  const handlePickCountry = useCallback(
    (country: PreparedCountry) => {
      selectCountry({ name: country.name, lon: country.centroid.lon, lat: country.centroid.lat });
    },
    [selectCountry]
  );

  return (
    <div className={`globe-app ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      <GlobeCanvas
        countries={countries}
        darkMode={darkMode}
        selectedCountryName={selectedCountry?.name ?? null}
        focusTarget={focusTarget}
        onFocusArrived={consumeFocusTarget}
        onHoverCountry={handleHoverCountry}
        onSelectCountry={handlePickCountry}
        onPointerScreenPosition={updateTooltipPosition}
      />

      <Tooltip elRef={tooltipElRef} countryName={hoveredCountryName} />

      <header className="ui-top">
        <SearchBar countries={countries} onSelect={handlePickCountry} />
      </header>

      <ControlsPanel
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        selectedCountryName={selectedCountry?.name ?? null}
      />

      <LoadingOverlay countriesLoading={countriesLoading} />
    </div>
  );
}
