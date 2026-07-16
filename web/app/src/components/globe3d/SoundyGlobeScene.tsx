import { Earth } from './Earth';
import { Clouds } from './Clouds';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { CountryBorders } from './CountryBorders';
import { SoundyGlobeMarkers, type SoundyGlobePoint } from './SoundyGlobeMarkers';
import { SoundyGlobeEventMarkers } from './SoundyGlobeEventMarkers';
import { SoundyGlobeLiveMarkers } from './SoundyGlobeLiveMarkers';
import { SoundyGlobeUserMarker } from './SoundyGlobeUserMarker';
import { SoundyGlobeRings, type SoundyGlobeRing } from './SoundyGlobeRings';
import { SoundyGlobeCapitalLabels } from './SoundyGlobeCapitalLabels';
import { GlobeCameraBridge, type GlobeCameraBridgeHandle, type RecenterRequest } from './GlobeCameraBridge';
import type { PreparedCountry } from '../../lib/globe3d/types';
import type { GlobeCapitalLabel } from '../../lib/worldCapitals';

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
  cameraRef: React.RefObject<GlobeCameraBridgeHandle | null>;
  recenterRequest: RecenterRequest | null;
  onPointClick: (point: SoundyGlobePoint) => void;
  onGlobeDblClick?: (lat: number, lng: number) => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onControlsChange: () => void;
  autoRotateEnabled?: boolean;
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
  cameraRef,
  recenterRequest,
  onPointClick,
  onGlobeDblClick,
  onInteractionStart,
  onInteractionEnd,
  onControlsChange,
  autoRotateEnabled = false,
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
      <SoundyGlobeLiveMarkers points={points} onPointClick={onPointClick} />
      <SoundyGlobeUserMarker points={points} />
      <SoundyGlobeRings
        rings={rings}
        maxRadius={ringMaxRadius}
        propagationSpeed={ringPropagationSpeed}
        repeatPeriod={ringRepeatPeriod}
      />
      <SoundyGlobeCapitalLabels labels={capitalLabels} />

      <GlobeCameraBridge
        ref={cameraRef}
        autoRotateEnabled={autoRotateEnabled}
        recenterRequest={recenterRequest}
        onInteractionStart={onInteractionStart}
        onInteractionEnd={onInteractionEnd}
        onControlsChange={onControlsChange}
      />
    </>
  );
}
