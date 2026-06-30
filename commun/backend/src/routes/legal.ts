import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getLegalDocument, listLegalDocumentKeys } from '../lib/legalDocuments';
import { loadLegalPublisherConfig, isPublisherConfigComplete } from '../lib/legalPublisher';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import { appendContentReport } from '../lib/contentReports';
import { blockUser } from '../lib/blocks';
import { db } from '../models/schema';

export const legalRouter = Router();

legalRouter.get('/publisher', (_req, res) => {
  res.json({
    config: loadLegalPublisherConfig(),
    complete: isPublisherConfigComplete(),
    termsVersion: CURRENT_TERMS_VERSION,
  });
});

legalRouter.get('/documents', (_req, res) => {
  res.json({ keys: listLegalDocumentKeys() });
});

legalRouter.get('/documents/:key', (req, res) => {
  const doc = getLegalDocument(req.params.key);
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable' });
    return;
  }
  res.json({ document: doc });
});

legalRouter.post('/reports', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string; username: string } }).user;
  const { category, details, targetUserId, roomType, roomId, messageId } = req.body ?? {};

  if (!category?.trim() || !details?.trim()) {
    res.status(400).json({ error: 'Catégorie et description requises' });
    return;
  }

  const allowed = ['harassment', 'illegal', 'spam', 'copyright', 'privacy', 'other'];
  if (!allowed.includes(category)) {
    res.status(400).json({ error: 'Catégorie invalide' });
    return;
  }

  if (targetUserId && !db.users.has(targetUserId)) {
    res.status(400).json({ error: 'Utilisateur cible introuvable' });
    return;
  }

  const report = appendContentReport({
    reporterId: me.id,
    reporterUsername: me.username,
    category: category.trim(),
    details: details.trim().slice(0, 2000),
    targetUserId: targetUserId || undefined,
    roomType,
    roomId: roomId?.trim() || undefined,
    messageId: messageId?.trim() || undefined,
  });

  let blocked = false;
  if (targetUserId && targetUserId !== me.id) {
    blockUser(me.id, targetUserId);
    blocked = true;
  }

  res.status(201).json({ ok: true, reportId: report.id, blocked });
});
