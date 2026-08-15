import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { getOnScenClient, isNativeClient, rejectIfNativePayments } from './clientPlatform';

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

describe('clientPlatform', () => {
  it('reads X-OnScen-Client', () => {
    expect(getOnScenClient(req({ 'x-onscen-client': 'ios-native' }))).toBe('ios-native');
    expect(getOnScenClient(req({ 'x-onscen-client': 'android-native' }))).toBe('android-native');
    expect(getOnScenClient(req({ 'x-onscen-client': 'web' }))).toBe('web');
  });

  it('falls back to Capacitor UA', () => {
    expect(
      getOnScenClient(req({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS) Capacitor' }))
    ).toBe('ios-native');
    expect(
      getOnScenClient(req({ 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Capacitor' }))
    ).toBe('android-native');
  });

  it('rejects native digital payments without suggesting the browser', () => {
    const res = resMock();
    expect(rejectIfNativePayments(req({ 'x-onscen-client': 'ios-native' }), res)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'NATIVE_IAP_REQUIRED' });
    expect(JSON.stringify(res.body)).not.toMatch(/navigateur|browser/i);
    expect(isNativeClient(req({ 'x-onscen-client': 'web' }))).toBe(false);
  });
});
