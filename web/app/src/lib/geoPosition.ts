export interface GeoPositionCoords {
  latitude: number;
  longitude: number;
}

export interface GeoPositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Récupère la position GPS courante. Implémentation par défaut (web/PWA) :
 * `navigator.geolocation`. Surchargée par `ios/apptel/src/lib/geoPosition.ts`
 * sur les builds Capacitor natifs, où `navigator.geolocation` (WebView) est
 * moins fiable que le plugin natif `@capacitor/geolocation` (relais direct
 * CoreLocation/FusedLocationProvider) — voir ce fichier pour le détail.
 */
export function getCurrentGeoPosition(options?: GeoPositionOptions): Promise<GeoPositionCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation-unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      options
    );
  });
}

export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}
