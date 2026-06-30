import { request } from './core';

export interface MajorCityDto {
  id: string;
  name: string;
  countryCode: string;
  label: string;
  latitude: number;
  longitude: number;
  postalCode?: string | null;
  distanceKm: number;
}

export const geoApi = {
  updateGeo: (token: string, latitude: number, longitude: number) =>
    request<{ blurredLatitude: number; blurredLongitude: number }>(
      '/geo/update',
      { method: 'POST', body: JSON.stringify({ latitude, longitude }) },
      token
    ),

  nearby: (
    token: string,
    lat: number,
    lon: number,
    opts?: {
      radiusKm?: number;
      distanceFilter?: boolean;
      bounds?: { swLat: number; swLng: number; neLat: number; neLng: number };
    }
  ) => {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
    });
    if (opts?.radiusKm !== undefined) params.set('radius', String(opts.radiusKm));
    if (opts?.distanceFilter === false) params.set('distanceFilter', 'false');
    else if (opts?.distanceFilter === true) params.set('distanceFilter', 'true');
    if (opts?.bounds) {
      params.set('swLat', String(opts.bounds.swLat));
      params.set('swLng', String(opts.bounds.swLng));
      params.set('neLat', String(opts.bounds.neLat));
      params.set('neLng', String(opts.bounds.neLng));
    }
    return request<{
      salons: import('../../types').Salon[];
      lives: import('../../types').Live[];
      people: import('../../types').NearbyPerson[];
    }>(`/geo/nearby?${params}`, {}, token);
  },

  nearestMajorCities: (latitude: number, longitude: number, limit = 3, token?: string | null) => {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      limit: String(limit),
    });
    return request<{ cities: MajorCityDto[] }>(`/geo/major-cities/nearest?${params}`, {}, token);
  },
} as const;
