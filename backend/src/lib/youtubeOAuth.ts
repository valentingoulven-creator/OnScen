import crypto from 'crypto';
import { User } from '../models/schema';
import {
  connectPlatformAccount,
  getPlatformAccounts,
  getYoutubeAccessToken,
} from './platformConnect';
import { decryptPlatformTokens, decryptToken, encryptPlatformTokens } from './tokenEncryption';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

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
    prompt: 'consent',
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
    });
    user.platformAccounts = accounts;
  }
}

/** Returns a valid YouTube access token, refreshing via refresh_token when needed.
 *
 * Refresh logic:
 * - If `accessTokenExpiresAt` is set and the token is still fresh → return it as-is.
 * - If `accessTokenExpiresAt` is missing (legacy account) or the token is expired → attempt
 *   a token refresh using the stored refresh_token. This handles both newly-expired tokens
 *   and legacy accounts that were connected before expiry tracking was introduced.
 * - If the refresh fails (network error, invalid grant, etc.) → fall back to the stored
 *   token so the caller can still attempt the API call (token may still be valid).
 */
export async function ensureYoutubeAccessToken(user: User): Promise<string | undefined> {
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'youtube');
  if (idx < 0) return undefined;

  const decrypted = decryptPlatformTokens(accounts[idx]);
  const existingToken = decrypted.accessToken;
  const isMockOrLegacy =
    !existingToken || existingToken.startsWith('mock_') || existingToken.startsWith('legacy_');

  if (!isMockOrLegacy) {
    const expiresAt = decrypted.accessTokenExpiresAt;
    // Token is fresh and we know the expiry → return it without refreshing.
    if (expiresAt != null && Date.now() < expiresAt) return existingToken;
    // expiresAt == null means legacy account (no expiry tracked yet) → fall through to refresh.
    // expiresAt in the past means expired → fall through to refresh.
  }

  const refreshToken = decryptToken(decrypted.refreshToken);
  if (!refreshToken) {
    // No refresh token available. For a real (non-mock) account return the existing token as a
    // last resort — it might still be valid (e.g. expiry timestamp was slightly off, server clock
    // skew, or the token is actually fresh but we had no expiry info).
    return isMockOrLegacy ? undefined : existingToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return isMockOrLegacy ? undefined : existingToken;

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
    return isMockOrLegacy ? undefined : existingToken;
  }

  if (!tokenRes.ok) return isMockOrLegacy ? undefined : existingToken;
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) return isMockOrLegacy ? undefined : existingToken;

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
  return tokens.access_token;
}
