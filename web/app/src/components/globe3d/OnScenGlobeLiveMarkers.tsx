import type { Live } from '../../types';
import type { MapLiveLocationCluster } from '../../lib/mapLiveClusters';
import { salonToMapLive } from '../../lib/mapLiveSalonMarkers';
import {
  buildFlatLiveMarkerHtml,
  buildLiveClusterOverviewMarkerHtml,
  buildOverviewGeoMarkerHtml,
  liveMapHostLabel,
} from '../../lib/mapOverviewMarkerHtml';
import type { OnScenGlobePoint } from './OnScenGlobeMarkers';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface OnScenGlobeLiveMarkersProps {
  points: OnScenGlobePoint[];
  overviewDots: boolean;
  onPointClick: (point: OnScenGlobePoint) => void;
}

const LIVE_TYPES = new Set(['live', 'live-cluster']);
const MAX_HTML_LIVE_MARKERS = 120;

function liveFromGlobePoint(p: OnScenGlobePoint): Live | null {
  if (p.type === 'live' && p.entity) return p.entity as Live;
  if (p.type === 'live-cluster' && p.entity) {
    const cluster = p.entity as MapLiveLocationCluster;
    if (cluster.lives[0]) return cluster.lives[0]!;
    const salon = cluster.salons[0];
    if (salon) return salonToMapLive(salon);
  }
  return null;
}

function buildGlobeLiveMarkerHtml(p: OnScenGlobePoint, overviewDots: boolean): string {
  const live = liveFromGlobePoint(p);
  const multi = Boolean(p.count && p.count > 1);

  if (multi && p.count) {
    return buildLiveClusterOverviewMarkerHtml(p.count);
  }

  if (!live) {
    return buildOverviewGeoMarkerHtml({ kind: 'live', isLive: true });
  }

  const wave = { from: live.hostUsernameWaveFrom, to: live.hostUsernameWaveTo };

  if (overviewDots) {
    return buildOverviewGeoMarkerHtml({
      kind: 'live',
      isLive: true,
    });
  }

  return buildFlatLiveMarkerHtml(live.hostName, live.hostUsernameColor, wave, {
    viewersCount: live.viewersCount,
    live,
    hostLabelMode: 'hover',
  });
}

export function OnScenGlobeLiveMarkers({
  points,
  overviewDots,
  onPointClick,
}: OnScenGlobeLiveMarkersProps) {
  const livePoints = points
    .filter((p) => LIVE_TYPES.has(p.type))
    .slice(0, MAX_HTML_LIVE_MARKERS);
  if (livePoints.length === 0) return null;

  return (
    <>
      {livePoints.map((p, i) => {
        const live = liveFromGlobePoint(p);
        const hostLabel = live ? liveMapHostLabel(live) : p.label;
        const html = buildGlobeLiveMarkerHtml(p, overviewDots);

        return (
          <GlobeFacingHtml
            key={`live-${p.lat}-${p.lng}-${i}`}
            lat={p.lat}
            lng={p.lng}
            zIndexRange={[10, 0]}
            center
          >
            <button
              type="button"
              className={`globe-live-marker-hit${overviewDots ? '' : ' globe-live-marker-hit--labeled'}`}
              title={hostLabel}
              aria-label={hostLabel}
              onClick={(e) => {
                e.stopPropagation();
                onPointClick(p);
              }}
            >
              <span
                className="globe-live-marker-html"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </button>
          </GlobeFacingHtml>
        );
      })}
    </>
  );
}
