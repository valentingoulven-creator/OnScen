import { BufferAttribute, BufferGeometry, Path, Shape, ShapeGeometry, Vector2 } from 'three';
import { lonLatToVector3 } from './geoMath';
import { unwrapRingLongitudes } from './pointInPolygon';
import type { LonLatPolygon, LonLatRing, PreparedCountry } from '../types';

/**
 * Construit UNE géométrie de segments regroupant TOUTES les frontières de tous les
 * pays (un seul draw call pour ~180 pays) — les coordonnées brutes suffisent ici :
 * chaque segment est calculé indépendamment, la formule sphérique gère nativement
 * le passage de longitude (pas besoin de "déplier" pour un simple tracé de trait).
 */
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

/** Aligne un anneau (continuité interne + décalage global) sur la longitude de référence donnée. */
function alignRingNear(ring: LonLatRing, referenceLon: number): LonLatRing {
  const unwrapped = unwrapRingLongitudes(ring);
  const shift = Math.round((referenceLon - unwrapped[0][0]) / 360) * 360;
  if (shift === 0) return unwrapped;
  return unwrapped.map(([lon, lat]) => [lon + shift, lat]);
}

/** Fusionne plusieurs géométries indexées en une seule (évite une dépendance à BufferGeometryUtils). */
function mergeIndexedGeometries(geometries: BufferGeometry[]): BufferGeometry | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.getAttribute('position').count;
    totalIndices += g.getIndex()?.count ?? 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const g of geometries) {
    const pos = g.getAttribute('position') as BufferAttribute;
    positions.set(pos.array as Float32Array, vertexOffset * 3);
    const idx = g.getIndex();
    if (idx) {
      for (let k = 0; k < idx.count; k++) {
        indices[indexOffset + k] = idx.getX(k) + vertexOffset;
      }
      indexOffset += idx.count;
    }
    vertexOffset += pos.count;
  }

  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(positions, 3));
  merged.setIndex(new BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}

/**
 * Construit la géométrie "remplissage" d'un pays (surbrillance survol/sélection) :
 * triangulation à plat (longitude, latitude) via `THREE.ShapeGeometry` (gère nativement
 * les trous — enclaves comme le Lesotho), puis chaque sommet est reprojeté sur la
 * sphère. Gère les multi-polygones (archipels) en fusionnant les parties.
 *
 * Retourne `null` si la géométrie du pays est vide ou trop dégénérée pour être triangulée.
 */
export function buildCountryFillGeometry(
  polygons: LonLatPolygon[],
  radius: number
): BufferGeometry | null {
  const parts: BufferGeometry[] = [];

  for (const polygon of polygons) {
    const [exterior, ...holes] = polygon;
    if (!exterior || exterior.length < 3) continue;

    try {
      const alignedExterior = alignRingNear(exterior, exterior[0][0]);
      const refLon = alignedExterior[0][0];

      const shape = new Shape(alignedExterior.map(([lon, lat]) => new Vector2(lon, lat)));
      for (const hole of holes) {
        if (hole.length < 3) continue;
        const alignedHole = alignRingNear(hole, refLon);
        shape.holes.push(new Path(alignedHole.map(([lon, lat]) => new Vector2(lon, lat))));
      }

      const flat = new ShapeGeometry(shape);
      const flatPos = flat.getAttribute('position') as BufferAttribute;
      const spherePositions = new Float32Array(flatPos.count * 3);

      for (let i = 0; i < flatPos.count; i++) {
        const lon = flatPos.getX(i);
        const lat = flatPos.getY(i);
        const p = lonLatToVector3(lon, lat, radius);
        spherePositions[i * 3] = p.x;
        spherePositions[i * 3 + 1] = p.y;
        spherePositions[i * 3 + 2] = p.z;
      }

      const sphereGeom = new BufferGeometry();
      sphereGeom.setAttribute('position', new BufferAttribute(spherePositions, 3));
      if (flat.getIndex()) sphereGeom.setIndex(flat.getIndex());
      sphereGeom.computeVertexNormals();
      parts.push(sphereGeom);
      flat.dispose();
    } catch (err) {
      // Une géométrie source malformée ne doit jamais casser tout le globe.
      console.warn('[countryGeometry] Triangulation ignorée pour un polygone :', err);
    }
  }

  return mergeIndexedGeometries(parts);
}
