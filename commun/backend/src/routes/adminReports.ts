import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateJWT } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getMsdevEnvPath } from '../paths';
import type { ContentReport } from '../lib/contentReports';

export const adminReportsRouter = Router();

function reportsFilePath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'data', 'content-reports.jsonl');
}

function readAllReports(): ContentReport[] {
  const file = reportsFilePath();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const reports: ContentReport[] = [];
  for (const line of lines) {
    try {
      reports.push(JSON.parse(line) as ContentReport);
    } catch {
      // skip malformed lines
    }
  }
  return reports.sort((a, b) => b.createdAt - a.createdAt);
}

function writeAllReports(reports: ContentReport[]): void {
  const file = reportsFilePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    file,
    reports.length ? reports.map((r) => JSON.stringify(r)).join('\n') + '\n' : '',
    'utf8'
  );
}

/** GET /api/admin/reports — liste tous les signalements */
adminReportsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const reports = readAllReports();
  res.json({ reports });
});

/** PATCH /api/admin/reports/:id — marquer comme examiné */
adminReportsRouter.patch('/:id', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const { id } = req.params;
  const { status } = req.body ?? {};
  if (!status || !['reviewed', 'dismissed'].includes(status)) {
    res.status(400).json({ error: 'Statut invalide (reviewed | dismissed)' });
    return;
  }
  const reports = readAllReports();
  const idx = reports.findIndex((r) => r.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Signalement introuvable' });
    return;
  }
  (reports[idx] as ContentReport & { status?: string; reviewedAt?: number }).status = status;
  (reports[idx] as ContentReport & { status?: string; reviewedAt?: number }).reviewedAt = Date.now();
  writeAllReports(reports);
  res.json({ ok: true, report: reports[idx] });
});

/** DELETE /api/admin/reports/:id — supprimer un signalement */
adminReportsRouter.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
  if (requireAdmin(req, res) == null) return;
  const { id } = req.params;
  const reports = readAllReports();
  const filtered = reports.filter((r) => r.id !== id);
  if (filtered.length === reports.length) {
    res.status(404).json({ error: 'Signalement introuvable' });
    return;
  }
  writeAllReports(filtered);
  res.json({ ok: true });
});
