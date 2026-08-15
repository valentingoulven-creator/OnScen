import { afterEach, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { isWebAuthnEnabledForRequest, rejectIfWebAuthnDisabledOnWeb } from './webAuthnPublic';

function req(headers: Record<string, string>): Request {
  return { headers } as Request;
}

function resMock(): Response & { statusCode?: number; body?: unknown } {
  const out: Response & { statusCode?: number; body?: unknown } = {
    status(code: number) {
      out.statusCode = code;
      return out;
    },
    json(body: unknown) {
      out.body = body;
      return out;
    },
  } as Response & { statusCode?: number; body?: unknown };
  return out;
}

describe('webAuthnPublic', () => {
  const prev = process.env.APP_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prev;
  });

  it('allows web clients outside production', () => {
    process.env.APP_ENV = 'msdev';
    expect(isWebAuthnEnabledForRequest(req({ 'x-onscen-client': 'web' }))).toBe(true);
  });

  it('blocks web clients in production', () => {
    process.env.APP_ENV = 'production';
    const res = resMock();
    expect(rejectIfWebAuthnDisabledOnWeb(req({ 'x-onscen-client': 'web' }), res)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'WEBAUTHN_WEB_DISABLED' });
  });

  it('allows native clients in production', () => {
    process.env.APP_ENV = 'production';
    expect(isWebAuthnEnabledForRequest(req({ 'x-onscen-client': 'ios-native' }))).toBe(true);
    expect(isWebAuthnEnabledForRequest(req({ 'x-onscen-client': 'android-native' }))).toBe(true);
  });
});
