export type LonLatRing = [number, number][];

export type LonLatPolygon = LonLatRing[];

export interface PreparedCountry {
  name: string;
  isoA2?: string;
  polygons: LonLatPolygon[];
  centroid: { lon: number; lat: number };
}
