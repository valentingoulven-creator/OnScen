import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { db } from '../models/schema';
import { schedulePersist } from '../lib/persist';
import { schedulePersistUserToPg } from '../lib/pgUsers';
import { logAdminAction } from '../lib/adminAuditLog';
import {
  createUserSnapshot,
  listUserSnapshots,
  restoreUserFromSnapshot,
  SnapshotNotFoundError,
} from '../lib/accountSnapshot';

/**
 * Restauration de compte depuis l'admin — spec : commun/docs/RESTORE-COMPTE-ADMIN.md.
 * Monté sur /api/access (mêmes préfixe et conventions que routes/access.ts).
 */
export const adminAccountSnapshotsRouter = Router();

function adminId(req: Request): string {
  return (req as Request & { user: { id: string } }).user.id;
}

/** POST /admin/users/:userId/snapshots — crée un snapshot restaurable maintenant. */
adminAccountSnapshotsRouter.post(
  '/admin/users/:userId/snapshots',
  authenticateJWT,
  (req: Request, res: Response) => {
    if (requireAdmin(req, res) == null) return;
    const user = db.users.get(req.params.userId);
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;
    try {
      const meta = createUserSnapshot(user, { reason, createdBy: adminId(req) });
      logAdminAction({
        adminId: adminId(req),
        action: 'user_snapshot_create',
        targetType: 'user',
        targetId: user.id,
        details: { snapshotId: meta.id, reason, itemCounts: meta.itemCounts },
        ip: req.ip,
      });
      res.json({ snapshot: meta });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Échec de la sauvegarde' });
    }
  }
);

/** GET /admin/users/:userId/snapshots — liste les snapshots disponibles. */
adminAccountSnapshotsRouter.get(
  '/admin/users/:userId/snapshots',
  authenticateJWT,
  (req: Request, res: Response) => {
    if (requireAdmin(req, res) == null) return;
    if (!db.users.has(req.params.userId)) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    res.json({ snapshots: listUserSnapshots(req.params.userId) });
  }
);

/** POST /admin/users/:userId/snapshots/:snapshotId/restore — restaure ce compte. */
adminAccountSnapshotsRouter.post(
  '/admin/users/:userId/snapshots/:snapshotId/restore',
  authenticateJWT,
  (req: Request, res: Response) => {
    if (requireAdmin(req, res) == null) return;
    const { userId, snapshotId } = req.params;
    try {
      const result = restoreUserFromSnapshot(userId, snapshotId);
      // Jamais de SQL direct (cf. flush périodique pgStore.ts) — écrit dans le
      // store RAM ci-dessus, puis planifie la persistance normale de l'app.
      schedulePersistUserToPg(result.user);
      schedulePersist();
      logAdminAction({
        adminId: adminId(req),
        action: 'user_restore',
        targetType: 'user',
        targetId: userId,
        details: { snapshotId, itemCounts: result.itemCounts },
        ip: req.ip,
      });
      res.json({ ok: true, itemCounts: result.itemCounts });
    } catch (e) {
      if (e instanceof SnapshotNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      res.status(500).json({ error: e instanceof Error ? e.message : 'Échec de la restauration' });
    }
  }
);
