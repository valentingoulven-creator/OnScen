import { getProfilePath } from './profileDeepLink';
import { getSalonPath } from './salonDeepLink';

let cachedMsdevShareOrigin: string | null = null;

/** Origin for share links: current page, LAN URL on msdev localhost, or VITE_WEB_APP_URL. */
export async function resolveShareOrigin(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const { hostname, origin } = window.location;
  const trimmedOrigin = origin.replace(/\/$/, '');

  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return trimmedOrigin;
  }

  if (cachedMsdevShareOrigin) return cachedMsdevShareOrigin;

  const envUrl = import.meta.env.VITE_WEB_APP_URL as string | undefined;
  if (envUrl?.trim()) {
    cachedMsdevShareOrigin = envUrl.trim().replace(/\/$/, '');
    return cachedMsdevShareOrigin;
  }

  try {
    const res = await fetch('/api/network/info');
    if (res.ok) {
      const info = (await res.json()) as { smartphonePrimary?: string };
      if (info.smartphonePrimary?.trim()) {
        cachedMsdevShareOrigin = info.smartphonePrimary.trim().replace(/\/$/, '');
        return cachedMsdevShareOrigin;
      }
    }
  } catch {
    /* ignore */
  }

  return trimmedOrigin;
}

export async function getSalonShareUrl(salonId: string): Promise<string> {
  const base = await resolveShareOrigin();
  return `${base}${getSalonPath(salonId)}`;
}

export async function getProfileShareUrl(userId: string): Promise<string> {
  const base = await resolveShareOrigin();
  return `${base}${getProfilePath(userId)}`;
}

/** Public URL for sharing the Soundly app (origin from config / LAN on msdev). */
export async function getAppShareUrl(): Promise<string> {
  return resolveShareOrigin();
}

export function buildSalonShareUrl(salonId: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}${getSalonPath(salonId)}`;
}

export async function copyShareLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShareLink(opts: {
  url: string;
  title?: string;
  text?: string;
}): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (!navigator.share) return 'unavailable';
  try {
    await navigator.share({
      title: opts.title,
      text: opts.text,
      url: opts.url,
    });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}

export function openEmailShare(url: string, subject?: string, intro?: string): void {
  const body = intro ? `${intro}\n\n${url}` : url;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject ?? '')}&body=${encodeURIComponent(body)}`;
}

export function openWhatsAppShare(url: string, text?: string): void {
  const message = text ? `${text}\n${url}` : url;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

export function openSmsShare(url: string, text?: string): void {
  const body = text ? `${text}\n${url}` : url;
  window.location.href = `sms:?body=${encodeURIComponent(body)}`;
}

export function openTwitterShare(url: string, text?: string): void {
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  params.set('url', url);
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;

export function openMessengerShare(url: string): void {
  const encoded = encodeURIComponent(url);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.open(`fb-messenger://share?link=${encoded}`, '_blank', 'noopener,noreferrer');
    return;
  }

  if (FB_APP_ID) {
    window.open(
      `https://www.facebook.com/dialog/send?link=${encoded}&app_id=${encodeURIComponent(FB_APP_ID)}&redirect_uri=${encoded}`,
      '_blank',
      'noopener,noreferrer'
    );
    return;
  }

  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    '_blank',
    'noopener,noreferrer'
  );
}
