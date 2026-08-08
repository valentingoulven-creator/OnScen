import { afterEach, describe, expect, it } from 'vitest';
import { getProdSaasStatusReport } from './prodSaasStatus';

describe('getProdSaasStatusReport', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns production environment and sightengine required status', () => {
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://localhost/test';
    process.env.SIGHTENGINE_API_USER = 'u';
    process.env.SIGHTENGINE_API_SECRET = 's';
    delete process.env.STRIPE_SECRET_KEY;

    const report = getProdSaasStatusReport();
    expect(report.environment).toBe('production');
    const sightengine = report.services.find((s) => s.id === 'sightengine');
    expect(sightengine?.configured).toBe(true);
    expect(sightengine?.requiredInProd).toBe(true);
    const stripe = report.services.find((s) => s.id === 'stripe');
    expect(stripe?.configured).toBe(false);
    expect(stripe?.status).toBe('missing');
  });

  it('marks ACRCloud disabled when ACRCLOUD_ENABLED=0', () => {
    process.env.APP_ENV = 'production';
    process.env.ACRCLOUD_ENABLED = '0';
    process.env.ACRCLOUD_ACCESS_KEY = 'k';
    process.env.ACRCLOUD_ACCESS_SECRET = 's';

    const acr = getProdSaasStatusReport().services.find((s) => s.id === 'acrcloud');
    expect(acr?.status).toBe('disabled');
    expect(acr?.configured).toBe(false);
  });

  it('includes external link groups', () => {
    const report = getProdSaasStatusReport();
    expect(report.linkGroups.length).toBeGreaterThan(5);
    const onscen = report.linkGroups.find((g) => g.id === 'onscen');
    expect(onscen?.links.some((l) => l.url.includes('getsoundy.com'))).toBe(true);
    expect(Array.isArray(report.alerts)).toBe(true);
  });

  it('raises critical alert when Stripe test key on production', () => {
    process.env.APP_ENV = 'production';
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    const report = getProdSaasStatusReport();
    const alert = report.alerts.find((a) => a.id === 'stripe_test_on_production');
    expect(alert?.severity).toBe('critical');
    const stripe = report.services.find((s) => s.id === 'stripe');
    expect(stripe?.flags?.stripeMode).toBe('test');
  });

  it('reports youtube oauth and api key separately', () => {
    process.env.APP_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'g-id';
    process.env.GOOGLE_CLIENT_SECRET = 'g-secret';
    process.env.YOUTUBE_CALLBACK_URL = 'https://getsoundy.com/cb';
    delete process.env.YOUTUBE_API_KEY;

    const report = getProdSaasStatusReport();
    expect(report.services.find((s) => s.id === 'youtube_oauth')?.configured).toBe(true);
    expect(report.services.find((s) => s.id === 'youtube_api_key')?.configured).toBe(false);
  });
});
