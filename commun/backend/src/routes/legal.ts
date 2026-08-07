import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getLegalDocument, listLegalDocumentKeys } from '../lib/legalDocuments';
import { loadLegalPublisherConfig, isPublisherConfigComplete } from '../lib/legalPublisher';
import { CURRENT_TERMS_VERSION } from '../lib/legalConstants';
import { appendContentReport, URGENT_REPORT_CATEGORIES } from '../lib/contentReports';
import { blockUser } from '../lib/blocks';
import { db } from '../models/schema';
import { sendMonitoringAlert } from '../lib/alertNotifier';

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

  // 'csam_risk' : catégorie dédiée « contenu impliquant potentiellement un mineur »
  // (audit MOD-8, distincte de 'illegal' générique) — notification admin immédiate.
  const allowed = ['harassment', 'illegal', 'spam', 'copyright', 'privacy', 'csam_risk', 'other'];
  if (!allowed.includes(category)) {
    res.status(400).json({ error: 'Catégorie invalide' });
    return;
  }

  if (targetUserId && !db.users.has(targetUserId)) {
    res.status(400).json({ error: 'Utilisateur cible introuvable' });
    return;
  }

  const trimmedCategory = category.trim();
  const report = appendContentReport({
    reporterId: me.id,
    reporterUsername: me.username,
    category: trimmedCategory,
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

  // Audit MOD-5/MOD-6 : plus de dépendance à une consultation manuelle périodique du
  // panneau admin pour les signalements graves — alerte immédiate, criticité maximale,
  // sans cooldown pour les catégories illégal/CSAM.
  if (URGENT_REPORT_CATEGORIES.has(trimmedCategory)) {
    const target = targetUserId ? db.users.get(targetUserId) : undefined;
    void sendMonitoringAlert({
      type: trimmedCategory === 'csam_risk' ? 'csam_risk_detected' : 'urgent_content_report',
      severity: 'critical',
      forceSend: true,
      message:
        `Nouveau signalement URGENT (${trimmedCategory}) par ${me.username}.\n` +
        `Cible : ${target?.username ?? targetUserId ?? 'n/a'}${targetUserId ? ` (${targetUserId})` : ''}.\n` +
        `Détails : ${report.details}\n\n` +
        `Voir le panneau admin > Signalements pour traiter en priorité.` +
        (trimmedCategory === 'csam_risk'
          ? '\n\nSi le signalement concerne un mineur, suivre RUNBOOK-CSAM.md (préservation de preuve, PHAROS/NCMEC).'
          : ''),
    }).catch((err) => console.error('[legal] Échec alerte signalement urgent:', err));
  }

  res.status(201).json({ ok: true, reportId: report.id, blocked });
});
