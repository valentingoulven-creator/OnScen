import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadLegalPublisherConfig } from './legalPublisher';

describe('legalPublisher', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = envBackup;
  });

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.LEGAL_PUBLISHER_ADDRESS;
  });

  it('accepte LEGAL_PUBLISHER_ADDRESS depuis .env', () => {
    process.env.LEGAL_PUBLISHER_ADDRESS = '12 rue de Test, 75001 Paris, France';
    const config = loadLegalPublisherConfig();
    expect(config.address).toBe('12 rue de Test, 75001 Paris, France');
  });
});
