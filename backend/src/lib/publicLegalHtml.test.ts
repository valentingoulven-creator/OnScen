import { describe, expect, it } from 'vitest';
import { resolvePublicLegalDocKey, renderPublicLegalHtml } from './publicLegalHtml';

describe('publicLegalHtml', () => {
  it('maps public URL paths to document keys', () => {
    expect(resolvePublicLegalDocKey('/privacy')).toBe('privacy');
    expect(resolvePublicLegalDocKey('/terms')).toBe('terms');
    expect(resolvePublicLegalDocKey('/legal/mentions')).toBe('mentions');
    expect(resolvePublicLegalDocKey('/unknown')).toBeNull();
  });

  it('renders HTML for privacy', () => {
    const html = renderPublicLegalHtml('privacy');
    expect(html).toContain('Politique de confidentialité');
    expect(html).toContain('<!DOCTYPE html>');
  });
});
