import { describe, expect, it } from 'vitest';
import { buildAdminStatsAnalysis } from './adminStatsPdfExport';
import { adminStatsOverviewFixture } from './adminStatsOverviewFixture';

const base = adminStatsOverviewFixture();

describe('buildAdminStatsAnalysis', () => {
  it('returns startup message when no users', () => {
    const lines = buildAdminStatsAnalysis({ ...base, users: { ...base.users, total: 0 } }, 'fr');
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/Aucun utilisateur/i);
  });

  it('includes online and engagement lines in French', () => {
    const lines = buildAdminStatsAnalysis(base, 'fr-FR');
    expect(lines.some((l) => l.includes('Présence simultanée'))).toBe(true);
    expect(lines.some((l) => l.includes('Engagement récent'))).toBe(true);
    expect(lines.some((l) => l.includes('Reel le plus consulté'))).toBe(true);
  });
});
