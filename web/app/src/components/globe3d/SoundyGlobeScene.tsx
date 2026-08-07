import { Earth } from './Earth';
import { Clouds } from './Clouds';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { CountryBorders } from './CountryBorders';
import { SoundyGlobeMarkers, type SoundyGlobePoint } from './SoundyGlobeMarkers';
import { SoundyGlobeEventMarkers } from './SoundyGlobeEventMarkers';
import { SoundyGlobeLiveMarkers } from './SoundyGlobeLiveMarkers';
import { SoundyGlobeSalonMarkers } from './SoundyGlobeSalonMarkers';
import { SoundyGlobeUserMarker } from './SoundyGlobeUserMarker';
import { SoundyGlobeRings, type SoundyGlobeRing } from './SoundyGlobeRings';
import { SoundyGlobeQueryRadiusRing } from './SoundyGlobeQueryRadiusRing';
import { SoundyGlobeCapitalLabels } from './SoundyGlobeCapitalLabels';
import { GlobeCameraBridge, type GlobeCameraBridgeHandle, type RecenterRequest } from './GlobeCameraBridge';
import type { PreparedCountry } from '../../lib/globe3d/types';
import type { GlobeCapitalLabel } from '../../lib/worldCapitals';
import type { DevMapMarkerRef } from '../../lib/devMapMarkerDrag';

export interface SoundyGlobeSceneProps {
  countries: PreparedCountry[];
  lowPower: boolean;
  points: SoundyGlobePoint[];
  rings: SoundyGlobeRing[];
  capitalLabels: GlobeCapitalLabel[];
  overviewDots: boolean;
  pointResolution: number;
  ringMaxRadius: number;
  ringPropagationSpeed: number;
  ringRepeatPeriod: number;
  /** @deprecated Rayon réf. nearby retiré de l’UI — conservé pour compat API interne. */
  livesListRadius?: { lat: number; lng: number; radiusKm: number } | null;
  livesListViewportCircle?: { lat: number; lng: number; radiusKm: number } | null;
  /** Filtre Lives : cercle rouge = pins visibles (POV). */
  livesListPinCircle?: { lat: number; lng: number; radiusKm: number } | null;
  cameraRef: React.RefObject<GlobeCameraBridgeHandle | null>;
  recenterRequest: RecenterRequest | null;
  onPointClick: (point: SoundyGlobePoint) => void;
  onGlobeDblClick?: (lat: number, lng: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onControlsChange: () => void;
  autoRotateEnabled?: boolean;
  controlsEnabled?: boolean;
  devMarkerDragEnabled?: boolean;
  onDevMarkerDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void;
}

export function SoundyGlobeScene({
  countries,
  lowPower,
  points,
  rings,
  capitalLabels,
  overviewDots,
  pointResolution,
  ringMaxRadius,
  ringPropagationSpeed,
  ringRepeatPeriod,
  livesListViewportCircle,
  livesListPinCircle,
  cameraRef,
  recenterRequest,
  onPointClick,
  onGlobeDblClick,
  onInteractionStart,
  onInteractionEnd,
  onControlsChange,
  autoRotateEnabled = false,
  controlsEnabled = true,
}: SoundyGlobeSceneProps) {
  return (
    <>
      <Starfield lowPower={lowPower} />
      <Atmosphere />

      <Earth useBumpMap={!lowPower} onGlobeDblClick={onGlobeDblClick} />
      <Clouds parallaxActive={autoRotateEnabled} />
      <CountryBorders countries={countries} />

      <SoundyGlobeMarkers
        points={points}
        resolution={pointResolution}
        overviewDots={overviewDots}
        onPointClick={onPointClick}
      />
      <SoundyGlobeEventMarkers points={points} onPointClick={onPointClick} />
      <SoundyGlobeLiveMarkers
        points={points}
        overviewDots={overviewDots}
        onPointClick={onPointClick}
      />
      <SoundyGlobeSalonMarkers points={points} onPointClick={onPointClick} />
      <SoundyGlobeUserMarker points={points} />
      <SoundyGlobeRings
        rings={rings}
        maxRadius={ringMaxRadius}
        propagationSpeed={ringPropagationSpeed}
        repeatPeriod={ringRepeatPeriod}
      />
      {livesListViewportCircle && livesListViewportCircle.radiusKm > 0 ? (
        <SoundyGlobeQueryRadiusRing
          lat={livesListViewportCircle.lat}
          lng={livesListViewportCircle.lng}
          radiusKm={livesListViewportCircle.radiusKm}
          kind="viewport"
        />
      ) : null}
      {livesListPinCircle && livesListPinCircle.radiusKm > 0 ? (
        <SoundyGlobeQueryRadiusRing
          lat={livesListPinCircle.lat}
          lng={livesListPinCircle.lng}
          radiusKm={livesListPinCircle.radiusKm}
          kind="reference"
        />
      ) : null}
      <SoundyGlobeCapitalLabels labels={capitalLabels} />

      <GlobeCameraBridge
        ref={cameraRef}
        autoRotateEnabled={autoRotateEnabled}
        controlsEnabled={controlsEnabled}
        recenterRequest={recenterRequest}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        onControlsChange={onControlsChange}
      />
    </>
  );
}
