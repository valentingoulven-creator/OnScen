import { describe, expect, it } from 'vitest';
import { computeReportPriority, URGENT_REPORT_CATEGORIES } from './contentReports';

describe('computeReportPriority (audit MOD-6)', () => {
  it('marque illegal et csam_risk comme urgent', () => {
    expect(computeReportPriority('illegal')).toBe('urgent');
    expect(computeReportPriority('csam_risk')).toBe('urgent');
  });

  it('marque les autres catégories comme normal', () => {
    expect(computeReportPriority('spam')).toBe('normal');
    expect(computeReportPriority('harassment')).toBe('normal');
    expect(computeReportPriority('copyright')).toBe('normal');
    expect(computeReportPriority('privacy')).toBe('normal');
    expect(computeReportPriority('other')).toBe('normal');
  });

  it('expose les catégories urgentes pour réutilisation (ex. alerte immédiate)', () => {
    expect(URGENT_REPORT_CATEGORIES.has('illegal')).toBe(true);
    expect(URGENT_REPORT_CATEGORIES.has('csam_risk')).toBe(true);
    expect(URGENT_REPORT_CATEGORIES.has('spam')).toBe(false);
  });
});
