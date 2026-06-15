import { db, type Sponsor, type SponsorAccent, type SponsorKind, type SponsorPlacement } from '../models/schema';

export type MapAdPublic = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent: SponsorAccent;
  sponsor?: string;
  kind?: SponsorKind;
  logoUrl?: string;
  actionId?: 'salon' | 'live';
  displayDurationSec?: number;
  videoUrl?: string;
  posterUrl?: string;
};

const ACCENTS: SponsorAccent[] = ['purple', 'pink', 'amber', 'cyan', 'rose'];
const PLACEMENTS: SponsorPlacement[] = ['map_banner', 'feed_inline', 'stories_banner', 'reels_sponsored'];
const KINDS: SponsorKind[] = ['promo', 'sponsored'];
const DEFAULT_DISPLAY_DURATION_SEC = 8;
const DISPLAY_DURATION_MIN_SEC = 3;
const DISPLAY_DURATION_MAX_SEC = 60;

const DEFAULT_SPONSORS: Omit<Sponsor, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'premium',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 0,
    title: 'Soundy Premium',
    subtitle: 'Sans pub sur la carte et badge exclusif pour ton profil',
    cta: 'Découvrir',
    accent: 'purple',
    kind: 'promo',
  },
  {
    id: 'salon',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 1,
    title: 'Lance ton salon',
    subtitle: 'Partage Spotify ou YouTube avec les auditeurs autour de toi',
    cta: 'Créer un salon',
    accent: 'pink',
    kind: 'promo',
    actionId: 'salon',
  },
  {
    id: 'live',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 2,
    title: 'Passe en live',
    subtitle: 'Réactions, chat public et messages privés depuis la carte',
    cta: 'Voir les lives',
    accent: 'amber',
    kind: 'promo',
    actionId: 'live',
  },
  {
    id: 'deezer-demo',
    name: 'Deezer',
    placement: 'map_banner',
    active: true,
    priority: 3,
    title: 'Deezer — essai gratuit',
    subtitle: 'HiFi, paroles synchronisées et playlists sans pub pendant 3 mois',
    cta: 'En savoir plus',
    linkUrl: 'https://www.deezer.com/fr/offers',
    accent: 'cyan',
    kind: 'sponsored',
  },
  {
    id: 'fnac-demo',
    name: 'Fnac',
    placement: 'map_banner',
    active: true,
    priority: 4,
    title: 'Fnac Musique',
    subtitle: '−20 % sur les vinyles et CD près de chez toi — offre démo msdev',
    cta: 'Voir l’offre',
    accent: 'rose',
    kind: 'sponsored',
  },
  {
    id: 'discover',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 5,
    title: 'Explore la carte Soundy',
    subtitle: 'Salons, lives et créateurs musicaux à proximité — rejoins la communauté',
    cta: 'Explorer',
    accent: 'purple',
    kind: 'promo',
  },
];

function now(): number {
  return Date.now();
}

function newId(): string {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAccent(raw: unknown): SponsorAccent {
  const v = String(raw || 'purple');
  return ACCENTS.includes(v as SponsorAccent) ? (v as SponsorAccent) : 'purple';
}

function parsePlacement(raw: unknown): SponsorPlacement {
  const v = String(raw || 'map_banner');
  return PLACEMENTS.includes(v as SponsorPlacement) ? (v as SponsorPlacement) : 'map_banner';
}

function parseKind(raw: unknown): SponsorKind {
  const v = String(raw || 'promo');
  return KINDS.includes(v as SponsorKind) ? (v as SponsorKind) : 'promo';
}

function parseDisplayDurationSec(raw: unknown, existing?: number): number {
  if (raw === null || raw === '') return DEFAULT_DISPLAY_DURATION_SEC;
  const value = raw !== undefined ? Number(raw) : existing;
  if (value == null || !Number.isFinite(value)) return DEFAULT_DISPLAY_DURATION_SEC;
  return Math.min(
    DISPLAY_DURATION_MAX_SEC,
    Math.max(DISPLAY_DURATION_MIN_SEC, Math.floor(value))
  );
}

function parseOptionalTs(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function isSponsorActiveAt(sponsor: Sponsor, at = now()): boolean {
  if (!sponsor.active) return false;
  if (sponsor.startsAt != null && at < sponsor.startsAt) return false;
  if (sponsor.endsAt != null && at > sponsor.endsAt) return false;
  return true;
}

export function sponsorToMapAd(sponsor: Sponsor): MapAdPublic {
  return {
    id: sponsor.id,
    title: sponsor.title,
    subtitle: sponsor.subtitle,
    cta: sponsor.cta,
    href: sponsor.linkUrl,
    accent: sponsor.accent,
    sponsor: sponsor.name,
    kind: sponsor.kind,
    logoUrl: sponsor.logoUrl,
    actionId: sponsor.actionId,
    displayDurationSec: sponsor.displayDurationSec ?? DEFAULT_DISPLAY_DURATION_SEC,
    videoUrl: sponsor.videoUrl,
    posterUrl: sponsor.posterUrl,
  };
}

export function listSponsors(opts?: {
  placement?: SponsorPlacement;
  activeOnly?: boolean;
  q?: string;
  at?: number;
}): Sponsor[] {
  const at = opts?.at ?? now();
  let rows = [...db.sponsors];
  if (opts?.placement) rows = rows.filter((s) => s.placement === opts.placement);
  if (opts?.activeOnly) rows = rows.filter((s) => isSponsorActiveAt(s, at));
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((s) =>
      [s.name, s.title, s.subtitle, s.id].some((part) => part.toLowerCase().includes(q))
    );
  }
  rows.sort((a, b) => a.priority - b.priority || b.updatedAt - a.updatedAt);
  return rows;
}

export function listActiveMapAds(at = now()): MapAdPublic[] {
  return listActiveAdsByPlacement('map_banner', at);
}

export function listActiveFeedAds(at = now()): MapAdPublic[] {
  return listActiveAdsByPlacement('feed_inline', at);
}

export function listActiveStoriesAds(at = now()): MapAdPublic[] {
  return listActiveAdsByPlacement('stories_banner', at);
}

export function listActiveReelsAds(at = now()): MapAdPublic[] {
  return listActiveAdsByPlacement('reels_sponsored', at);
}

function listActiveAdsByPlacement(placement: SponsorPlacement, at = now()): MapAdPublic[] {
  return listSponsors({ placement, activeOnly: true, at }).map(sponsorToMapAd);
}

export function getSponsorById(id: string): Sponsor | undefined {
  return db.sponsors.find((s) => s.id === id);
}

export type SponsorInput = {
  name?: string;
  logoUrl?: string;
  linkUrl?: string;
  placement?: SponsorPlacement;
  active?: boolean;
  priority?: number;
  startsAt?: number | null;
  endsAt?: number | null;
  title?: string;
  subtitle?: string;
  cta?: string;
  accent?: SponsorAccent;
  kind?: SponsorKind;
  actionId?: 'salon' | 'live' | null;
  displayDurationSec?: number | null;
  videoUrl?: string;
  posterUrl?: string;
};

function normalizeInput(input: SponsorInput, existing?: Sponsor): Sponsor {
  const ts = now();
  const name = String(input.name ?? existing?.name ?? '').trim();
  if (!name) throw new Error('Le nom du sponsor est requis');

  const title = String(input.title ?? existing?.title ?? '').trim();
  const subtitle = String(input.subtitle ?? existing?.subtitle ?? '').trim();
  const cta = String(input.cta ?? existing?.cta ?? '').trim();
  if (!title || !subtitle || !cta) {
    throw new Error('Titre, sous-titre et appel à l’action sont requis');
  }

  const actionRaw = input.actionId !== undefined ? input.actionId : existing?.actionId;
  const actionId = actionRaw === 'salon' || actionRaw === 'live' ? actionRaw : undefined;

  const linkUrlRaw = input.linkUrl !== undefined ? input.linkUrl : existing?.linkUrl;
  const linkUrl = linkUrlRaw ? String(linkUrlRaw).trim() || undefined : undefined;

  const logoUrlRaw = input.logoUrl !== undefined ? input.logoUrl : existing?.logoUrl;
  const logoUrl = logoUrlRaw ? String(logoUrlRaw).trim() || undefined : undefined;

  const videoUrlRaw = input.videoUrl !== undefined ? input.videoUrl : existing?.videoUrl;
  const videoUrl = videoUrlRaw ? String(videoUrlRaw).trim() || undefined : undefined;

  const posterUrlRaw = input.posterUrl !== undefined ? input.posterUrl : existing?.posterUrl;
  const posterUrl = posterUrlRaw ? String(posterUrlRaw).trim() || undefined : undefined;

  const placement = parsePlacement(input.placement ?? existing?.placement);

  if (placement === 'reels_sponsored' && !videoUrl && !posterUrl) {
    throw new Error('URL vidéo ou vignette requise pour un reel sponsorisé');
  }

  return {
    id: existing?.id ?? newId(),
    name,
    logoUrl,
    linkUrl,
    placement,
    active: input.active ?? existing?.active ?? true,
    priority:
      input.priority != null && Number.isFinite(input.priority)
        ? Math.max(0, Math.floor(input.priority))
        : (existing?.priority ?? db.sponsors.length),
    startsAt: input.startsAt === null ? undefined : parseOptionalTs(input.startsAt ?? existing?.startsAt),
    endsAt: input.endsAt === null ? undefined : parseOptionalTs(input.endsAt ?? existing?.endsAt),
    title,
    subtitle,
    cta,
    accent: parseAccent(input.accent ?? existing?.accent),
    kind: parseKind(input.kind ?? existing?.kind),
    actionId,
    displayDurationSec: parseDisplayDurationSec(
      input.displayDurationSec !== undefined ? input.displayDurationSec : undefined,
      existing?.displayDurationSec
    ),
    videoUrl,
    posterUrl,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
}

export function createSponsor(input: SponsorInput): Sponsor {
  const sponsor = normalizeInput(input);
  if (db.sponsors.some((s) => s.id === sponsor.id)) {
    throw new Error('Un sponsor avec cet identifiant existe déjà');
  }
  db.sponsors.push(sponsor);
  return sponsor;
}

export function updateSponsor(id: string, input: SponsorInput): Sponsor {
  const idx = db.sponsors.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error('Sponsor introuvable');
  const updated = normalizeInput(input, db.sponsors[idx]);
  updated.id = id;
  updated.createdAt = db.sponsors[idx].createdAt;
  db.sponsors[idx] = updated;
  return updated;
}

export function deleteSponsor(id: string): void {
  const idx = db.sponsors.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error('Sponsor introuvable');
  db.sponsors.splice(idx, 1);
}

export function toggleSponsorActive(id: string): Sponsor {
  const sponsor = getSponsorById(id);
  if (!sponsor) throw new Error('Sponsor introuvable');
  return updateSponsor(id, { active: !sponsor.active });
}

export function reorderSponsors(ids: string[]): Sponsor[] {
  const known = new Set(db.sponsors.map((s) => s.id));
  const ordered = ids.filter((id) => known.has(id));
  const rest = db.sponsors
    .filter((s) => !ordered.includes(s.id))
    .sort((a, b) => a.priority - b.priority)
    .map((s) => s.id);
  const finalOrder = [...ordered, ...rest];
  finalOrder.forEach((id, index) => {
    const sponsor = getSponsorById(id);
    if (sponsor) sponsor.priority = index;
  });
  db.sponsors.forEach((s) => {
    s.updatedAt = now();
  });
  return listSponsors();
}

export function ensureDefaultSponsors(): void {
  if (db.sponsors.length > 0) return;
  const ts = now();
  for (const seed of DEFAULT_SPONSORS) {
    db.sponsors.push({ ...seed, createdAt: ts, updatedAt: ts });
  }
}

export function sponsorCounts(): { total: number; active: number; inactive: number } {
  const total = db.sponsors.length;
  const active = db.sponsors.filter((s) => isSponsorActiveAt(s)).length;
  return { total, active, inactive: total - active };
}
