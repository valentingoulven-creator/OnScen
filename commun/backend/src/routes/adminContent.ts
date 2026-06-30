import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { isAccessAdmin } from '../lib/accessControl';
import { schedulePersist } from '../lib/persist';
import {
  adminBlockEvent,
  adminBlockLive,
  adminBlockSalon,
  adminDeleteEvent,
  adminDeleteLive,
  adminDeleteSalon,
  adminUnblockEvent,
  adminUnblockLive,
  adminUnblockSalon,
  mapAdminEventRow,
  mapAdminLiveRow,
  mapAdminReelRow,
  mapAdminSalonRow,
  adminBlockReel,
  adminDeleteReel,
  adminUnblockReel,
} from '../lib/adminContentModeration';

export const adminContentRouter = Router();

type ContentFilter = 'all' | 'blocked' | 'active';

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

function parseContentFilter(raw: unknown): ContentFilter {
  const v = String(raw || 'all');
  if (v === 'blocked' || v === 'active') return v;
  return 'all';
}

function matchesSearch(needle: string, ...parts: (string | undefined)[]): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return parts.some((p) => p?.toLowerCase().includes(n));
}

function paginate<T>(items: T[], limit: number, offset: number) {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    hasMore: offset + limit < items.length,
  };
}

adminContentRouter.get('/salons', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const filter = parseContentFilter(req.query.filter);
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  let rows = [...db.salons.values()].map(mapAdminSalonRow);
  if (filter === 'blocked') rows = rows.filter((r) => r.adminBlocked);
  if (filter === 'active') rows = rows.filter((r) => !r.adminBlocked);
  if (q) {
    rows = rows.filter((r) =>
      matchesSearch(q, r.title, r.hostName, r.creator?.username, r.creator?.email, r.city, r.id)
    );
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);

  const blocked = [...db.salons.values()].filter((s) => s.adminBlocked).length;
  const page = paginate(rows, limit, offset);
  res.json({
    salons: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    counts: { total: db.salons.size, blocked, active: db.salons.size - blocked },
  });
});

adminContentRouter.get('/lives', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const filter = parseContentFilter(req.query.filter);
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  let rows = [...db.lives.values()].map(mapAdminLiveRow);
  if (filter === 'blocked') rows = rows.filter((r) => r.adminBlocked);
  if (filter === 'active') rows = rows.filter((r) => !r.adminBlocked && r.isActive);
  if (q) {
    rows = rows.filter((r) =>
      matchesSearch(q, r.title, r.hostName, r.salonTitle, r.creator?.username, r.creator?.email, r.city, r.id)
    );
  }
  rows.sort((a, b) => b.startedAt - a.startedAt);

  const all = [...db.lives.values()];
  const blocked = all.filter((l) => l.adminBlocked).length;
  const activeNow = all.filter((l) => l.isActive && !l.adminBlocked).length;
  const page = paginate(rows, limit, offset);
  res.json({
    lives: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    counts: { total: all.length, blocked, active: activeNow },
  });
});

adminContentRouter.get('/events', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const filter = parseContentFilter(req.query.filter);
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  const events = db.feedPosts.filter((p) => p.isEvent);
  let rows = events.map(mapAdminEventRow);
  if (filter === 'blocked') rows = rows.filter((r) => r.adminBlocked);
  if (filter === 'active') rows = rows.filter((r) => !r.adminBlocked);
  if (q) {
    rows = rows.filter((r) =>
      matchesSearch(
        q,
        r.content,
        r.eventLocation,
        r.creator?.username,
        r.creator?.email,
        r.id
      )
    );
  }
  rows.sort((a, b) => {
    const dateA = a.eventDate ? Date.parse(a.eventDate) : a.createdAt;
    const dateB = b.eventDate ? Date.parse(b.eventDate) : b.createdAt;
    return dateB - dateA;
  });

  const blocked = events.filter((p) => p.adminBlocked).length;
  const page = paginate(rows, limit, offset);
  res.json({
    events: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    counts: { total: events.length, blocked, active: events.length - blocked },
  });
});

adminContentRouter.post('/salons/:id/block', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const salon = adminBlockSalon(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  schedulePersist();
  res.json({ salon: mapAdminSalonRow(salon) });
});

adminContentRouter.post('/salons/:id/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const salon = adminUnblockSalon(req.params.id);
  if (!salon) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  schedulePersist();
  res.json({ salon: mapAdminSalonRow(salon) });
});

adminContentRouter.delete('/salons/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!adminDeleteSalon(req.params.id)) {
    res.status(404).json({ error: 'Salon introuvable' });
    return;
  }
  schedulePersist();
  res.json({ ok: true });
});

adminContentRouter.post('/lives/:id/block', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const live = adminBlockLive(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  schedulePersist();
  res.json({ live: mapAdminLiveRow(live) });
});

adminContentRouter.post('/lives/:id/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const live = adminUnblockLive(req.params.id);
  if (!live) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  schedulePersist();
  res.json({ live: mapAdminLiveRow(live) });
});

adminContentRouter.delete('/lives/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!adminDeleteLive(req.params.id)) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }
  schedulePersist();
  res.json({ ok: true });
});

adminContentRouter.post('/events/:id/block', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const post = adminBlockEvent(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }
  schedulePersist();
  res.json({ event: mapAdminEventRow(post) });
});

adminContentRouter.post('/events/:id/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const post = adminUnblockEvent(req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }
  schedulePersist();
  res.json({ event: mapAdminEventRow(post) });
});

adminContentRouter.delete('/events/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!adminDeleteEvent(req.params.id)) {
    res.status(404).json({ error: 'Événement introuvable' });
    return;
  }
  schedulePersist();
  res.json({ ok: true });
});

adminContentRouter.get('/reels', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const filter = parseContentFilter(req.query.filter);
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

  let rows = db.userReels.map(mapAdminReelRow);
  if (filter === 'blocked') rows = rows.filter((r) => r.adminBlocked);
  if (filter === 'active') rows = rows.filter((r) => !r.adminBlocked);
  if (q) {
    rows = rows.filter((r) =>
      matchesSearch(
        q,
        r.title,
        r.artist,
        r.genre,
        r.caption,
        r.creator?.username,
        r.creator?.email,
        r.id
      )
    );
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);

  const all = db.userReels;
  const blocked = all.filter((r) => r.adminBlocked).length;
  const page = paginate(rows, limit, offset);
  res.json({
    reels: page.items,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    counts: { total: all.length, blocked, active: all.length - blocked },
  });
});

adminContentRouter.post('/reels/:id/block', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const reel = adminBlockReel(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel introuvable' });
    return;
  }
  schedulePersist();
  res.json({ reel: mapAdminReelRow(reel) });
});

adminContentRouter.post('/reels/:id/unblock', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const reel = adminUnblockReel(req.params.id);
  if (!reel) {
    res.status(404).json({ error: 'Reel introuvable' });
    return;
  }
  schedulePersist();
  res.json({ reel: mapAdminReelRow(reel) });
});

adminContentRouter.delete('/reels/:id', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!adminDeleteReel(req.params.id)) {
    res.status(404).json({ error: 'Reel introuvable' });
    return;
  }
  schedulePersist();
  res.json({ ok: true });
});
