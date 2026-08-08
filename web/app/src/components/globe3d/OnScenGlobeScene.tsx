import { Earth } from './Earth';
import { Clouds } from './Clouds';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { CountryBorders } from './CountryBorders';
import { OnScenGlobeMarkers, type OnScenGlobePoint } from './OnScenGlobeMarkers';
import { OnScenGlobeEventMarkers } from './OnScenGlobeEventMarkers';
import { OnScenGlobeLiveMarkers } from './OnScenGlobeLiveMarkers';
import { OnScenGlobeSalonMarkers } from './OnScenGlobeSalonMarkers';
import { OnScenGlobeUserMarker } from './OnScenGlobeUserMarker';
import { OnScenGlobeRings, type OnScenGlobeRing } from './OnScenGlobeRings';
import { OnScenGlobeQueryRadiusRing } from './OnScenGlobeQueryRadiusRing';
import { OnScenGlobeCapitalLabels } from './OnScenGlobeCapitalLabels';
import { GlobeCameraBridge, type GlobeCameraBridgeHandle, type RecenterRequest } from './GlobeCameraBridge';
import type { PreparedCountry } from '../../lib/globe3d/types';
import type { GlobeCapitalLabel } from '../../lib/worldCapitals';
import type { DevMapMarkerRef } from '../../lib/devMapMarkerDrag';

export interface OnScenGlobeSceneProps {
  countries: PreparedCountry[];
  lowPower: boolean;
  points: OnScenGlobePoint[];
  rings: OnScenGlobeRing[];
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
  onPointClick: (point: OnScenGlobePoint) => void;
  onGlobeDblClick?: (lat: number, lng: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onControlsChange: () => void;
  autoRotateEnabled?: boolean;
  controlsEnabled?: boolean;
  devMarkerDragEnabled?: boolean;
  onDevMarkerDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void;
}

export function OnScenGlobeScene({
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
}: OnScenGlobeSceneProps) {
  return (
    <>
      <Starfield lowPower={lowPower} />
      <Atmosphere />

      <Earth useBumpMap={!lowPower} onGlobeDblClick={onGlobeDblClick} />
      <Clouds parallaxActive={autoRotateEnabled} />
      <CountryBorders countries={countries} />

      <OnScenGlobeMarkers
        points={points}
        resolution={pointResolution}
        overviewDots={overviewDots}
        onPointClick={onPointClick}
      />
      <OnScenGlobeEventMarkers points={points} onPointClick={onPointClick} />
      <OnScenGlobeLiveMarkers
        points={points}
        overviewDots={overviewDots}
        onPointClick={onPointClick}
      />
      <OnScenGlobeSalonMarkers points={points} onPointClick={onPointClick} />
      <OnScenGlobeUserMarker points={points} />
      <OnScenGlobeRings
        rings={rings}
        maxRadius={ringMaxRadius}
        propagationSpeed={ringPropagationSpeed}
        repeatPeriod={ringRepeatPeriod}
      />
      {livesListViewportCircle && livesListViewportCircle.radiusKm > 0 ? (
        <OnScenGlobeQueryRadiusRing
          lat={livesListViewportCircle.lat}
          lng={livesListViewportCircle.lng}
          radiusKm={livesListViewportCircle.radiusKm}
          kind="viewport"
        />
      ) : null}
      {livesListPinCircle && livesListPinCircle.radiusKm > 0 ? (
        <OnScenGlobeQueryRadiusRing
          lat={livesListPinCircle.lat}
          lng={livesListPinCircle.lng}
          radiusKm={livesListPinCircle.radiusKm}
          kind="reference"
        />
      ) : null}
      <OnScenGlobeCapitalLabels labels={capitalLabels} />

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
