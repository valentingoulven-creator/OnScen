import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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
 * Override natif de web/app/src/lib/geoPosition.ts (voir ce fichier pour le
 * contexte). Sur Capacitor natif, `navigator.geolocation` (WebView) peut être
 * lent ou peu fiable selon plateforme/version OS — le plugin
 * `@capacitor/geolocation` relaie directement CoreLocation (iOS) /
 * FusedLocationProvider (Android), déjà autorisé via `requestNativePermissions`
 * au boot (nativeBoot.ts). On ne bascule dessus qu'en contexte natif ; le
 * web mobile (PWA /tel/ dans un navigateur, pas Capacitor) garde
 * `navigator.geolocation`.
 */
export async function getCurrentGeoPosition(options?: GeoPositionOptions): Promise<GeoPositionCoords> {
  if (Capacitor.isNativePlatform()) {
    const pos = await Geolocation.getCurrentPosition(options);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  }
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
  if (Capacitor.isNativePlatform()) return true;
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}
