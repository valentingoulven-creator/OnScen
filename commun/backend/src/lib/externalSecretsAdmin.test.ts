import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyProviderConfig,
  getExternalSecretsStatus,
  getProviderStatus,
  maskExternalSecretValue,
  validateProviderInput,
} from './externalSecretsAdmin';
import { getProviderDef } from './externalSecretsRegistry';

describe('maskExternalSecretValue', () => {
  it('masks a long value keeping first 4 + last 4 chars', () => {
    expect(maskExternalSecretValue('sk-ant-abcdefgh1234')).toBe('sk-a••••1234');
  });

  it('fully masks short values (<=8 chars)', () => {
    expect(maskExternalSecretValue('abcdefgh')).toBe('••••');
  });

  it('returns null for empty/undefined values', () => {
    expect(maskExternalSecretValue(undefined)).toBeNull();
    expect(maskExternalSecretValue('')).toBeNull();
    expect(maskExternalSecretValue('   ')).toBeNull();
  });
});

describe('validateProviderInput', () => {
  it('returns an error for an unknown provider', () => {
    const errors = validateProviderInput('not-a-provider', {});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a key not whitelisted for that provider', () => {
    const errors = validateProviderInput('livekit', { STRIPE_SECRET_KEY: 'sk_live_x' });
    expect(errors.some((e) => e.field === 'STRIPE_SECRET_KEY')).toBe(true);
  });

  it('reports required fields missing', () => {
    const errors = validateProviderInput('livekit', {});
    expect(errors.some((e) => e.field === 'LIVEKIT_URL')).toBe(true);
    expect(errors.some((e) => e.field === 'LIVEKIT_API_KEY')).toBe(true);
    expect(errors.some((e) => e.field === 'LIVEKIT_API_SECRET')).toBe(true);
  });

  it('accepts a fully valid livekit payload', () => {
    const errors = validateProviderInput('livekit', {
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'APIabcdefgh',
      LIVEKIT_API_SECRET: 'abcdefgh12345678',
    });
    expect(errors).toEqual([]);
  });

  it('rejects an invalid URL format', () => {
    const errors = validateProviderInput('livekit', {
      LIVEKIT_URL: 'not-a-url',
      LIVEKIT_API_KEY: 'APIabcdefgh',
      LIVEKIT_API_SECRET: 'abcdefgh12345678',
    });
    expect(errors.some((e) => e.field === 'LIVEKIT_URL')).toBe(true);
  });

  it('does not require optional fields (ai_agents: only one key needed)', () => {
    const errors = validateProviderInput('ai_agents', { ANTHROPIC_API_KEY: 'sk-ant-abcdefgh1234' });
    expect(errors).toEqual([]);
  });

  it('validates optional fields when provided (invalid httpUrl)', () => {
    const errors = validateProviderInput('google_oauth', {
      GOOGLE_CLIENT_ID: '123456789-xxxx.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'GOCSPX-abcdefgh1234',
      GOOGLE_CALLBACK_URL: 'https://getsoundy.com/api/auth/google/callback',
      YOUTUBE_CALLBACK_URL: 'not-a-url',
    });
    expect(errors.some((e) => e.field === 'YOUTUBE_CALLBACK_URL')).toBe(true);
  });
});

describe('getProviderStatus / getExternalSecretsStatus', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('reports unconfigured when required fields are missing', () => {
    const status = getProviderStatus(getProviderDef('livekit')!);
    expect(status.configured).toBe(false);
  });

  it('reports configured once every required field is set + masks secrets', () => {
    process.env.LIVEKIT_URL = 'wss://example.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'APIabcdefgh12345';
    process.env.LIVEKIT_API_SECRET = 'abcdefgh12345678';
    const status = getProviderStatus(getProviderDef('livekit')!);
    expect(status.configured).toBe(true);
    const urlField = status.fields.find((f) => f.key === 'LIVEKIT_URL')!;
    expect(urlField.value).toBe('wss://example.livekit.cloud');
    const secretField = status.fields.find((f) => f.key === 'LIVEKIT_API_SECRET')!;
    expect(secretField.value).toBeNull();
    expect(secretField.masked).toBe('abcd••••5678');
  });

  it('provider with zero required fields is "configured" once any field is set (ai_agents)', () => {
    expect(getProviderStatus(getProviderDef('ai_agents')!).configured).toBe(false);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-abcdefgh1234';
    expect(getProviderStatus(getProviderDef('ai_agents')!).configured).toBe(true);
  });

  it('lists every registered provider in getExternalSecretsStatus', () => {
    const res = getExternalSecretsStatus();
    expect(res.providers.some((p) => p.id === 'livekit')).toBe(true);
    expect(res.providers.some((p) => p.id === 'sightengine')).toBe(true);
    expect(res.providers.some((p) => p.id === 's3_scaleway')).toBe(true);
  });
});

describe('applyProviderConfig', () => {
  const envBackup = { ...process.env };
  const tmpFiles: string[] = [];

  function tmpEnvPath(content: string): string {
    const file = path.join(os.tmpdir(), `onscen-ext-secrets-test-${Date.now()}-${Math.random()}.env`);
    fs.writeFileSync(file, content);
    tmpFiles.push(file);
    return file;
  }

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.SIGHTENGINE_API_USER;
    delete process.env.SIGHTENGINE_API_SECRET;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    for (const file of tmpFiles.splice(0)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  it('throws for an unknown provider', () => {
    expect(() => applyProviderConfig('not-a-provider', {})).toThrow(/inconnu/);
  });

  it('rejects a key not belonging to the provider (whitelist enforcement)', () => {
    expect(() =>
      applyProviderConfig('sightengine', {
        SIGHTENGINE_API_USER: 'user123',
        SIGHTENGINE_API_SECRET: 'secret123',
        DATABASE_URL: 'postgres://evil',
      })
    ).toThrow(/non autorisée/);
  });

  it('rejects apply when the resolved .env file does not exist', () => {
    const missingPath = path.join(os.tmpdir(), `onscen-ext-secrets-missing-${Date.now()}.env`);
    expect(() =>
      applyProviderConfig(
        'sightengine',
        { SIGHTENGINE_API_USER: 'user123', SIGHTENGINE_API_SECRET: 'secret123' },
        { envPathOverride: missingPath }
      )
    ).toThrow(/introuvable/);
  });

  it('persists to the .env file and updates process.env immediately (hot reload, no restart)', () => {
    const envPath = tmpEnvPath(['DATABASE_URL=postgres://x', 'FOO=bar', ''].join('\n'));

    const status = applyProviderConfig(
      'sightengine',
      { SIGHTENGINE_API_USER: 'newuser', SIGHTENGINE_API_SECRET: 'newsecret123' },
      { envPathOverride: envPath }
    );

    expect(status.configured).toBe(true);

    const fileContent = fs.readFileSync(envPath, 'utf8');
    expect(fileContent).toContain('SIGHTENGINE_API_USER=newuser');
    expect(fileContent).toContain('SIGHTENGINE_API_SECRET=newsecret123');
    expect(fileContent).toContain('DATABASE_URL=postgres://x');
    expect(fileContent).toContain('FOO=bar');

    expect(process.env.SIGHTENGINE_API_USER).toBe('newuser');
    expect(process.env.SIGHTENGINE_API_SECRET).toBe('newsecret123');
  });

  it('does not erase an existing value when an optional field is left blank', () => {
    const envPath = tmpEnvPath(['GOOGLE_CLIENT_ID=old-id', 'GOOGLE_CLIENT_SECRET=old-secret', 'GOOGLE_CALLBACK_URL=https://old.example.com/callback', 'YOUTUBE_CALLBACK_URL=https://old.example.com/youtube', ''].join('\n'));

    applyProviderConfig(
      'google_oauth',
      {
        GOOGLE_CLIENT_ID: 'new-id',
        GOOGLE_CLIENT_SECRET: 'new-secret',
        GOOGLE_CALLBACK_URL: 'https://new.example.com/callback',
        YOUTUBE_CALLBACK_URL: '',
      },
      { envPathOverride: envPath }
    );

    const fileContent = fs.readFileSync(envPath, 'utf8');
    expect(fileContent).toContain('GOOGLE_CLIENT_ID=new-id');
    expect(fileContent).toContain('YOUTUBE_CALLBACK_URL=https://old.example.com/youtube');
  });
});
