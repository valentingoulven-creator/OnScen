import { afterEach, describe, expect, it } from 'vitest';
import { getEmailFrom, isProductionEmailMisconfigured, isResendSandboxFrom } from './emailSend';

describe('emailSend production From', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('détecte le domaine sandbox Resend', () => {
    expect(isResendSandboxFrom('OnScen <onboarding@resend.dev>')).toBe(true);
    expect(isResendSandboxFrom('OnScen <noreply@onscen.com>')).toBe(false);
  });

  it('refuse @resend.dev en production', () => {
    process.env.APP_ENV = 'production';
    process.env.RESEND_FROM = 'OnScen <onboarding@resend.dev>';
    expect(() => getEmailFrom()).toThrow(/resend\.dev/);
  });

  it('accepte noreply@onscen.com en production', () => {
    process.env.APP_ENV = 'production';
    process.env.RESEND_FROM = 'OnScen <noreply@onscen.com>';
    expect(getEmailFrom()).toBe('OnScen <noreply@onscen.com>');
  });

  it('signale health smtp error si From sandbox en production', () => {
    process.env.APP_ENV = 'production';
    process.env.RESEND_API_KEY = 're_testkey';
    process.env.RESEND_FROM = 'OnScen <onboarding@resend.dev>';
    expect(isProductionEmailMisconfigured()).toBe(true);
    process.env.RESEND_FROM = 'OnScen <noreply@onscen.com>';
    expect(isProductionEmailMisconfigured()).toBe(false);
  });
});
