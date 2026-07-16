import { useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { CAMERA_MAX_DISTANCE, CAMERA_MIN_DISTANCE } from '../../constants';
import { useCameraFlyTo } from '../../hooks/useCameraFlyTo';
import { Earth } from './Earth';
import { Clouds } from './Clouds';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { CountryBorders } from './CountryBorders';
import { CountryHighlight } from './CountryHighlight';
import { CapitalMarkers } from './CapitalMarkers';
import type { FocusTarget, PreparedCountry } from '../../types';

export interface GlobeSceneProps {
  countries: PreparedCountry[];
  darkMode: boolean;
  selectedCountryName: string | null;
  focusTarget: FocusTarget | null;
  onFocusArrived: () => void;
  onHoverCountry: (country: PreparedCountry | null) => void;
  onSelectCountry: (country: PreparedCountry) => void;
  onPointerScreenPosition: (clientX: number, clientY: number) => void;
}

/** Assemble toutes les couches du globe et gère les interactions caméra/pays. */
export function GlobeScene({
  countries,
  darkMode,
  selectedCountryName,
  focusTarget,
  onFocusArrived,
  onHoverCountry,
  onSelectCountry,
  onPointerScreenPosition,
}: GlobeSceneProps) {
  const [hoveredCountry, setHoveredCountry] = useState<PreparedCountry | null>(null);
  const { cancelFlight } = useCameraFlyTo(focusTarget, onFocusArrived);

  const selectedCountry = selectedCountryName
    ? countries.find((c) => c.name === selectedCountryName) ?? null
    : null;

  function handleHover(country: PreparedCountry | null) {
    setHoveredCountry(country);
    onHoverCountry(country);
  }

  const borderColor = darkMode ? '#8fb4e6' : '#2a3550';
  const capitalColor = darkMode ? '#ffe08a' : '#c0392b';
  const atmosphereColor = darkMode ? '#5fb1ff' : '#a9d4ff';

  return (
    <>
      <Starfield />
      <Atmosphere color={atmosphereColor} intensity={darkMode ? 0.9 : 0.55} />

      <Earth
        countries={countries}
        onHoverCountry={handleHover}
        onSelectCountry={onSelectCountry}
        onPointerScreenPosition={onPointerScreenPosition}
      />
      <Clouds />
      <CountryBorders countries={countries} color={borderColor} />
      <CountryHighlight hoveredCountry={hoveredCountry} selectedCountry={selectedCountry} />
      <CapitalMarkers color={capitalColor} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
        onStart={cancelFlight}
      />
    </>
  );
}
