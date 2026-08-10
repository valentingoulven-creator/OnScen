import { request, API_BASE as API, headers, parseApiError, normalizeFetchNetworkError } from './core';

export const authApi = {
  login: (email: string, password: string, rememberMe = true) =>
    request<
      | { token: string; user: import('../../types').User; rememberMe?: boolean; requires2FA?: never }
      | { requires2FA: true; tempToken: string; token?: never; user?: never }
    >('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }),

  register: async (
    username: string,
    email: string,
    password: string,
    acceptTerms: boolean,
    termsVersion: string,
    inviteCode?: string,
    confirmAge?: boolean,
    turnstileToken?: string | null
  ) => {
    let res: Response;
    try {
      res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify({
          username,
          email,
          password,
          acceptTerms,
          termsVersion,
          inviteCode: inviteCode?.trim() || undefined,
          confirmAge: confirmAge === true,
          turnstileToken: turnstileToken?.trim() || undefined,
        }),
      });
    } catch (e) {
      normalizeFetchNetworkError(e);
    }
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      user?: import('../../types').User;
      pending?: boolean;
      emailVerificationRequired?: boolean;
      emailVerificationSent?: boolean;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || res.statusText || 'Erreur réseau');
    }
    return data;
  },

  completeOnboarding: (token: string) =>
    request<{ user: import('../../types').User }>('/auth/complete-onboarding', { method: 'POST' }, token),

  getOAuthProviders: () =>
    request<{ google: boolean; facebook: boolean; youtube: boolean; instagram: boolean; apple: boolean }>('/auth/providers', {}),

  exchangeOAuthCode: (
    code: string,
    opts?: { acceptTerms?: boolean; termsVersion?: string; confirmAge?: boolean }
  ) =>
    request<{
      token?: string;
      user?: import('../../types').User;
      isNew?: boolean;
      pending?: boolean;
      message?: string;
      needsTermsAcceptance?: boolean;
    }>('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({
        code,
        acceptTerms: opts?.acceptTerms,
        termsVersion: opts?.termsVersion,
        confirmAge: opts?.confirmAge === true,
      }),
    }),

  me: (token: string | null) =>
    request<{
      user: import('../../types').User;
      token?: string;
      currentTermsVersion?: string;
      termsReacceptanceRequired?: boolean;
    }>('/auth/me', {}, token),

  acceptTerms: (token: string, termsVersion: string) =>
    request<{ ok: boolean; user: import('../../types').User; termsReacceptanceRequired: boolean }>(
      '/auth/accept-terms',
      { method: 'POST', body: JSON.stringify({ termsVersion }) },
      token
    ),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  toggleGhost: (token: string, isGhostMode: boolean) =>
    request<{ isGhostMode: boolean }>('/auth/ghost-mode', { method: 'PATCH', body: JSON.stringify({ isGhostMode }) }, token),

  checkUsername: (username: string) =>
    request<{ available: boolean; reason: string | null }>(`/auth/check-username?username=${encodeURIComponent(username)}`),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; user?: import('../../types').User }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),

  // ─── Double authentification (TOTP) ────────────────────────────────────────

  setup2FA: (token: string) =>
    request<{ otpauthUrl: string; qrCode: string }>('/auth/2fa/setup', {
      method: 'POST',
    }, token),

  verify2FA: (token: string, code: string) =>
    request<{ ok: boolean; backupCodes: string[] }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  disable2FA: (token: string, code: string) =>
    request<{ ok: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }, token),

  get2FAStatus: (token: string) =>
    request<{ twoFactorEnabled: boolean; backupCodesRemaining: number }>('/auth/2fa/status', {}, token),

  validate2FA: (tempToken: string, code: string) =>
    request<{ token: string; user: import('../../types').User }>('/auth/2fa/validate', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    }),

  deleteAccount: (token: string, body: { password?: string; confirmation?: string }) =>
    request<{ ok: boolean }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(body),
    }, token),

  exportMyData: async (token: string): Promise<unknown> => {
    const res = await fetch(`${API}/auth/me/export`, {
      credentials: 'include',
      headers: headers(token),
    });
    if (!res.ok) {
      const err = await parseApiError(res);
      throw err;
    }
    return res.json();
  },

  updateProfile: (token: string, body: object) =>
    request<{ user: import('../../types').User }>('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }, token),

  getUserProfile: (token: string, userId: string) =>
    request<{ user: import('../../types').User }>(`/auth/profile/${userId}`, {}, token),

  webauthnRegisterOptions: (token: string) =>
    request<import('@simplewebauthn/browser').PublicKeyCredentialCreationOptionsJSON>(
      '/auth/webauthn/register/options',
      { method: 'POST' },
      token,
    ),

  webauthnRegisterVerify: (
    token: string,
    body: import('@simplewebauthn/browser').RegistrationResponseJSON
  ) =>
    request<{ verified: boolean }>(
      '/auth/webauthn/register/verify',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),

  webauthnLoginOptions: () =>
    request<
      import('@simplewebauthn/browser').PublicKeyCredentialRequestOptionsJSON & { sessionId: string }
    >('/auth/webauthn/login/options', { method: 'POST' }),

  webauthnLoginVerify: (
    sessionId: string,
    response: import('@simplewebauthn/browser').AuthenticationResponseJSON
  ) =>
    request<{ token: string; user: import('../../types').User }>(
      '/auth/webauthn/login/verify',
      { method: 'POST', body: JSON.stringify({ response, sessionId }) },
    ),

  webauthnGetCredentials: (token: string) =>
    request<{
      credentials: Array<{
        id: string;
        deviceType: string | null;
        backedUp: boolean;
        createdAt: string;
      }>;
    }>('/auth/webauthn/credentials', {}, token),

  webauthnDeleteCredential: (token: string, credentialId: string) =>
    request<{ ok: boolean }>(
      `/auth/webauthn/credential/${encodeURIComponent(credentialId)}`,
      { method: 'DELETE' },
      token,
    )
} as const;
