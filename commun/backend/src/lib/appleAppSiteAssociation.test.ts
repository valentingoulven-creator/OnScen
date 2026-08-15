import { describe, expect, it } from 'vitest';
import { buildAppleAppSiteAssociation } from './appleAppSiteAssociation';

describe('buildAppleAppSiteAssociation', () => {
  it('injecte le Team ID et les paths tel', () => {
    const aasa = buildAppleAppSiteAssociation('ABCD1234');
    expect(aasa.applinks.details[0]?.appID).toBe('ABCD1234.com.soundy.app');
    expect(aasa.applinks.details[0]?.paths).toContain('/reels/*');
    expect(aasa.webcredentials.apps).toEqual(['ABCD1234.com.soundy.app']);
  });
});
