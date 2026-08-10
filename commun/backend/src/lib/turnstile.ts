import { isMsdevRuntime } from './msdevGuard';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}

/** Si true, register / forgot-password refusés sans token Turnstile valide (prod ouvert). */
export function isTurnstileRequired(): boolean {
  if (process.env.TURNSTILE_REQUIRED === '0') return false;
  if (process.env.TURNSTILE_REQUIRED === '1') return true;
  if (isMsdevRuntime()) return false;
  return isTurnstileConfigured();
}

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string | null
): Promise<boolean> {
  if (!isTurnstileRequired()) return true;
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  if (typeof token !== 'string' || !token.trim()) return false;

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token.trim());
  if (remoteIp?.trim()) body.set('remoteip', remoteIp.trim());

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
