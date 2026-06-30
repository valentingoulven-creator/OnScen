import type { Salon, Live, NearbyPerson, MapEventCityCluster } from '../types';
import type { MapDetailTier } from './mapMarkerVisibility';

/** Stable content key for salon / live / person map layers (globe + flat). */
export function buildSalonLivePeopleKey(
  salons: Salon[],
  lives: Live[],
  people: NearbyPerson[]
): string {
  const s = salons
    .map((x) => `${x.id}:${x.isLive ? 1 : 0}:${x.latitude},${x.longitude}`)
    .join('|');
  const l = lives.map((x) => `${x.id}:${x.latitude},${x.longitude}`).join('|');
  const p = people
    .map((x) => `${x.id}:${x.isLive ? 1 : 0}:${x.latitude},${x.longitude}`)
    .join('|');
  return `${s}#${l}#${p}`;
}

export function buildEventClusterKey(
  clusters: MapEventCityCluster[],
  tier: MapDetailTier
): string {
  const clusterPart = clusters
    .map((c) => `${c.cityKey}:${c.count}:${c.latitude},${c.longitude}`)
    .join('|');
  if (tier === 'overview') return `c:${clusterPart}`;
  const eventPart = clusters
    .flatMap((c) =>
      c.events.map(
        (e) => `${e.id}:${e.eventType ?? 'autre'}:${e.latitude},${e.longitude}`
      )
    )
    .join('|');
  return `s:${clusterPart}#${eventPart}`;
}
