export interface PresetCity {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface LivesGeoPrefs {
  latitude: number;
  longitude: number;
  radiusKm: number;
  label: string;
  source: 'my_position' | 'city';
}

const STORAGE_KEY = 'melosong_lives_geo';
const DEFAULT_RADIUS = 15;

export const MAP_GEO_CHANGED_EVENT = 'melosong-map-geo-changed';

export const PRESET_CITIES: PresetCity[] = [
  { id: 'paris', label: 'Paris, France', latitude: 48.8566, longitude: 2.3522 },
  { id: 'lyon', label: 'Lyon, France', latitude: 45.764, longitude: 4.8357 },
  { id: 'marseille', label: 'Marseille, France', latitude: 43.2965, longitude: 5.3698 },
  { id: 'london', label: 'London, UK', latitude: 51.5074, longitude: -0.1278 },
  { id: 'berlin', label: 'Berlin, Germany', latitude: 52.52, longitude: 13.405 },
  { id: 'madrid', label: 'Madrid, Spain', latitude: 40.4168, longitude: -3.7038 },
  { id: 'rome', label: 'Rome, Italy', latitude: 41.9028, longitude: 12.4964 },
  { id: 'amsterdam', label: 'Amsterdam, Netherlands', latitude: 52.3676, longitude: 4.9041 },
  { id: 'brussels', label: 'Brussels, Belgium', latitude: 50.8503, longitude: 4.3517 },
  { id: 'nyc', label: 'New York, USA', latitude: 40.7128, longitude: -74.006 },
  { id: 'la', label: 'Los Angeles, USA', latitude: 34.0522, longitude: -118.2437 },
  { id: 'montreal', label: 'Montréal, Canada', latitude: 45.5017, longitude: -73.5673 },
  { id: 'tokyo', label: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: 'seoul', label: 'Seoul, South Korea', latitude: 37.5665, longitude: 126.978 },
  { id: 'sydney', label: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093 },
  { id: 'dubai', label: 'Dubai, UAE', latitude: 25.2048, longitude: 55.2708 },
  { id: 'mumbai', label: 'Mumbai, India', latitude: 19.076, longitude: 72.8777 },
  { id: 'sao-paulo', label: 'São Paulo, Brazil', latitude: -23.5505, longitude: -46.6333 },
];

const DEFAULT_PREFS: LivesGeoPrefs = {
  latitude: PRESET_CITIES[0].latitude,
  longitude: PRESET_CITIES[0].longitude,
  radiusKm: DEFAULT_RADIUS,
  label: PRESET_CITIES[0].label,
  source: 'city',
};

export function getLivesGeo(): LivesGeoPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<LivesGeoPrefs>;
    const radiusKm = Number(parsed.radiusKm);
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { ...DEFAULT_PREFS };
    return {
      latitude,
      longitude,
      radiusKm: Number.isFinite(radiusKm)
        ? Math.min(50, Math.max(5, Math.round(radiusKm)))
        : DEFAULT_RADIUS,
      label: typeof parsed.label === 'string' ? parsed.label : DEFAULT_PREFS.label,
      source: parsed.source === 'my_position' ? 'my_position' : 'city',
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setLivesGeo(prefs: LivesGeoPrefs): void {
  const v: LivesGeoPrefs = {
    latitude: prefs.latitude,
    longitude: prefs.longitude,
    radiusKm: Math.min(50, Math.max(5, Math.round(prefs.radiusKm))),
    label: prefs.label,
    source: prefs.source,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(MAP_GEO_CHANGED_EVENT));
}

/** Coordonnées pour une ville saisie (preset ou estimation stable). */
export function coordsForCityName(cityName: string): { latitude: number; longitude: number; label: string } {
  const q = cityName.trim().toLowerCase();
  if (!q) return { ...DEFAULT_PREFS, label: DEFAULT_PREFS.label };
  const preset = PRESET_CITIES.find((c) => {
    const main = c.label.split(',')[0].trim().toLowerCase();
    return (
      c.label.toLowerCase() === q ||
      main === q ||
      c.label.toLowerCase().includes(q) ||
      c.id.replace(/-/g, ' ') === q
    );
  });
  if (preset) {
    return { latitude: preset.latitude, longitude: preset.longitude, label: preset.label };
  }
  let hash = 0;
  for (let i = 0; i < q.length; i++) hash = (hash * 31 + q.charCodeAt(i)) | 0;
  const latitude = 48.8566 + ((hash % 1000) / 1000 - 0.5) * 0.08;
  const longitude = 2.3522 + (((hash >> 10) % 1000) / 1000 - 0.5) * 0.12;
  const label = cityName.trim();
  return { latitude, longitude, label };
}
