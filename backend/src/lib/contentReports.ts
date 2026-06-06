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
  roomType?: 'salon' | 'live' | 'dm' | 'reel' | 'profile';
  roomId?: string;
  messageId?: string;
  createdAt: number;
}

function reportsPath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  const dir = path.join(envDir, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'content-reports.jsonl');
}

export function appendContentReport(report: Omit<ContentReport, 'id' | 'createdAt'>): ContentReport {
  const full: ContentReport = {
    ...report,
    id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  fs.appendFileSync(reportsPath(), `${JSON.stringify(full)}\n`, 'utf8');
  return full;
}
