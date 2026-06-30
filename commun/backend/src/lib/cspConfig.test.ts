import { describe, expect, it } from 'vitest';
import { buildCspConnectSrc, buildCspImgSrc } from './cspConfig';

describe('cspConfig', () => {
  it('includes self and stripe in connect-src', () => {
    const src = buildCspConnectSrc();
    expect(src).toContain("'self'");
    expect(src).toContain('https://api.stripe.com');
    expect(src).not.toContain('https:');
  });

  it('restricts img-src to https in deployed stacks', () => {
    const prev = process.env.APP_ENV;
    process.env.APP_ENV = 'production';
    const src = buildCspImgSrc();
    expect(src).toContain('https:');
    expect(src).not.toContain('http:');
    process.env.APP_ENV = prev;
  });
});
