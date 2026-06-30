/** Détection Safari / iOS WebKit pour lecture HLS native (Cloudflare live). */

export function canPlayNativeHls(video?: HTMLVideoElement): boolean {
  const el = video ?? (typeof document !== 'undefined' ? document.createElement('video') : null);
  if (!el) return false;
  return el.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/** iPhone / iPod touch Safari. */
export function isIosMobileSafari(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /iPad|iPhone|iPod/.test(ua);
}

/** iPad Safari (y compris iPadOS « desktop » avec touch). */
export function isIpadSafari(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
): boolean {
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/** Safari desktop ou mobile — exclut Chrome/Firefox/Edge iOS wrappers. */
export function isSafariBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/i.test(ua);
}

/** Préférer HLS natif (pas hls.js) — seul cas fiable sur WebKit pour Cloudflare live. */
export function shouldUseNativeHls(
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0
): boolean {
  if (isIosMobileSafari(ua)) return canPlayNativeHls();
  if (isIpadSafari(ua, maxTouchPoints)) return canPlayNativeHls();
  return isSafariBrowser(ua) && canPlayNativeHls();
}
