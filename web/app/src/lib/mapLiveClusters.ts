import { isValidLatLng } from './mapCoords';
import type { Live, Salon } from '../types';

/** ~2 km à la latitude de Paris — regroupe les lives trop proches sur le globe. */
export const LIVE_CLUSTER_GRID_DEG = 0.018;

export interface MapLiveLocationCluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  lives: Live[];
  salons: Salon[];
}

function gridKey(lat: number, lng: number): string {
  const g = LIVE_CLUSTER_GRID_DEG;
  return `${Math.round(lat / g)}:${Math.round(lng / g)}`;
}

function clusterCentroid(items: { lat: number; lng: number }[]): { lat: number; lng: number } {
  const sum = items.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / items.length, lng: sum.lng / items.length };
}

/** Regroupe salons live + lives standalone par proximité (vue globe overview). */
export function clusterLiveMapMarkers(
  liveSalons: Salon[],
  lives: Live[],
  linkedSalonIds: Set<string>
): MapLiveLocationCluster[] {
  type Bucket = { salons: Salon[]; lives: Live[]; coords: { lat: number; lng: number }[] };

  const buckets = new Map<string, Bucket>();

  const push = (key: string, lat: number, lng: number, salon?: Salon, live?: Live) => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { salons: [], lives: [], coords: [] };
      buckets.set(key, bucket);
    }
    bucket.coords.push({ lat, lng });
    if (salon) bucket.salons.push(salon);
    if (live) bucket.lives.push(live);
  };

  for (const s of liveSalons) {
    const lat = Number(s.latitude);
    const lng = Number(s.longitude);
    if (!isValidLatLng(lat, lng)) continue;
    push(gridKey(lat, lng), lat, lng, s);
  }

  for (const l of lives) {
    if (linkedSalonIds.has(l.id)) continue;
    const lat = Number(l.latitude);
    const lng = Number(l.longitude);
    if (!isValidLatLng(lat, lng)) continue;
    push(gridKey(lat, lng), lat, lng, undefined, l);
  }

  const clusters: MapLiveLocationCluster[] = [];
  for (const [key, bucket] of buckets) {
    const count = bucket.salons.length + bucket.lives.length;
    if (count === 0) continue;
    const center = clusterCentroid(bucket.coords);
    clusters.push({
      id: key,
      latitude: center.lat,
      longitude: center.lng,
      count,
      salons: bucket.salons,
      lives: bucket.lives,
    });
  }

  return clusters.sort((a, b) => b.count - a.count);
}
