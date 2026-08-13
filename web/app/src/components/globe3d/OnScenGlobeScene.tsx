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
