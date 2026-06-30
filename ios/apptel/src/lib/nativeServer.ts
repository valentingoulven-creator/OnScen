/**
 * URL du backend msdev pour l'app native Capacitor.
 * En PWA / navigateur : chemins relatifs (/api, socket sur la même origine).
 * En APK / IPA : VITE_API_URL et VITE_SOCKET_URL injectés au build depuis commun/msdev/.env.
 */

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const viteApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const viteSocket = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

/** Base API — ex. /api ou http://192.168.1.41:4080/api */
export const API_BASE: string = viteApi ? trimTrailingSlash(viteApi) : '/api';

/** Origine Socket.IO — vide = même origine que la page */
export const SOCKET_ORIGIN: string = viteSocket ? trimTrailingSlash(viteSocket) : '';

export const IS_NATIVE_BUILD = Boolean(viteApi || viteSocket);
