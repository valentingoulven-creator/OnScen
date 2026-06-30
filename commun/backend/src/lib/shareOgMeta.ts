import { db } from '../models/schema';

export interface ShareOgMeta {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

function absoluteAssetUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveUserAvatar(userId: string, baseUrl: string): string {
  const user = db.users.get(userId);
  const avatar = user?.avatarUrl?.trim();
  if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    return avatar;
  }
  return absoluteAssetUrl(baseUrl, '/pwa-512x512.png');
}

export function resolveShareOgMeta(pathname: string, baseUrl: string): ShareOgMeta | null {
  const base = baseUrl.replace(/\/$/, '');

  const salonMatch = pathname.match(/^\/salon\/([^/]+)\/?$/i);
  if (salonMatch) {
    const salonId = decodeURIComponent(salonMatch[1]);
    const salon = db.salons.get(salonId);
    if (!salon || salon.adminBlocked) return null;
    const platform = platformLabel(salon.platform);
    return {
      title: `${salon.title} — Salon ${platform} · Soundy`,
      description: `Rejoignez le salon musical de ${salon.hostName} sur Soundy. Écoute synchronisée, file d'attente et chat en direct.`,
      imageUrl: salon.hostAvatarUrl?.startsWith('http')
        ? salon.hostAvatarUrl
        : resolveUserAvatar(salon.hostId, base),
      canonicalUrl: `${base}/salon/${encodeURIComponent(salonId)}`,
    };
  }

  const profileMatch = pathname.match(/^\/profile\/([^/]+)\/?$/i);
  if (profileMatch) {
    const userId = decodeURIComponent(profileMatch[1]);
    const user = db.users.get(userId);
    if (!user) return null;
    const bio = user.bio?.trim();
    return {
      title: `${user.username} — Profil Soundy`,
      description:
        bio && bio.length <= 160
          ? bio
          : `Découvrez le profil musical de ${user.username} sur Soundy : salons, lives, reels et actu.`,
      imageUrl: resolveUserAvatar(userId, base),
      canonicalUrl: `${base}/profile/${encodeURIComponent(userId)}`,
    };
  }

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOgHtmlTags(meta: ShareOgMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.imageUrl);
  const url = escapeHtml(meta.canonicalUrl);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Soundy" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<link rel="canonical" href="${url}" />`,
  ].join('\n    ');
}

export function injectOgMetaIntoHtml(html: string, meta: ShareOgMeta): string {
  const tags = buildOgHtmlTags(meta);
  let out = html.replace(/<title>[^<]*<\/title>/i, tags);
  if (out === html) {
    out = html.replace(/<head>/i, `<head>\n    ${tags}`);
  }
  return out;
}
