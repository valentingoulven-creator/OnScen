import crypto from 'crypto';
import { User } from '../models/schema';
import {
  connectPlatformAccount,
  disconnectPlatformAccount,
  getPlatformAccounts,
  getYoutubeAccessToken,
} from './platformConnect';
import { decryptPlatformTokens, decryptToken, encryptPlatformTokens } from './tokenEncryption';
import { schedulePersist, savePersistedStore } from './persist';

export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const pendingStates = new Map<string, { userId: string; createdAt: number }>();

function cleanupStates(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}

/** Prefers YOUTUBE_CALLBACK_URL (platform linking); falls back to GOOGLE_REDIRECT_URI. */
export function getYoutubeOAuthRedirectUri(): string {
  const uri = (process.env.YOUTUBE_CALLBACK_URL || process.env.GOOGLE_REDIRECT_URI)?.trim();
  if (!uri) {
    throw new Error('YouTube OAuth redirect URI not configured (YOUTUBE_CALLBACK_URL or GOOGLE_REDIRECT_URI)');
  }
  return uri;
}

export function isYoutubeOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.YOUTUBE_CALLBACK_URL?.trim() || process.env.GOOGLE_REDIRECT_URI?.trim())
  );
}

export function createYoutubeOAuthUrl(userId: string): string {
  cleanupStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { userId, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: getYoutubeOAuthRedirectUri(),
    response_type: 'code',
    scope: YOUTUBE_SCOPE,
    access_type: 'offline',
    // Account chooser + consent (user may have several Google/Gmail accounts)
    prompt: 'select_account consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function fetchYoutubeChannelInfo(
  accessToken: string,
  fallbackUserId?: string
): Promise<{
  channelId: string;
  channelTitle: string;
  avatarUrl?: string;
}> {
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    }
  );
  let channelId = fallbackUserId ? `google_${fallbackUserId}` : 'unknown';
  let channelTitle = 'YouTube';
  let avatarUrl: string | undefined;
  if (channelRes.ok) {
    const ch = (await channelRes.json()) as {
      items?: Array<{
        id?: string;
        snippet?: {
          title?: string;
          thumbnails?: { default?: { url?: string }; medium?: { url?: string } };
        };
      }>;
    };
    channelId = ch.items?.[0]?.id ?? channelId;
    channelTitle = ch.items?.[0]?.snippet?.title ?? channelTitle;
    avatarUrl =
      ch.items?.[0]?.snippet?.thumbnails?.medium?.url ??
      ch.items?.[0]?.snippet?.thumbnails?.default?.url;
  }
  return { channelId, channelTitle, avatarUrl };
}

export async function completeYoutubeOAuth(
  code: string,
  state: string
): Promise<{
  userId: string;
  channelTitle: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  channelId: string;
  avatarUrl?: string;
} | null> {
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending) return null;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: getYoutubeOAuthRedirectUri(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) return null;
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) return null;

  const { channelId, channelTitle, avatarUrl } = await fetchYoutubeChannelInfo(
    tokens.access_token,
    pending.userId
  );

  return {
    userId: pending.userId,
    channelTitle,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    channelId,
    avatarUrl,
  };
}

export function applyYoutubeOAuthToUser(
  user: User,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    channelId: string;
    channelTitle: string;
    avatarUrl?: string;
  }
): void {
  connectPlatformAccount(user, 'youtube');
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'youtube');
  if (idx >= 0) {
    accounts[idx] = encryptPlatformTokens({
      ...accounts[idx],
      externalUserId: data.channelId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessTokenExpiresAt: data.expiresIn != null ? Date.now() + (data.expiresIn - 60) * 1000 : undefined,
      displayName: data.channelTitle,
      avatarUrl: data.avatarUrl,
      // Trace d'audit : scope exact accordé à cette connexion (utile pour une vérification Google).
      oauthScopes: YOUTUBE_SCOPE,
    });
    user.platformAccounts = accounts;
  }
}

export type YoutubeRefreshFailureReason =
  | 'not_connected'
  | 'invalid_refresh'
  | 'not_configured'
  | 'network';

export type YoutubeRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: YoutubeRefreshFailureReason };

export function disconnectYoutubeOnAuthFailure(user: User, reason: string): void {
  const accounts = getPlatformAccounts(user);
  if (!accounts.some((a) => a.platform === 'youtube')) return;
  disconnectPlatformAccount(user, 'youtube');
  schedulePersist();
  try {
    savePersistedStore();
  } catch {
    /* ignore */
  }
  console.warn('[youtube-oauth] auto-disconnect YouTube', { userId: user.id, reason });
}

async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* best effort */
  }
}

/** Révoque le jeton Google puis déconnecte localement. */
export async function revokeAndDisconnectYoutube(user: User): Promise<void> {
  const accounts = getPlatformAccounts(user);
  const account = accounts.find((a) => a.platform === 'youtube');
  const refresh = account ? decryptToken(decryptPlatformTokens(account).refreshToken) : undefined;
  const access = account ? decryptToken(decryptPlatformTokens(account).accessToken) : undefined;
  if (refresh) await revokeGoogleToken(refresh);
  else if (access) await revokeGoogleToken(access);
  disconnectPlatformAccount(user, 'youtube');
  schedulePersist();
}

async function refreshYoutubeAccessToken(user: User): Promise<YoutubeRefreshResult> {
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'youtube');
  if (idx < 0) return { ok: false, reason: 'not_connected' };

  const decrypted = decryptPlatformTokens(accounts[idx]);
  const existingToken = decrypted.accessToken;
  const isMockOrLegacy =
    !existingToken || existingToken.startsWith('mock_') || existingToken.startsWith('legacy_');
  if (isMockOrLegacy) return { ok: false, reason: 'not_connected' };

  const refreshToken = decryptToken(decrypted.refreshToken);
  if (!refreshToken) return { ok: false, reason: 'invalid_refresh' };

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return { ok: false, reason: 'not_configured' };

  let tokenRes: Response;
  try {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  if (!tokenRes.ok) {
    let reason: YoutubeRefreshFailureReason = 'network';
    try {
      const body = (await tokenRes.json()) as { error?: string };
      if (tokenRes.status === 400 && body.error === 'invalid_grant') {
        reason = 'invalid_refresh';
      }
    } catch {
      /* ignore */
    }
    return { ok: false, reason };
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) return { ok: false, reason: 'network' };

  accounts[idx] = encryptPlatformTokens({
    ...decrypted,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? decrypted.refreshToken,
    accessTokenExpiresAt:
      tokens.expires_in != null
        ? Date.now() + (tokens.expires_in - 60) * 1000
        : decrypted.accessTokenExpiresAt,
  });
  user.platformAccounts = accounts;
  schedulePersist();
  try {
    savePersistedStore();
  } catch (e) {
    console.warn('[youtube-oauth] persist immédiat échoué après refresh:', e);
  }

  return { ok: true, accessToken: tokens.access_token };
}

export type YoutubeHostTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: YoutubeRefreshFailureReason; disconnected?: boolean };

export async function getValidYoutubeHostToken(user: User): Promise<YoutubeHostTokenResult> {
  const token = getYoutubeAccessToken(user);
  const accounts = getPlatformAccounts(user);
  const account = accounts.find((a) => a.platform === 'youtube');
  const decrypted = account ? decryptPlatformTokens(account) : undefined;
  const expiresAt = decrypted?.accessTokenExpiresAt;

  if (token && expiresAt != null && Date.now() < expiresAt) {
    return { ok: true, accessToken: token };
  }

  const refreshed = await refreshYoutubeAccessToken(user);
  if (refreshed.ok) return refreshed;

  if (refreshed.reason === 'invalid_refresh') {
    disconnectYoutubeOnAuthFailure(user, refreshed.reason);
    return { ok: false, reason: refreshed.reason, disconnected: true };
  }

  if (token) return { ok: true, accessToken: token };
  return { ok: false, reason: refreshed.reason };
}

export async function probeYoutubeHostSession(
  user: User
): Promise<{ ok: true } | { ok: false; code: string }> {
  const accounts = getPlatformAccounts(user);
  if (!accounts.some((a) => a.platform === 'youtube')) {
    return { ok: false, code: 'youtube_not_connected' };
  }
  const result = await getValidYoutubeHostToken(user);
  if (result.ok) return { ok: true };
  if (result.reason === 'invalid_refresh' || result.disconnected) {
    return { ok: false, code: 'youtube_token_expired' };
  }
  if (result.reason === 'not_connected') {
    return { ok: false, code: 'youtube_not_connected' };
  }
  return { ok: false, code: 'youtube_network_error' };
}

/** Returns a valid YouTube access token, refreshing via refresh_token when needed. */
export async function ensureYoutubeAccessToken(user: User): Promise<string | undefined> {
  const result = await getValidYoutubeHostToken(user);
  return result.ok ? result.accessToken : undefined;
}
