import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { isAccessAdmin } from '../lib/accessControl';
import { schedulePersist } from '../lib/persist';
import {
  createSponsor,
  deleteSponsor,
  getSponsorById,
  isSponsorActiveAt,
  listSponsors,
  reorderSponsors,
  sponsorCounts,
  toggleSponsorActive,
  updateSponsor,
  type SponsorInput,
} from '../lib/sponsors';
import {
  getSponsorPlatformConfig,
  updateSponsorPlatformConfig,
} from '../lib/sponsorPlatformConfig';
import { saveSponsorBannerFromDataUrl } from '../lib/sponsorBannerAssets';
import { saveSponsorLogoFromDataUrl } from '../lib/sponsorLogoAssets';
import type { SponsorPlacement } from '../models/schema';

export const adminSponsorsRouter = Router();

type SponsorFilter = 'all' | 'active' | 'inactive';

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

function parseFilter(raw: unknown): SponsorFilter {
  const v = String(raw || 'all');
  if (v === 'active' || v === 'inactive') return v;
  return 'all';
}

function parsePlacement(raw: unknown): SponsorPlacement | undefined {
  const v = String(raw || '').trim();
  if (
    v === 'map_banner' ||
    v === 'feed_inline' ||
    v === 'stories_banner' ||
    v === 'reels_sponsored'
  ) {
    return v;
  }
  return undefined;
}

function parseBodyInput(body: Record<string, unknown>): SponsorInput {
  return {
    name: body.name != null ? String(body.name) : undefined,
    logoUrl: body.logoUrl != null ? String(body.logoUrl) : undefined,
    bannerImageUrl:
      body.bannerImageUrl === null
        ? null
        : body.bannerImageUrl != null
          ? String(body.bannerImageUrl)
          : undefined,
    linkUrl: body.linkUrl != null ? String(body.linkUrl) : undefined,
    placement: parsePlacement(body.placement),
    active: body.active != null ? Boolean(body.active) : undefined,
    priority: body.priority != null ? Number(body.priority) : undefined,
    startsAt:
      body.startsAt === null
        ? null
        : body.startsAt != null
          ? Number(body.startsAt)
          : undefined,
    endsAt:
      body.endsAt === null ? null : body.endsAt != null ? Number(body.endsAt) : undefined,
    title: body.title != null ? String(body.title) : undefined,
    subtitle: body.subtitle != null ? String(body.subtitle) : undefined,
    cta: body.cta != null ? String(body.cta) : undefined,
    accent:
      body.accent === null || body.accent === ''
        ? null
        : body.accent != null
          ? (String(body.accent) as SponsorInput['accent'])
          : undefined,
    bannerDisplayMode:
      body.bannerDisplayMode === null || body.bannerDisplayMode === ''
        ? null
        : body.bannerDisplayMode === 'full' || body.bannerDisplayMode === 'image_only'
          ? body.bannerDisplayMode
          : undefined,
    kind: body.kind != null ? (String(body.kind) as SponsorInput['kind']) : undefined,
    actionId:
      body.actionId === null
        ? null
        : body.actionId === 'salon' || body.actionId === 'live'
          ? body.actionId
          : undefined,
    displayDurationSec:
      body.displayDurationSec === null
        ? null
        : body.displayDurationSec != null
          ? Number(body.displayDurationSec)
          : undefined,
    videoUrl: body.videoUrl != null ? String(body.videoUrl) : undefined,
    posterUrl: body.posterUrl != null ? String(body.posterUrl) : undefined,
    mapVisibilityScope:
      body.mapVisibilityScope === 'france' || body.mapVisibilityScope === 'region'
        ? body.mapVisibilityScope
        : undefined,
    mapTargetRegionName:
      body.mapTargetRegionName === null
        ? null
        : body.mapTargetRegionName != null
          ? String(body.mapTargetRegionName)
          : undefined,
    mapTargetLat:
      body.mapTargetLat === null
        ? null
        : body.mapTargetLat != null
          ? Number(body.mapTargetLat)
          : undefined,
    mapTargetLng:
      body.mapTargetLng === null
        ? null
        : body.mapTargetLng != null
          ? Number(body.mapTargetLng)
          : undefined,
  };
}

adminSponsorsRouter.get('/config', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  res.json({ config: getSponsorPlatformConfig() });
});

adminSponsorsRouter.patch('/config', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const body = req.body ?? {};
    const config = updateSponsorPlatformConfig({
      reelsSponsorEnabled:
        body.reelsSponsorEnabled != null ? Boolean(body.reelsSponsorEnabled) : undefined,
      reelsSponsorEveryN:
        body.reelsSponsorEveryN != null ? Number(body.reelsSponsorEveryN) : undefined,
    });
    schedulePersist();
    res.json({ config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Données invalides' });
  }
});

adminSponsorsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const filter = parseFilter(req.query.filter);
  const placement = parsePlacement(req.query.placement);
  const q = String(req.query.q || '').trim();
  let items = listSponsors({ placement, q });
  if (filter === 'active') items = items.filter((s) => isSponsorActiveAt(s));
  if (filter === 'inactive') items = items.filter((s) => !isSponsorActiveAt(s));
  const counts = sponsorCounts();
  res.json({ items, total: items.length, counts });
});

adminSponsorsRouter.post('/reorder', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) {
    res.status(400).json({ error: 'Liste d’identifiants requise' });
    return;
  }
  const items = reorderSponsors(ids);
  schedulePersist();
  res.json({ items });
});

adminSponsorsRouter.post('/upload-logo', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const image = String(req.body?.image ?? '').trim();
    if (!image) {
      res.status(400).json({ error: 'Image requise' });
      return;
    }
    const url = saveSponsorLogoFromDataUrl(image);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload impossible' });
  }
});

adminSponsorsRouter.post('/upload-banner', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const image = String(req.body?.image ?? '').trim();
    if (!image) {
      res.status(400).json({ error: 'Image requise' });
      return;
    }
    const url = saveSponsorBannerFromDataUrl(image);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload impossible' });
  }
});

adminSponsorsRouter.get('/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sponsor = getSponsorById(req.params.id);
  if (!sponsor) {
    res.status(404).json({ error: 'Sponsor introuvable' });
    return;
  }
  res.json({ sponsor });
});

adminSponsorsRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const sponsor = createSponsor(parseBodyInput(req.body ?? {}));
    schedulePersist();
    res.status(201).json({ sponsor });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Données invalides' });
  }
});

adminSponsorsRouter.patch('/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const sponsor = updateSponsor(req.params.id, parseBodyInput(req.body ?? {}));
    schedulePersist();
    res.json({ sponsor });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Données invalides';
    res.status(msg.includes('introuvable') ? 404 : 400).json({ error: msg });
  }
});

adminSponsorsRouter.post('/:id/toggle', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const sponsor = toggleSponsorActive(req.params.id);
    schedulePersist();
    res.json({ sponsor });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Action impossible';
    res.status(msg.includes('introuvable') ? 404 : 400).json({ error: msg });
  }
});

adminSponsorsRouter.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    deleteSponsor(req.params.id);
    schedulePersist();
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Suppression impossible';
    res.status(msg.includes('introuvable') ? 404 : 400).json({ error: msg });
  }
});
