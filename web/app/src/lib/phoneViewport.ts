import { isNativeApp } from './nativePlatform';

const PHONE_MAX_MQ = '(max-width: 430px)';
const TABLET_TOUCH_MQ = '(max-width: 767px) and (pointer: coarse)';
const COMPACT_MAP_MQ = '(max-width: 639px)';

/** Mobile browser (onscen.com) — not Capacitor native (apptel). */
export function isPhoneWebViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isNativeApp()) return false;
  try {
    return (
      window.matchMedia(PHONE_MAX_MQ).matches ||
      window.matchMedia(TABLET_TOUCH_MQ).matches
    );
  } catch {
    return window.innerWidth <= 430;
  }
}

/** Touch-first device (phone Safari, Android browser, coarse pointer). */
export function isTouchCoarseViewport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    );
  } catch {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }
}

/** Bottom map panel + side list hidden (phone / narrow). */
export function isCompactMapViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isPhoneWebViewport()) return true;
  try {
    return window.matchMedia(COMPACT_MAP_MQ).matches;
  } catch {
    return window.innerWidth <= 639;
  }
}

export function syncPhoneWebViewportClass(): boolean {
  const active = isPhoneWebViewport();
  const root = document.documentElement;
  if (active) root.setAttribute('data-phone-viewport', '1');
  else root.removeAttribute('data-phone-viewport');
  return active;
}

export function subscribePhoneWebViewport(onChange: (active: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mqs = [
    window.matchMedia(PHONE_MAX_MQ),
    window.matchMedia(TABLET_TOUCH_MQ),
  ];
  const sync = () => onChange(isPhoneWebViewport());
  sync();
  mqs.forEach((mq) => mq.addEventListener('change', sync));
  window.addEventListener('orientationchange', sync);
  return () => {
    mqs.forEach((mq) => mq.removeEventListener('change', sync));
    window.removeEventListener('orientationchange', sync);
  };
}

export function subscribeCompactMapViewport(onChange: (active: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mqs = [
    window.matchMedia(PHONE_MAX_MQ),
    window.matchMedia(TABLET_TOUCH_MQ),
    window.matchMedia(COMPACT_MAP_MQ),
  ];
  const sync = () => onChange(isCompactMapViewport());
  sync();
  mqs.forEach((mq) => mq.addEventListener('change', sync));
  window.addEventListener('orientationchange', sync);
  return () => {
    mqs.forEach((mq) => mq.removeEventListener('change', sync));
    window.removeEventListener('orientationchange', sync);
  };
}
