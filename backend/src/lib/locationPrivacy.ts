import { User } from '../models/schema';
import { blurCoordinate } from './geo';
import { isValidLatLng, sanitizeLatLng } from './mapCoords';

export type LocationPrecision = 'precise' | 'city';

const CITY_LOOKUP: { match: (c: string) => boolean; lat: number; lon: number }[] = [
  // === France — grandes villes ===
  { match: (c) => c.includes('paris'), lat: 48.8566, lon: 2.3522 },
  { match: (c) => c.includes('lyon'), lat: 45.764, lon: 4.8357 },
  { match: (c) => c.includes('marseille'), lat: 43.2965, lon: 5.3698 },
  { match: (c) => c.includes('toulouse'), lat: 43.6047, lon: 1.4442 },
  { match: (c) => c.includes('nice'), lat: 43.7102, lon: 7.262 },
  { match: (c) => c.includes('nantes'), lat: 47.2184, lon: -1.5536 },
  { match: (c) => c.includes('strasbourg'), lat: 48.5734, lon: 7.7521 },
  { match: (c) => c.includes('montpellier'), lat: 43.6119, lon: 3.8772 },
  { match: (c) => c.includes('bordeaux'), lat: 44.8378, lon: -0.5792 },
  { match: (c) => c.includes('lille'), lat: 50.6292, lon: 3.0573 },
  { match: (c) => c.includes('rennes'), lat: 48.1173, lon: -1.6778 },
  { match: (c) => c.includes('reims'), lat: 49.2583, lon: 4.0317 },
  { match: (c) => c.includes('toulon'), lat: 43.1242, lon: 5.928 },
  { match: (c) => c.includes('saint-étienne') || c.includes('saint etienne'), lat: 45.4397, lon: 4.3872 },
  { match: (c) => c.includes('le havre'), lat: 49.4938, lon: 0.1077 },
  { match: (c) => c.includes('grenoble'), lat: 45.1885, lon: 5.7245 },
  { match: (c) => c.includes('dijon'), lat: 47.322, lon: 5.0415 },
  { match: (c) => c.includes('angers'), lat: 47.4784, lon: -0.5632 },
  { match: (c) => c.includes('nîmes') || c.includes('nimes'), lat: 43.8367, lon: 4.3601 },
  { match: (c) => c.includes('villeurbanne'), lat: 45.7676, lon: 4.8795 },
  { match: (c) => c.includes('le mans'), lat: 48.0061, lon: 0.1996 },
  { match: (c) => c.includes('aix-en-provence') || c.includes('aix en provence'), lat: 43.5297, lon: 5.4474 },
  { match: (c) => c.includes('brest'), lat: 48.3904, lon: -4.4861 },
  { match: (c) => c.includes('amiens'), lat: 49.8941, lon: 2.2958 },
  { match: (c) => c.includes('tours'), lat: 47.3941, lon: 0.6848 },
  { match: (c) => c.includes('limoges'), lat: 45.8354, lon: 1.2644 },
  { match: (c) => c.includes('clermont-ferrand') || c.includes('clermont ferrand'), lat: 45.7797, lon: 3.087 },
  { match: (c) => c.includes('metz'), lat: 49.1193, lon: 6.1727 },
  { match: (c) => c.includes('besançon') || c.includes('besancon'), lat: 47.2378, lon: 6.0241 },
  { match: (c) => c.includes('perpignan'), lat: 42.6987, lon: 2.8956 },
  { match: (c) => c.includes('orléans') || c.includes('orleans'), lat: 47.9029, lon: 1.9087 },
  { match: (c) => c.includes('mulhouse'), lat: 47.7508, lon: 7.3359 },
  { match: (c) => c.includes('rouen'), lat: 49.4432, lon: 1.0993 },
  { match: (c) => c.includes('caen'), lat: 49.1829, lon: -0.3707 },
  { match: (c) => c.includes('nancy'), lat: 48.6921, lon: 6.1844 },
  { match: (c) => c.includes('argenteuil'), lat: 48.9472, lon: 2.2467 },
  { match: (c) => c.includes('montreuil'), lat: 48.8638, lon: 2.4481 },
  { match: (c) => c.includes('roubaix'), lat: 50.6942, lon: 3.1746 },
  { match: (c) => c.includes('tourcoing'), lat: 50.7239, lon: 3.1612 },
  { match: (c) => c.includes('dunkerque') || c.includes('dunkirk'), lat: 51.0344, lon: 2.3768 },
  { match: (c) => c.includes('avignon'), lat: 43.9493, lon: 4.8055 },
  { match: (c) => c.includes('poitiers'), lat: 46.58, lon: 0.3404 },
  { match: (c) => c.includes('versailles'), lat: 48.8014, lon: 2.1301 },
  { match: (c) => c.includes('nanterre'), lat: 48.8924, lon: 2.2072 },
  { match: (c) => c.includes('créteil') || c.includes('creteil'), lat: 48.7905, lon: 2.4574 },
  { match: (c) => c.includes('pau'), lat: 43.2951, lon: -0.3708 },
  { match: (c) => c.includes('vitry-sur-seine') || c.includes('vitry sur seine'), lat: 48.7875, lon: 2.3929 },
  { match: (c) => c.includes('colombes'), lat: 48.9231, lon: 2.2534 },
  { match: (c) => c.includes('asnières') || c.includes('asnieres'), lat: 48.9126, lon: 2.2867 },
  { match: (c) => c.includes('courbevoie'), lat: 48.8977, lon: 2.2536 },
  { match: (c) => c.includes('mérignac') || c.includes('merignac'), lat: 44.8384, lon: -0.6436 },
  { match: (c) => c.includes('aubervilliers'), lat: 48.9139, lon: 2.3823 },
  { match: (c) => c.includes('cannes'), lat: 43.5528, lon: 7.0174 },
  { match: (c) => c.includes('antibes'), lat: 43.5808, lon: 7.128 },
  { match: (c) => c.includes('saint-nazaire') || c.includes('saint nazaire'), lat: 47.2736, lon: -2.2138 },
  { match: (c) => c.includes('calais'), lat: 50.9513, lon: 1.8587 },
  { match: (c) => c.includes('lorient'), lat: 47.7482, lon: -3.3702 },
  { match: (c) => c.includes('chambéry') || c.includes('chambery'), lat: 45.5646, lon: 5.9178 },
  { match: (c) => c.includes('quimper'), lat: 48.0, lon: -4.1 },
  { match: (c) => c.includes('troyes'), lat: 48.2973, lon: 4.0744 },
  { match: (c) => c.includes('la rochelle'), lat: 46.16, lon: -1.1526 },
  { match: (c) => c.includes('angoulême') || c.includes('angouleme'), lat: 45.6497, lon: 0.1561 },
  { match: (c) => c.includes('bayonne'), lat: 43.4929, lon: -1.4748 },
  { match: (c) => c.includes('colmar'), lat: 48.0793, lon: 7.3585 },
  { match: (c) => c.includes('thionville'), lat: 49.3589, lon: 6.1685 },
  { match: (c) => c.includes('vannes'), lat: 47.6587, lon: -2.7608 },
  { match: (c) => c.includes('laval'), lat: 48.0733, lon: -0.7676 },
  { match: (c) => c.includes('boulogne-billancourt') || c.includes('boulogne billancourt'), lat: 48.8352, lon: 2.2409 },
  { match: (c) => c.includes('issy-les-moulineaux') || c.includes('issy les moulineaux'), lat: 48.8234, lon: 2.2742 },
  { match: (c) => c.includes('saint-quentin') || c.includes('saint quentin'), lat: 49.8486, lon: 3.2877 },
  { match: (c) => c.includes('évreux') || c.includes('evreux'), lat: 49.0238, lon: 1.1521 },
  { match: (c) => c.includes('cherbourg'), lat: 49.6439, lon: -1.4148 },
  { match: (c) => c.includes('ajaccio'), lat: 41.9192, lon: 8.7386 },
  { match: (c) => c.includes('bastia'), lat: 42.6976, lon: 9.4506 },
  { match: (c) => c.includes('cayenne'), lat: 4.9224, lon: -52.3135 },
  { match: (c) => c.includes('fort-de-france') || c.includes('fort de france'), lat: 14.6037, lon: -61.0733 },
  { match: (c) => c.includes('pointe-à-pitre') || c.includes('pointe a pitre'), lat: 16.2418, lon: -61.5329 },
  { match: (c) => c.includes('valence') && !c.includes('valencia'), lat: 44.9334, lon: 4.8924 },
  { match: (c) => c.includes('bourges'), lat: 47.0811, lon: 2.3988 },
  { match: (c) => c.includes('maubeuge'), lat: 50.2774, lon: 3.9742 },
  { match: (c) => c.includes('aulnay-sous-bois') || c.includes('aulnay sous bois'), lat: 48.9397, lon: 2.4978 },
  { match: (c) => c.includes('champigny') && c.includes('marne'), lat: 48.8155, lon: 2.5155 },
  { match: (c) => c.includes('saint-maur') || c.includes('saint maur'), lat: 48.7966, lon: 2.4988 },
  { match: (c) => c.includes('drancy'), lat: 48.9314, lon: 2.4494 },
  { match: (c) => c.includes('issy'), lat: 48.8234, lon: 2.2742 },
  { match: (c) => c.includes('noisy-le-grand') || c.includes('noisy le grand'), lat: 48.8472, lon: 2.5519 },

  // === Capitales et grandes villes européennes ===
  { match: (c) => c.includes('london') || c.includes('londres'), lat: 51.5074, lon: -0.1278 },
  { match: (c) => c.includes('berlin'), lat: 52.52, lon: 13.405 },
  { match: (c) => c.includes('madrid'), lat: 40.4168, lon: -3.7038 },
  { match: (c) => c.includes('rome') || c.includes('roma'), lat: 41.9028, lon: 12.4964 },
  { match: (c) => c.includes('amsterdam'), lat: 52.3676, lon: 4.9041 },
  { match: (c) => c.includes('bruxelles') || c.includes('brussels') || c.includes('brussel'), lat: 50.8503, lon: 4.3517 },
  { match: (c) => c.includes('vienne') || (c.includes('vienna') && !c.includes('vienne-en')), lat: 48.2082, lon: 16.3738 },
  { match: (c) => c.includes('varsovie') || c.includes('warsaw') || c.includes('warszawa'), lat: 52.2297, lon: 21.0122 },
  { match: (c) => c.includes('budapest'), lat: 47.4979, lon: 19.0402 },
  { match: (c) => c.includes('bucarest') || c.includes('bucharest'), lat: 44.4268, lon: 26.1025 },
  { match: (c) => c.includes('stockholm'), lat: 59.3293, lon: 18.0686 },
  { match: (c) => c.includes('copenhague') || c.includes('copenhagen'), lat: 55.6761, lon: 12.5683 },
  { match: (c) => c.includes('helsinki'), lat: 60.1699, lon: 24.9384 },
  { match: (c) => c.includes('oslo'), lat: 59.9139, lon: 10.7522 },
  { match: (c) => c.includes('lisbonne') || c.includes('lisbon') || c.includes('lisboa'), lat: 38.7169, lon: -9.1395 },
  { match: (c) => c.includes('athènes') || c.includes('athens'), lat: 37.9838, lon: 23.7275 },
  { match: (c) => c.includes('prague') || c.includes('praha'), lat: 50.0755, lon: 14.4378 },
  { match: (c) => c.includes('bratislava'), lat: 48.1486, lon: 17.1077 },
  { match: (c) => c.includes('zagreb'), lat: 45.815, lon: 15.9819 },
  { match: (c) => c.includes('belgrade') || c.includes('beograd'), lat: 44.7866, lon: 20.4489 },
  { match: (c) => c.includes('sofia'), lat: 42.6977, lon: 23.3219 },
  { match: (c) => c.includes('luxembourg'), lat: 49.6116, lon: 6.1319 },
  { match: (c) => c.includes('dublin'), lat: 53.3498, lon: -6.2603 },
  { match: (c) => c.includes('reykjavik') || c.includes('reykjavík'), lat: 64.1355, lon: -21.8954 },
  { match: (c) => c.includes('tallinn'), lat: 59.437, lon: 24.7536 },
  { match: (c) => c.includes('riga'), lat: 56.9496, lon: 24.1052 },
  { match: (c) => c.includes('vilnius'), lat: 54.6872, lon: 25.2797 },
  { match: (c) => c.includes('kyiv') || c.includes('kiev'), lat: 50.4501, lon: 30.5234 },
  { match: (c) => c.includes('berne') || c.includes('bern'), lat: 46.9481, lon: 7.4474 },
  { match: (c) => c.includes('zürich') || c.includes('zurich'), lat: 47.3769, lon: 8.5417 },
  { match: (c) => c.includes('genève') || c.includes('geneva') || c.includes('genf'), lat: 46.2044, lon: 6.1432 },
  { match: (c) => c.includes('barcelone') || c.includes('barcelona'), lat: 41.3851, lon: 2.1734 },
  { match: (c) => c.includes('munich') || c.includes('münchen'), lat: 48.1351, lon: 11.582 },
  { match: (c) => c.includes('hambourg') || c.includes('hamburg'), lat: 53.5753, lon: 10.0153 },
  { match: (c) => c.includes('cologne') || c.includes('köln') || c.includes('koeln'), lat: 50.9333, lon: 6.95 },
  { match: (c) => c.includes('milan') || c.includes('milano'), lat: 45.4654, lon: 9.1859 },
  { match: (c) => c.includes('naples') || c.includes('napoli'), lat: 40.8518, lon: 14.2681 },
  { match: (c) => c.includes('turin') || c.includes('torino'), lat: 45.0703, lon: 7.6869 },
  { match: (c) => c.includes('séville') || c.includes('sevilla') || c.includes('seville'), lat: 37.3891, lon: -5.9845 },
  { match: (c) => c.includes('valence') && c.includes('espagne'), lat: 39.4699, lon: -0.3763 },
  { match: (c) => c.includes('valencia') && !c.includes('france'), lat: 39.4699, lon: -0.3763 },
  { match: (c) => c.includes('varsovie') || c.includes('krakow') || c.includes('cracovie'), lat: 50.0647, lon: 19.945 },
  { match: (c) => c.includes('edinburgh') || c.includes('édimbourg'), lat: 55.9533, lon: -3.1883 },
  { match: (c) => c.includes('manchester'), lat: 53.4808, lon: -2.2426 },
  { match: (c) => c.includes('birmingham'), lat: 52.4862, lon: -1.8904 },
  { match: (c) => c.includes('rotterdam'), lat: 51.9225, lon: 4.4792 },
  { match: (c) => c.includes('antwerp') || c.includes('anvers'), lat: 51.2194, lon: 4.4025 },
  { match: (c) => c.includes('göteborg') || c.includes('gothenburg'), lat: 57.7089, lon: 11.9746 },
  { match: (c) => c.includes('malmo') || c.includes('malmö'), lat: 55.604, lon: 13.0038 },
  { match: (c) => c.includes('bâle') || c.includes('basel') || c.includes('basle'), lat: 47.5596, lon: 7.5886 },
  { match: (c) => c.includes('moscou') || c.includes('moscow') || c.includes('moskva'), lat: 55.7558, lon: 37.6176 },
  { match: (c) => c.includes('saint-pétersbourg') || c.includes('saint petersbourg') || c.includes('st petersburg'), lat: 59.9343, lon: 30.3351 },
  { match: (c) => c.includes('istanbul'), lat: 41.0082, lon: 28.9784 },
  { match: (c) => c.includes('ankara'), lat: 39.9334, lon: 32.8597 },

  // === Reste du monde ===
  { match: (c) => c.includes('montreal') || c.includes('montréal'), lat: 45.5017, lon: -73.5673 },
  { match: (c) => c.includes('toronto'), lat: 43.6532, lon: -79.3832 },
  { match: (c) => c.includes('vancouver'), lat: 49.2827, lon: -123.1207 },
  { match: (c) => c.includes('new york') || c.includes('nyc'), lat: 40.7128, lon: -74.006 },
  { match: (c) => c.includes('los angeles'), lat: 34.0522, lon: -118.2437 },
  { match: (c) => c.includes('chicago'), lat: 41.8781, lon: -87.6298 },
  { match: (c) => c.includes('miami'), lat: 25.7617, lon: -80.1918 },
  { match: (c) => c.includes('tokyo'), lat: 35.6762, lon: 139.6503 },
  { match: (c) => c.includes('seoul') || c.includes('séoul'), lat: 37.5665, lon: 126.978 },
  { match: (c) => c.includes('sydney'), lat: -33.8688, lon: 151.2093 },
  { match: (c) => c.includes('dubai') || c.includes('dubaï'), lat: 25.2048, lon: 55.2708 },
  { match: (c) => c.includes('mumbai'), lat: 19.076, lon: 72.8777 },
  { match: (c) => c.includes('são paulo') || c.includes('sao paulo'), lat: -23.5505, lon: -46.6333 },
  { match: (c) => c.includes('beijing') || c.includes('pékin') || c.includes('pekin'), lat: 39.9042, lon: 116.4074 },
  { match: (c) => c.includes('shanghai') || c.includes('shanghaï'), lat: 31.2304, lon: 121.4737 },
  { match: (c) => c.includes('singapore') || c.includes('singapour'), lat: 1.3521, lon: 103.8198 },
  { match: (c) => c.includes('mexico'), lat: 19.4326, lon: -99.1332 },
  { match: (c) => c.includes('buenos aires'), lat: -34.6037, lon: -58.3816 },
  { match: (c) => c.includes('cape town') || c.includes('le cap'), lat: -33.9249, lon: 18.4241 },
  { match: (c) => c.includes('johannesburg'), lat: -26.2041, lon: 28.0473 },
  { match: (c) => c.includes('nairobi'), lat: -1.2921, lon: 36.8219 },
  { match: (c) => c.includes('casablanca'), lat: 33.5731, lon: -7.5898 },
  { match: (c) => c.includes('alger') || c.includes('algiers'), lat: 36.7538, lon: 3.0588 },
  { match: (c) => c.includes('tunis'), lat: 36.8065, lon: 10.1815 },
  { match: (c) => c.includes('abidjan'), lat: 5.3599, lon: -4.0082 },
  { match: (c) => c.includes('dakar'), lat: 14.6928, lon: -17.4467 },
  { match: (c) => c.includes('bangkok'), lat: 13.7563, lon: 100.5018 },
  { match: (c) => c.includes('hong kong'), lat: 22.3193, lon: 114.1694 },
  { match: (c) => c.includes('jakarta'), lat: -6.2088, lon: 106.8456 },
  { match: (c) => c.includes('karachi'), lat: 24.8607, lon: 67.0011 },
  { match: (c) => c.includes('delhi') || c.includes('new delhi'), lat: 28.6139, lon: 77.209 },
  { match: (c) => c.includes('melbourne'), lat: -37.8136, lon: 144.9631 },
  { match: (c) => c.includes('rio de janeiro') || c.includes('rio'), lat: -22.9068, lon: -43.1729 },
];

/** Cache mémoire des coordonnées résolues via Nominatim pour les villes inconnues. */
const nominatimCityCache = new Map<string, [number, number]>();
const nominatimPending = new Set<string>();

async function fetchCityFromNominatim(normalized: string): Promise<void> {
  if (nominatimCityCache.has(normalized) || nominatimPending.has(normalized)) return;
  nominatimPending.add(normalized);
  try {
    const params = new URLSearchParams({ city: normalized, format: 'json', limit: '1' });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { 'User-Agent': 'Soundy/1.0 (https://getsoundy.com; contact@getsoundy.com)' } }
    );
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat ?? '');
      const lon = parseFloat(data[0].lon ?? '');
      if (isFinite(lat) && isFinite(lon)) {
        nominatimCityCache.set(normalized, [lat, lon]);
      }
    }
  } catch {
    // ignore network errors — fallback reste Paris
  } finally {
    nominatimPending.delete(normalized);
  }
}

export function userSharesDistance(user: User): boolean {
  return user.shareDistance !== false;
}

export function userCityOnlyLocation(user: User): boolean {
  return user.locationPrecision === 'city';
}

/** Position GPS live (POST /geo/update), pas un backfill ville seul. */
export function userHasLiveGeo(user: User): boolean {
  return typeof user.geoUpdatedAt === 'number' && user.geoUpdatedAt > 0;
}

export function resolveCityCoordinates(city: string): [number, number] {
  const normalized = city.trim().toLowerCase();

  // 1. Lookup statique
  for (const entry of CITY_LOOKUP) {
    if (entry.match(normalized)) return [entry.lat, entry.lon];
  }

  // 2. Cache Nominatim (rempli en arrière-plan lors d'une requête précédente)
  const cached = nominatimCityCache.get(normalized);
  if (cached) return cached;

  // 3. Déclencher une récupération en arrière-plan pour les prochains appels
  void fetchCityFromNominatim(normalized);

  // 4. Fallback : Paris
  return [48.8566, 2.3522];
}

/** Met à jour blurredLatitude/blurredLongitude selon les préférences de confidentialité. */
export function refreshUserPublicCoords(user: User): void {
  if (user.latitude == null || user.longitude == null) return;
  if (userCityOnlyLocation(user) && !userHasLiveGeo(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    user.blurredLatitude = lat;
    user.blurredLongitude = lon;
    return;
  }
  user.blurredLatitude = blurCoordinate(user.latitude);
  user.blurredLongitude = blurCoordinate(user.longitude);
}

export function getPublicMapCoords(
  user: User,
  preciseLat: number,
  preciseLon: number,
  blurredLat: number,
  blurredLon: number,
  viewerId?: string
): { latitude: number; longitude: number } {
  const precise = sanitizeLatLng(preciseLat, preciseLon);
  const blurred = sanitizeLatLng(blurredLat, blurredLon, precise);
  if (viewerId === user.id) {
    return precise;
  }
  if (userCityOnlyLocation(user) && !userHasLiveGeo(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    return { latitude: lat, longitude: lon };
  }
  return blurred;
}

export function getUserPublicCoords(user: User, viewerId?: string): { lat: number; lon: number } | null {
  if (user.latitude == null || user.longitude == null) return null;
  if (!isValidLatLng(user.latitude, user.longitude)) return null;
  if (viewerId === user.id) {
    return { lat: user.latitude, lon: user.longitude };
  }
  // Ville profil uniquement si pas de GPS live (confidentialité « ville seule »).
  if (userCityOnlyLocation(user) && !userHasLiveGeo(user)) {
    const [lat, lon] = resolveCityCoordinates(user.city || 'Paris');
    return { lat, lon };
  }
  if (!isValidLatLng(user.blurredLatitude, user.blurredLongitude)) {
    refreshUserPublicCoords(user);
  }
  if (isValidLatLng(user.blurredLatitude, user.blurredLongitude)) {
    return { lat: user.blurredLatitude!, lon: user.blurredLongitude! };
  }
  return null;
}

export function applyPrivacySettings(
  user: User,
  body: { shareDistance?: boolean; locationPrecision?: string }
): void {
  if (body.shareDistance !== undefined) {
    user.shareDistance = Boolean(body.shareDistance);
  }
  if (body.locationPrecision === 'precise' || body.locationPrecision === 'city') {
    user.locationPrecision = body.locationPrecision;
  }
  refreshUserPublicCoords(user);
}
