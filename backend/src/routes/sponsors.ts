import { Router, Request, Response } from 'express';
import { listActiveFeedAds, listActiveMapAds, listActiveReelsAds, listActiveStoriesAds } from '../lib/sponsors';
import { getPublicReelsSponsorConfig } from '../lib/sponsorPlatformConfig';

export const sponsorsRouter = Router();

function sendActiveSponsors(res: Response, items: ReturnType<typeof listActiveMapAds>): void {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({ items });
}

/** Bandeaux actifs pour la carte (public, sans auth). */
sponsorsRouter.get('/map', (_req: Request, res: Response) => {
  sendActiveSponsors(res, listActiveMapAds());
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
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    items: listActiveReelsAds(),
    config: getPublicReelsSponsorConfig(),
  });
});
