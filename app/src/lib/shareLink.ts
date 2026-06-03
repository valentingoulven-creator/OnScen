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
