import { BufferAttribute, BufferGeometry } from 'three';
import { lonLatToVector3 } from './geoMath';
import type { PreparedCountry } from './types';

export function buildBordersGeometry(countries: PreparedCountry[], radius: number): BufferGeometry {
  const segments: number[] = [];

  for (const country of countries) {
    for (const polygon of country.polygons) {
      for (const ring of polygon) {
        if (ring.length < 2) continue;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const pa = lonLatToVector3(a[0], a[1], radius);
          const pb = lonLatToVector3(b[0], b[1], radius);
          segments.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(segments), 3));
  return geometry;
}
