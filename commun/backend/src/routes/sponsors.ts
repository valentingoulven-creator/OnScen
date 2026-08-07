import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  isValidSponsorPlacement,
  trackSponsorAnalyticsEvent,
  type SponsorAnalyticsEvent,
} from '../lib/sponsorAnalytics';
import {
  listActiveFeedAds,
  listActiveMapAds,
  listActiveMapSidebarEventPosts,
  listActiveReelsAds,
  listActiveSalonAds,
  listActiveStoriesAds,
  listActiveStoriesSponsoredAds,
  type MapViewportQuery,
} from '../lib/sponsors';
import { getPublicReelsSponsorConfig, getPublicStoriesSponsorConfig } from '../lib/sponsorPlatformConfig';

export const sponsorsRouter = Router();

function sendActiveSponsors(res: Response, items: ReturnType<typeof listActiveMapAds>): void {
  res.setHeader('Cache-Control', 'public, max-age=15, must-revalidate');
  res.json({ items });
}

function parseMapViewportQuery(req: Request): MapViewportQuery | undefined {
  const latRaw = req.query.lat;
  const lngRaw = req.query.lng;
  const zoomRaw = req.query.zoom;
  const northRaw = req.query.north;
  const southRaw = req.query.south;
  const eastRaw = req.query.east;
  const westRaw = req.query.west;
  if (
    latRaw == null &&
    lngRaw == null &&
    zoomRaw == null &&
    northRaw == null &&
    southRaw == null &&
    eastRaw == null &&
    westRaw == null
  ) {
    return undefined;
  }

  const lat = latRaw != null ? Number(latRaw) : undefined;
  const lng = lngRaw != null ? Number(lngRaw) : undefined;
  const zoom = zoomRaw != null ? Number(zoomRaw) : undefined;
  const north = northRaw != null ? Number(northRaw) : undefined;
  const south = southRaw != null ? Number(southRaw) : undefined;
  const east = eastRaw != null ? Number(eastRaw) : undefined;
  const west = westRaw != null ? Number(westRaw) : undefined;
  const viewport: MapViewportQuery = {};
  if (lat != null && Number.isFinite(lat)) viewport.lat = lat;
  if (lng != null && Number.isFinite(lng)) viewport.lng = lng;
  if (zoom != null && Number.isFinite(zoom)) viewport.zoom = zoom;
  if (north != null && Number.isFinite(north)) viewport.north = north;
  if (south != null && Number.isFinite(south)) viewport.south = south;
  if (east != null && Number.isFinite(east)) viewport.east = east;
  if (west != null && Number.isFinite(west)) viewport.west = west;
  return Object.keys(viewport).length > 0 ? viewport : undefined;
}

/** POST /api/sponsors/track — impression ou clic sponsor (agrégats anonymes). */
sponsorsRouter.post('/track', (req: Request, res: Response) => {
  const { sponsorId, placement, event } = req.body ?? {};
  if (typeof sponsorId !== 'string' || !sponsorId.trim()) {
    res.status(400).json({ error: 'sponsorId requis' });
    return;
  }
  if (!isValidSponsorPlacement(placement)) {
    res.status(400).json({ error: 'placement invalide' });
    return;
  }
  const ev: SponsorAnalyticsEvent | null =
    event === 'impression' || event === 'click' ? event : null;
  if (!ev) {
    res.status(400).json({ error: 'event invalide (impression | click)' });
    return;
  }
  trackSponsorAnalyticsEvent(ev, sponsorId.trim(), placement);
  res.json({ ok: true });
});

/** Bandeaux actifs pour la carte (public, sans auth). */
sponsorsRouter.get('/map', (req: Request, res: Response) => {
  sendActiveSponsors(res, listActiveMapAds(undefined, parseMapViewportQuery(req)));
});

/** Sponsors actifs pour le fil d'actualité (public, sans auth). */
sponsorsRouter.get('/feed', (_req: Request, res: Response) => {
  sendActiveSponsors(res, listActiveFeedAds());
});

/** Bandeaux actifs pour la zone stories (public, sans auth). */
sponsorsRouter.get('/stories', (_req: Request, res: Response) => {
  sendActiveSponsors(res, listActiveStoriesAds());
});

/** Reels sponsorisés actifs + configuration globale (public, sans auth). */
sponsorsRouter.get('/reels', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, must-revalidate');
  res.json({
    items: listActiveReelsAds(),
    config: getPublicReelsSponsorConfig(),
  });
});

/** Stories sponsorisées (visionneur plein écran) + configuration (public, sans auth). */
sponsorsRouter.get('/stories-viewer', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, must-revalidate');
  res.json({
    items: listActiveStoriesSponsoredAds(),
    config: getPublicStoriesSponsorConfig(),
  });
});

/** Bandeaux actifs pour le salon théâtre (public, sans auth). */
sponsorsRouter.get('/salon', (_req: Request, res: Response) => {
  sendActiveSponsors(res, listActiveSalonAds());
});

/** Événements sponsorisés sidebar carte (auth — état like/favori). */
sponsorsRouter.get('/map-sidebar-events', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.setHeader('Cache-Control', 'private, max-age=15, must-revalidate');
  res.json({ posts: listActiveMapSidebarEventPosts(me) });
});
