/** Base-aware path for the forgot-password screen (web `/forgot-password`, tel `/tel/forgot-password`). */
export function forgotPasswordHref(): string {
  const base = import.meta.env.BASE_URL;
  if (base.endsWith('/')) return `${base}forgot-password`;
  return `${base}/forgot-password`;
}

export function appLoginHref(): string {
  const base = import.meta.env.BASE_URL;
  return base.endsWith('/') ? base : `${base}/`;
}

export function isForgotPasswordRoute(): boolean {
  const expected = new URL(forgotPasswordHref(), window.location.origin).pathname.replace(/\/$/, '') || '/';
  const current = window.location.pathname.replace(/\/$/, '') || '/';
  return current === expected;
}

export function resetPasswordHref(): string {
  const base = import.meta.env.BASE_URL;
  if (base.endsWith('/')) return `${base}reset-password`;
  return `${base}/reset-password`;
}

export function isResetPasswordRoute(): boolean {
  const expected = new URL(resetPasswordHref(), window.location.origin).pathname.replace(/\/$/, '') || '/';
  const current = window.location.pathname.replace(/\/$/, '') || '/';
  return current === expected;
}

export function verifyEmailHref(): string {
  const base = import.meta.env.BASE_URL;
  if (base.endsWith('/')) return `${base}verify-email`;
  return `${base}/verify-email`;
}

export function isVerifyEmailRoute(): boolean {
  const expected = new URL(verifyEmailHref(), window.location.origin).pathname.replace(/\/$/, '') || '/';
  const current = window.location.pathname.replace(/\/$/, '') || '/';
  return current === expected;
}
