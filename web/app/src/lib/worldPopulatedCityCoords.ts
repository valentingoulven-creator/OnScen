/** Coords centre-ville — aligné sur commun/backend/src/lib/botPopulatedCities.ts (seeds monde). */
export interface WorldPopulatedCity {
  name: string;
  lat: number;
  lon: number;
}

export const WORLD_POPULATED_CITIES: WorldPopulatedCity[] = [
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Osaka', lat: 34.6937, lon: 135.5023 },
  { name: 'Seoul', lat: 37.5665, lon: 126.978 },
  { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { name: 'Guangzhou', lat: 23.1291, lon: 113.2644 },
  { name: 'Shenzhen', lat: 22.5431, lon: 114.0579 },
  { name: 'Chengdu', lat: 30.5728, lon: 104.0668 },
  { name: 'Chongqing', lat: 29.4316, lon: 106.9123 },
  { name: 'Wuhan', lat: 30.5928, lon: 114.3055 },
  { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { name: 'Taipei', lat: 25.033, lon: 121.5654 },
  { name: 'Nagoya', lat: 35.1815, lon: 136.9066 },
  { name: 'Fukuoka', lat: 33.5904, lon: 130.4017 },
  { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
  { name: 'Lahore', lat: 31.5204, lon: 74.3587 },
  { name: 'Jakarta', lat: -6.2088, lon: 106.8456 },
  { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
  { name: 'Manila', lat: 14.5995, lon: 120.9842 },
  { name: 'Ho Chi Minh City', lat: 10.8231, lon: 106.6297 },
  { name: 'Hanoi', lat: 21.0278, lon: 105.8342 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869 },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
  { name: 'Tehran', lat: 35.6892, lon: 51.389 },
  { name: 'Riyadh', lat: 24.7136, lon: 46.6753 },
  { name: 'Jeddah', lat: 21.4858, lon: 39.1925 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Tel Aviv', lat: 32.0853, lon: 34.7818 },
  { name: 'Baghdad', lat: 33.3152, lon: 44.3661 },
  { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
  { name: 'Saint Petersburg', lat: 59.9311, lon: 30.3609 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Lyon', lat: 45.764, lon: 4.8357 },
  { name: 'Marseille', lat: 43.2965, lon: 5.3698 },
  { name: 'Toulouse', lat: 43.6047, lon: 1.4442 },
  { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
  { name: 'Nice', lat: 43.7102, lon: 7.262 },
  { name: 'Berlin', lat: 52.52, lon: 13.405 },
  { name: 'Munich', lat: 48.1351, lon: 11.582 },
  { name: 'Hamburg', lat: 53.5511, lon: 9.9937 },
  { name: 'Frankfurt', lat: 50.1109, lon: 8.6821 },
  { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
  { name: 'Barcelona', lat: 41.3851, lon: 2.1734 },
  { name: 'Rome', lat: 41.9028, lon: 12.4964 },
  { name: 'Milan', lat: 45.4642, lon: 9.19 },
  { name: 'Naples', lat: 40.8518, lon: 14.2681 },
  { name: 'Amsterdam', lat: 52.3676, lon: 4.9041 },
  { name: 'Brussels', lat: 50.8503, lon: 4.3517 },
  { name: 'Vienna', lat: 48.2082, lon: 16.3738 },
  { name: 'Warsaw', lat: 52.2297, lon: 21.0122 },
  { name: 'Prague', lat: 50.0755, lon: 14.4378 },
  { name: 'Budapest', lat: 47.4979, lon: 19.0402 },
  { name: 'Athens', lat: 37.9838, lon: 23.7275 },
  { name: 'Kyiv', lat: 50.4501, lon: 30.5234 },
  { name: 'Dublin', lat: 53.3498, lon: -6.2603 },
  { name: 'Lisbon', lat: 38.7223, lon: -9.1393 },
  { name: 'Stockholm', lat: 59.3293, lon: 18.0686 },
  { name: 'Copenhagen', lat: 55.6761, lon: 12.5683 },
  { name: 'Oslo', lat: 59.9139, lon: 10.7522 },
  { name: 'Helsinki', lat: 60.1699, lon: 24.9384 },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417 },
  { name: 'Montpellier', lat: 43.6108, lon: 3.8767 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
  { name: 'Dallas', lat: 32.7767, lon: -96.797 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'Atlanta', lat: 33.749, lon: -84.388 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589 },
  { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { name: 'Phoenix', lat: 33.4484, lon: -112.074 },
  { name: 'Philadelphia', lat: 39.9526, lon: -75.1652 },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { name: 'Montreal', lat: 45.5017, lon: -73.5673 },
  { name: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
  { name: 'Guadalajara', lat: 20.6597, lon: -103.3496 },
  { name: 'Monterrey', lat: 25.6866, lon: -100.3161 },
  { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
  { name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729 },
  { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816 },
  { name: 'Lima', lat: -12.0464, lon: -77.0428 },
  { name: 'Bogotá', lat: 4.711, lon: -74.0721 },
  { name: 'Santiago', lat: -33.4489, lon: -70.6693 },
  { name: 'Caracas', lat: 10.4806, lon: -66.9036 },
  { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
  { name: 'Kinshasa', lat: -4.4419, lon: 15.2663 },
  { name: 'Johannesburg', lat: -26.2041, lon: 28.0473 },
  { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219 },
  { name: 'Addis Ababa', lat: 9.032, lon: 38.7469 },
  { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
  { name: 'Accra', lat: 5.6037, lon: -0.187 },
  { name: 'Dakar', lat: 14.7167, lon: -17.4677 },
  { name: 'Algiers', lat: 36.7538, lon: 3.0588 },
  { name: 'Tunis', lat: 36.8065, lon: 10.1815 },
  { name: 'Luanda', lat: -8.839, lon: 13.2894 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
  { name: 'Brisbane', lat: -27.4698, lon: 153.0251 },
  { name: 'Perth', lat: -31.9505, lon: 115.8605 },
  { name: 'Auckland', lat: -36.8485, lon: 174.7633 },
];

const WORLD_CITY_BY_NORMALIZED_NAME = new Map(
  WORLD_POPULATED_CITIES.map((city) => [city.name.trim().toLowerCase(), city] as const)
);

/** Résolution exacte par segment d'adresse (ex. « Music Hall, Kuala Lumpur »). */
export function resolveWorldPopulatedCityCoords(
  location: string
): { latitude: number; longitude: number } | null {
  const loc = location.trim();
  if (!loc) return null;

  const direct = WORLD_CITY_BY_NORMALIZED_NAME.get(loc.toLowerCase());
  if (direct) return { latitude: direct.lat, longitude: direct.lon };

  const parts = loc.split(',').map((part) => part.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const city = WORLD_CITY_BY_NORMALIZED_NAME.get(parts[i]!.toLowerCase());
    if (city) return { latitude: city.lat, longitude: city.lon };
  }

  return null;
}
