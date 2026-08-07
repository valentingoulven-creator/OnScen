import fs from 'fs';
import path from 'path';
import { getMsdevEnvPath } from '../paths';

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterUsername: string;
  category: string;
  details: string;
  targetUserId?: string;
  roomType?: 'salon' | 'live' | 'dm' | 'reel' | 'profile' | 'track';
  roomId?: string;
  messageId?: string;
  createdAt: number;
  /** Priorité calculée à la création (audit MOD-6) — sert au tri/affichage admin. */
  priority?: 'urgent' | 'normal';
}

/** Catégories déclenchant une notification admin immédiate + priorité "urgent" (MOD-5/MOD-6). */
export const URGENT_REPORT_CATEGORIES = new Set(['illegal', 'csam_risk']);

export function computeReportPriority(category: string): 'urgent' | 'normal' {
  return URGENT_REPORT_CATEGORIES.has(category) ? 'urgent' : 'normal';
}

function reportsPath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  const dir = path.join(envDir, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'content-reports.jsonl');
}

export function readAllContentReports(): ContentReport[] {
  const file = reportsPath();
  if (!fs.existsSync(file)) return [];
  const reports: ContentReport[] = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      reports.push(JSON.parse(line) as ContentReport);
    } catch {
      /* ignore corrupt line */
    }
  }
  return reports;
}

export function appendContentReport(report: Omit<ContentReport, 'id' | 'createdAt'>): ContentReport {
  const full: ContentReport = {
    ...report,
    priority: report.priority ?? computeReportPriority(report.category),
    id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  fs.appendFileSync(reportsPath(), `${JSON.stringify(full)}\n`, 'utf8');
  return full;
}

/** Supprime les signalements liés à un utilisateur (auteur ou cible). */
export function purgeReportsForUser(userId: string): void {
  const file = reportsPath();
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const kept: string[] = [];
  for (const line of lines) {
    try {
      const report = JSON.parse(line) as ContentReport;
      if (report.reporterId === userId || report.targetUserId === userId) continue;
      kept.push(line);
    } catch {
      kept.push(line);
    }
  }
  fs.writeFileSync(file, kept.length ? `${kept.join('\n')}\n` : '', 'utf8');
}
