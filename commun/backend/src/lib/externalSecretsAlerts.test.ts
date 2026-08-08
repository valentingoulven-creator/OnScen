import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProviderIssues } from './externalSecretsAlerts';
import { getProviderDef } from './externalSecretsRegistry';

describe('getProviderIssues', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.APP_ENV;
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM;
    delete process.env.TURN_URL;
    delete process.env.TURN_USERNAME;
    delete process.env.TURN_CREDENTIAL;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns no issue for a fully and correctly configured provider', () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'APIabcdefgh12345';
    process.env.LIVEKIT_API_SECRET = 'abcdefgh12345678';

    expect(getProviderIssues(getProviderDef('livekit')!)).toEqual([]);
  });

  it('returns no issue for a fully unconfigured provider (optional feature, not an alert)', () => {
    expect(getProviderIssues(getProviderDef('livekit')!)).toEqual([]);
  });

  it('flags partial_config when some required fields are set but not all (real misconfiguration)', () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'APIabcdefgh12345';
    // LIVEKIT_API_SECRET intentionally left unset.

    const issues = getProviderIssues(getProviderDef('livekit')!);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      type: 'partial_config',
      severity: 'critical',
      field: 'LIVEKIT_API_SECRET',
      messageKey: 'admin.integrations.issues.partialConfig',
    });
  });

  it('flags placeholder_value for a known example/default value (exact match, case-insensitive)', () => {
    process.env.SIGHTENGINE_API_USER = 'changez_moi';
    process.env.SIGHTENGINE_API_SECRET = 'realsecret12345678';

    const issues = getProviderIssues(getProviderDef('sightengine')!);
    expect(issues.some((i) => i.type === 'placeholder_value' && i.field === 'SIGHTENGINE_API_USER')).toBe(true);
  });

  it('flags placeholder_value for LiveKit local dev defaults (devkey/secret)', () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'devkey';
    process.env.LIVEKIT_API_SECRET = 'secret';

    const issues = getProviderIssues(getProviderDef('livekit')!);
    expect(issues.some((i) => i.type === 'placeholder_value' && i.field === 'LIVEKIT_API_KEY')).toBe(true);
    expect(issues.some((i) => i.type === 'placeholder_value' && i.field === 'LIVEKIT_API_SECRET')).toBe(true);
  });

  it('does not flag a legitimate value that merely contains a placeholder-like substring', () => {
    // Contains "secret" as a substring but is not an exact match — must NOT be flagged.
    process.env.SIGHTENGINE_API_USER = 'user-with-secretword-123';
    process.env.SIGHTENGINE_API_SECRET = 'realsecretvalue12345';

    const issues = getProviderIssues(getProviderDef('sightengine')!);
    expect(issues.some((i) => i.type === 'placeholder_value')).toBe(false);
  });

  it('flags invalid_format when a stored value no longer matches its declared format (e.g. manual .env edit)', () => {
    process.env.LIVEKIT_URL = 'not-a-websocket-url';
    process.env.LIVEKIT_API_KEY = 'APIabcdefgh12345';
    process.env.LIVEKIT_API_SECRET = 'abcdefgh12345678';

    const issues = getProviderIssues(getProviderDef('livekit')!);
    expect(issues.some((i) => i.type === 'invalid_format' && i.field === 'LIVEKIT_URL')).toBe(true);
  });

  it('flags test_mode_in_production only when APP_ENV=production (resend.dev sandbox domain)', () => {
    process.env.RESEND_API_KEY = 're_abcdefgh12345678';
    process.env.RESEND_FROM = 'OnScen <onboarding@resend.dev>';

    delete process.env.APP_ENV;
    expect(getProviderIssues(getProviderDef('resend_email')!).some((i) => i.type === 'test_mode_in_production')).toBe(
      false
    );

    process.env.APP_ENV = 'production';
    const issues = getProviderIssues(getProviderDef('resend_email')!);
    expect(issues.some((i) => i.type === 'test_mode_in_production' && i.field === 'RESEND_FROM')).toBe(true);
  });

  it('does not flag test_mode_in_production for a verified custom domain', () => {
    process.env.APP_ENV = 'production';
    process.env.RESEND_API_KEY = 're_abcdefgh12345678';
    process.env.RESEND_FROM = 'OnScen <noreply@getsoundy.com>';

    const issues = getProviderIssues(getProviderDef('resend_email')!);
    expect(issues.some((i) => i.type === 'test_mode_in_production')).toBe(false);
  });

  it('never leaks a raw secret value inside an issue object', () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'super-secret-value-should-not-leak';
    // Missing LIVEKIT_API_SECRET triggers partial_config.

    const issues = getProviderIssues(getProviderDef('livekit')!);
    const serialized = JSON.stringify(issues);
    expect(serialized).not.toContain('super-secret-value-should-not-leak');
  });
});
