import { db, type Sponsor, type SponsorAccent, type SponsorBannerDisplayMode, type SponsorKind, type SponsorMapVisibilityScope, type SponsorPlacement } from '../models/schema';
import { assertValidSponsorBannerUrl } from './sponsorBannerAssets';
import { assertValidSponsorLogoUrl } from './sponsorLogoAssets';

export type MapAdPublic = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent?: SponsorAccent;
  bannerDisplayMode?: SponsorBannerDisplayMode;
  sponsor?: string;
  kind?: SponsorKind;
  logoUrl?: string;
  bannerImageUrl?: string;
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

/** Zoom minimal (carte plate) pour afficher un bandeau régional. */
export const MAP_REGION_MIN_ZOOM = 8;

/** Marge optionnelle sur les bounds viewport (degrés) pour les villes en bord de carte. */
export const MAP_SPONSOR_BOUNDS_PADDING_DEG = 0.01;

export type MapViewportBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const MAP_VISIBILITY_SCOPES: SponsorMapVisibilityScope[] = ['france', 'region'];
const BANNER_DISPLAY_MODES: SponsorBannerDisplayMode[] = ['full', 'image_only'];

const REGION_SPONSOR_DEFAULTS: Record<
  string,
  Pick<Sponsor, 'mapVisibilityScope' | 'mapTargetRegionName' | 'mapTargetLat' | 'mapTargetLng'>
> = {
  'solar-festival-cres': {
    mapVisibilityScope: 'region',
    mapTargetRegionName: 'Le Crès',
    mapTargetLat: 43.6489,
    mapTargetLng: 3.8567,
  },
  'les-deferlantes-2026': {
    mapVisibilityScope: 'region',
    mapTargetRegionName: 'Argelès-sur-Mer',
    mapTargetLat: 42.5467,
    mapTargetLng: 3.0222,
  },
};

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
    mapVisibilityScope: 'france',
  },
  {
    id: 'solar-festival-cres',
    name: 'Solar Festival',
    placement: 'map_banner',
    active: true,
    priority: 1,
    title: 'Solar Festival au Crès',
    subtitle: '5e édition — électro en bord de lac, 4 juillet 2026 · Petit Biscuit, KAS:ST & plus',
    cta: 'Billetterie',
    linkUrl: 'https://solarfestival.fr/billetterie',
    logoUrl:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=80&h=80&fit=crop',
    accent: 'amber',
    kind: 'promo',
    displayDurationSec: 10,
    endsAt: 1783224000000,
    mapVisibilityScope: 'region',
    mapTargetRegionName: 'Le Crès',
    mapTargetLat: 43.6489,
    mapTargetLng: 3.8567,
  },
  {
    id: 'les-deferlantes-2026',
    name: 'Les Déferlantes',
    placement: 'map_banner',
    active: true,
    priority: 2,
    title: 'Les Déferlantes 2026',
    subtitle: 'Rock & chanson française à Argelès-sur-Mer — 3 au 7 juillet 2026 · scène méditerranéenne',
    cta: 'Billetterie',
    linkUrl: 'https://www.lesdeferlantes.com',
    logoUrl:
      'https://images.unsplash.com/photo-1459749411176-827ae46c79ea?w=80&h=80&fit=crop',
    accent: 'rose',
    kind: 'promo',
    displayDurationSec: 10,
    endsAt: 1783545599999,
    mapVisibilityScope: 'region',
    mapTargetRegionName: 'Argelès-sur-Mer',
    mapTargetLat: 42.5467,
    mapTargetLng: 3.0222,
  },
  {
    id: 'salon',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 3,
    title: 'Lance ton salon',
    subtitle: 'Partage Spotify ou YouTube avec les auditeurs autour de toi',
    cta: 'Créer un salon',
    accent: 'pink',
    kind: 'promo',
    actionId: 'salon',
    mapVisibilityScope: 'france',
  },
  {
    id: 'live',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 4,
    title: 'Passe en live',
    subtitle: 'Réactions, chat public et messages privés depuis la carte',
    cta: 'Voir les lives',
    accent: 'amber',
    kind: 'promo',
    actionId: 'live',
    mapVisibilityScope: 'france',
  },
  {
    id: 'deezer-demo',
    name: 'Deezer',
    placement: 'map_banner',
    active: true,
    priority: 5,
    title: 'Deezer — essai gratuit',
    subtitle: 'HiFi, paroles synchronisées et playlists sans pub pendant 3 mois',
    cta: 'En savoir plus',
    linkUrl: 'https://www.deezer.com/fr/offers',
    accent: 'cyan',
    kind: 'sponsored',
    mapVisibilityScope: 'france',
  },
  {
    id: 'fnac-demo',
    name: 'Fnac',
    placement: 'map_banner',
    active: true,
    priority: 6,
    title: 'Fnac Musique',
    subtitle: '−20 % sur les vinyles et CD près de chez toi — offre démo msdev',
    cta: 'Voir l’offre',
    accent: 'rose',
    kind: 'sponsored',
    mapVisibilityScope: 'france',
  },
  {
    id: 'discover',
    name: 'Soundy',
    placement: 'map_banner',
    active: true,
    priority: 7,
    title: 'Explore la carte Soundy',
    subtitle: 'Salons, lives et créateurs musicaux à proximité — rejoins la communauté',
    cta: 'Explorer',
    accent: 'purple',
    kind: 'promo',
    mapVisibilityScope: 'france',
  },
];

function now(): number {
  return Date.now();
}

function newId(): string {
  return `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseAccent(raw: unknown, existing?: SponsorAccent): SponsorAccent | undefined {
  if (raw === null || raw === '') return undefined;
  if (raw === undefined) return existing;
  const v = String(raw).trim();
  if (!v) return undefined;
  return ACCENTS.includes(v as SponsorAccent) ? (v as SponsorAccent) : existing;
}

function parseBannerDisplayMode(
  raw: unknown,
  existing?: SponsorBannerDisplayMode,
  placement?: SponsorPlacement
): SponsorBannerDisplayMode | undefined {
  if (placement !== 'map_banner') return undefined;
  if (raw === null || raw === '') return 'full';
  const v = String(raw ?? existing ?? 'full');
  return BANNER_DISPLAY_MODES.includes(v as SponsorBannerDisplayMode)
    ? (v as SponsorBannerDisplayMode)
    : 'full';
}

function parsePlacement(raw: unknown): SponsorPlacement {
  const v = String(raw || 'map_banner');
  return PLACEMENTS.includes(v as SponsorPlacement) ? (v as SponsorPlacement) : 'map_banner';
}

function parseKind(raw: unknown): SponsorKind {
  const v = String(raw || 'promo');
  return KINDS.includes(v as SponsorKind) ? (v as SponsorKind) : 'promo';
}

function parseMapVisibilityScope(raw: unknown, existing?: SponsorMapVisibilityScope): SponsorMapVisibilityScope {
  const v = String(raw ?? existing ?? 'france');
  return MAP_VISIBILITY_SCOPES.includes(v as SponsorMapVisibilityScope)
    ? (v as SponsorMapVisibilityScope)
    : 'france';
}

function parseOptionalCoord(raw: unknown, existing?: number): number | undefined {
  if (raw === null || raw === '') return undefined;
  const value = raw !== undefined ? Number(raw) : existing;
  if (value == null || !Number.isFinite(value)) return existing;
  return value;
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
    bannerDisplayMode:
      sponsor.placement === 'map_banner' ? (sponsor.bannerDisplayMode ?? 'full') : undefined,
    sponsor: sponsor.name,
    kind: sponsor.kind,
    logoUrl: sponsor.logoUrl,
    bannerImageUrl: sponsor.bannerImageUrl,
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

export function listActiveMapAds(at = now(), viewport?: MapViewportQuery): MapAdPublic[] {
  return listActiveAdsByPlacement('map_banner', at, viewport);
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

/** Filtre les sponsors carte par viewport (France toujours + région si zoom/portée OK). */
export function filterMapSponsorsByViewport(
  sponsors: Sponsor[],
  viewport?: MapViewportQuery
): Sponsor[] {
  return sponsors.filter((sponsor) => isSponsorVisibleOnMap(sponsor, viewport));
}

function listActiveAdsByPlacement(
  placement: SponsorPlacement,
  at = now(),
  viewport?: MapViewportQuery
): MapAdPublic[] {
  return filterMapSponsorsByViewport(
    listSponsors({ placement, activeOnly: true, at }),
    placement === 'map_banner' ? viewport : undefined
  ).map(sponsorToMapAd);
}

export type MapViewportQuery = {
  lat?: number;
  lng?: number;
  zoom?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

function expandMapViewportBounds(
  bounds: MapViewportBounds,
  padding = MAP_SPONSOR_BOUNDS_PADDING_DEG
): MapViewportBounds {
  return {
    north: bounds.north + padding,
    south: bounds.south - padding,
    east: bounds.east + padding,
    west: bounds.west - padding,
  };
}

export function parseMapViewportBounds(
  viewport?: MapViewportQuery | null
): MapViewportBounds | null {
  if (!viewport) return null;
  const { north, south, east, west } = viewport;
  if (
    north == null ||
    south == null ||
    east == null ||
    west == null ||
    !Number.isFinite(north) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(west)
  ) {
    return null;
  }
  return { north, south, east, west };
}

function isInMapViewportBounds(
  latitude: number,
  longitude: number,
  bounds: MapViewportBounds
): boolean {
  const padded = expandMapViewportBounds(bounds);
  if (latitude < padded.south || latitude > padded.north) return false;
  if (padded.west <= padded.east) {
    return longitude >= padded.west && longitude <= padded.east;
  }
  return longitude >= padded.west || longitude <= padded.east;
}

/** Bandeau carte visible pour la vue courante (France toujours ; région si zoom ville + ville dans viewport). */
export function isSponsorVisibleOnMap(sponsor: Sponsor, viewport?: MapViewportQuery): boolean {
  const scope = sponsor.mapVisibilityScope ?? 'france';
  if (scope === 'france') return true;

  const zoom = viewport?.zoom;
  if (zoom == null || !Number.isFinite(zoom) || zoom < MAP_REGION_MIN_ZOOM) {
    return false;
  }

  const bounds = parseMapViewportBounds(viewport);
  if (!bounds) return false;

  const lat = sponsor.mapTargetLat;
  const lng = sponsor.mapTargetLng;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return false;
  }

  return isInMapViewportBounds(lat, lng, bounds);
}

export function getSponsorById(id: string): Sponsor | undefined {
  return db.sponsors.find((s) => s.id === id);
}

export type SponsorInput = {
  name?: string;
  logoUrl?: string;
  bannerImageUrl?: string | null;
  linkUrl?: string;
  placement?: SponsorPlacement;
  active?: boolean;
  priority?: number;
  startsAt?: number | null;
  endsAt?: number | null;
  title?: string;
  subtitle?: string;
  cta?: string;
  accent?: SponsorAccent | null;
  bannerDisplayMode?: SponsorBannerDisplayMode | null;
  kind?: SponsorKind;
  actionId?: 'salon' | 'live' | null;
  displayDurationSec?: number | null;
  videoUrl?: string;
  posterUrl?: string;
  mapVisibilityScope?: SponsorMapVisibilityScope;
  mapTargetRegionName?: string | null;
  mapTargetLat?: number | null;
  mapTargetLng?: number | null;
};

function normalizeInput(input: SponsorInput, existing?: Sponsor): Sponsor {
  const ts = now();
  const name = String(input.name ?? existing?.name ?? '').trim();
  if (!name) throw new Error('Le nom du sponsor est requis');

  const placement = parsePlacement(input.placement ?? existing?.placement);
  const bannerDisplayMode = parseBannerDisplayMode(
    input.bannerDisplayMode !== undefined ? input.bannerDisplayMode : undefined,
    existing?.bannerDisplayMode,
    placement
  );
  const isImageOnlyBanner = placement === 'map_banner' && bannerDisplayMode === 'image_only';

  const title = String(input.title ?? existing?.title ?? '').trim();
  const subtitle = String(input.subtitle ?? existing?.subtitle ?? '').trim();
  const cta = String(input.cta ?? existing?.cta ?? '').trim();
  if (!isImageOnlyBanner && (!title || !subtitle || !cta)) {
    throw new Error('Titre, sous-titre et appel à l’action sont requis');
  }
  if (isImageOnlyBanner && !title) {
    throw new Error('Un titre est requis pour l’administration (non affiché sur la carte en mode image seule)');
  }

  const actionRaw = input.actionId !== undefined ? input.actionId : existing?.actionId;
  const actionId = actionRaw === 'salon' || actionRaw === 'live' ? actionRaw : undefined;

  const linkUrlRaw = input.linkUrl !== undefined ? input.linkUrl : existing?.linkUrl;
  const linkUrl = linkUrlRaw ? String(linkUrlRaw).trim() || undefined : undefined;

  if (isImageOnlyBanner && !linkUrl && !actionId) {
    throw new Error('Lien ou action interne requis pour un bandeau image seule cliquable');
  }

  const logoUrlRaw = input.logoUrl !== undefined ? input.logoUrl : existing?.logoUrl;
  const logoUrl = assertValidSponsorLogoUrl(
    logoUrlRaw ? String(logoUrlRaw).trim() || undefined : undefined
  );

  const videoUrlRaw = input.videoUrl !== undefined ? input.videoUrl : existing?.videoUrl;
  const videoUrl = videoUrlRaw ? String(videoUrlRaw).trim() || undefined : undefined;

  const posterUrlRaw = input.posterUrl !== undefined ? input.posterUrl : existing?.posterUrl;
  const posterUrl = posterUrlRaw ? String(posterUrlRaw).trim() || undefined : undefined;

  const bannerImageUrlRaw =
    input.bannerImageUrl !== undefined ? input.bannerImageUrl : existing?.bannerImageUrl;
  const bannerImageUrl =
    placement === 'map_banner'
      ? assertValidSponsorBannerUrl(
          bannerImageUrlRaw === null
            ? undefined
            : bannerImageUrlRaw
              ? String(bannerImageUrlRaw).trim() || undefined
              : undefined
        )
      : undefined;

  if (isImageOnlyBanner && !bannerImageUrl) {
    throw new Error('Image du bandeau requise en mode image seule');
  }

  if (placement === 'reels_sponsored' && !videoUrl && !posterUrl) {
    throw new Error('URL vidéo ou vignette requise pour un reel sponsorisé');
  }

  const mapVisibilityScope = parseMapVisibilityScope(
    input.mapVisibilityScope ?? existing?.mapVisibilityScope,
    existing?.mapVisibilityScope
  );

  const mapTargetRegionNameRaw =
    input.mapTargetRegionName !== undefined
      ? input.mapTargetRegionName
      : existing?.mapTargetRegionName;
  const mapTargetRegionName = mapTargetRegionNameRaw
    ? String(mapTargetRegionNameRaw).trim() || undefined
    : undefined;

  const mapTargetLat =
    input.mapTargetLat === null
      ? undefined
      : parseOptionalCoord(input.mapTargetLat, existing?.mapTargetLat);
  const mapTargetLng =
    input.mapTargetLng === null
      ? undefined
      : parseOptionalCoord(input.mapTargetLng, existing?.mapTargetLng);

  if (placement === 'map_banner' && mapVisibilityScope === 'region') {
    if (!mapTargetRegionName) {
      throw new Error('Nom de la ville ou région requis pour un bandeau régional');
    }
    if (
      mapTargetLat == null ||
      mapTargetLng == null ||
      mapTargetLat < -90 ||
      mapTargetLat > 90 ||
      mapTargetLng < -180 ||
      mapTargetLng > 180
    ) {
      throw new Error('Latitude et longitude requises pour un bandeau régional');
    }
  }

  return {
    id: existing?.id ?? newId(),
    name,
    logoUrl,
    bannerImageUrl,
    linkUrl,
    placement,
    active: input.active ?? existing?.active ?? true,
    priority:
      input.priority != null && Number.isFinite(input.priority)
        ? Math.max(0, Math.floor(input.priority))
        : (existing?.priority ?? db.sponsors.length),
    startsAt: input.startsAt === null ? undefined : parseOptionalTs(input.startsAt ?? existing?.startsAt),
    endsAt: input.endsAt === null ? undefined : parseOptionalTs(input.endsAt ?? existing?.endsAt),
    title: title || name,
    subtitle: subtitle || '—',
    cta: cta || '—',
    accent: parseAccent(
      input.accent !== undefined ? input.accent : undefined,
      existing?.accent
    ),
    bannerDisplayMode: placement === 'map_banner' ? bannerDisplayMode : undefined,
    kind: parseKind(input.kind ?? existing?.kind),
    actionId,
    displayDurationSec: parseDisplayDurationSec(
      input.displayDurationSec !== undefined ? input.displayDurationSec : undefined,
      existing?.displayDurationSec
    ),
    videoUrl,
    posterUrl,
    mapVisibilityScope: placement === 'map_banner' ? mapVisibilityScope : undefined,
    mapTargetRegionName:
      placement === 'map_banner' && mapVisibilityScope === 'region' ? mapTargetRegionName : undefined,
    mapTargetLat:
      placement === 'map_banner' && mapVisibilityScope === 'region' ? mapTargetLat : undefined,
    mapTargetLng:
      placement === 'map_banner' && mapVisibilityScope === 'region' ? mapTargetLng : undefined,
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
  // Remember that this default sponsor was explicitly deleted so ensureDefaultSponsors()
  // won't resurrect it on the next server restart.
  if (DEFAULT_SPONSORS.some((s) => s.id === id)) {
    db.deletedDefaultSponsorIds.add(id);
  }
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

/**
 * Met à jour mapVisibilityScope des sponsors existants selon les valeurs par défaut.
 * Utile après un changement de ciblage dans DEFAULT_SPONSORS (ex. 'region' → 'france').
 * Retourne le nombre de sponsors mis à jour.
 */
export function syncDefaultSponsorScopes(): number {
  const ts = now();
  let updated = 0;
  for (const seed of DEFAULT_SPONSORS) {
    if (seed.mapVisibilityScope == null) continue;
    const sponsor = db.sponsors.find((s) => s.id === seed.id);
    if (!sponsor) continue;
    if (sponsor.mapVisibilityScope === seed.mapVisibilityScope) continue;
    sponsor.mapVisibilityScope = seed.mapVisibilityScope;
    if (seed.mapVisibilityScope === 'france') {
      sponsor.mapTargetRegionName = undefined;
      sponsor.mapTargetLat = undefined;
      sponsor.mapTargetLng = undefined;
    }
    sponsor.updatedAt = ts;
    updated++;
  }
  return updated;
}

/** Insère les sponsors par défaut manquants (upsert par id). Retourne le nombre ajouté. */
export function ensureDefaultSponsors(): number {
  const ts = now();
  const existingIds = new Set(db.sponsors.map((s) => s.id));
  let added = 0;

  // First-ever run: no sponsors exist yet and none have ever been admin-deleted.
  if (db.sponsors.length === 0 && db.deletedDefaultSponsorIds.size === 0) {
    for (const seed of DEFAULT_SPONSORS) {
      db.sponsors.push({ ...seed, createdAt: ts, updatedAt: ts });
    }
    return DEFAULT_SPONSORS.length;
  }

  for (const seed of DEFAULT_SPONSORS) {
    if (existingIds.has(seed.id)) continue;
    // Skip sponsors that were explicitly deleted by an admin — respect the deletion.
    if (db.deletedDefaultSponsorIds.has(seed.id)) continue;
    db.sponsors.push({ ...seed, createdAt: ts, updatedAt: ts });
    added += 1;
  }
  return added;
}

/** Renseigne mapVisibilityScope sur les sponsors existants (migration douce). */
export function migrateSponsorMapVisibility(): number {
  let migrated = 0;
  const ts = now();
  for (const sponsor of db.sponsors) {
    if (sponsor.mapVisibilityScope) continue;
    const regionalDefaults = REGION_SPONSOR_DEFAULTS[sponsor.id];
    if (regionalDefaults) {
      Object.assign(sponsor, regionalDefaults);
    } else if (sponsor.placement === 'map_banner') {
      sponsor.mapVisibilityScope = 'france';
    }
    sponsor.updatedAt = ts;
    migrated += 1;
  }
  return migrated;
}

export function sponsorCounts(): { total: number; active: number; inactive: number } {
  const total = db.sponsors.length;
  const active = db.sponsors.filter((s) => isSponsorActiveAt(s)).length;
  return { total, active, inactive: total - active };
}
