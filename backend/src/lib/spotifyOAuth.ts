import crypto from 'crypto';
import { User } from '../models/schema';
import { connectPlatformAccount, getPlatformAccounts } from './platformConnect';
import { encryptPlatformTokens, decryptPlatformTokens, decryptToken } from './tokenEncryption';

const SPOTIFY_SCOPES =
  'user-read-email user-read-private user-library-read user-top-read playlist-read-private';

const pendingStates = new Map<string, { userId: string; createdAt: number }>();

function cleanupStates(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}

export function isSpotifyOAuthConfigured(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() &&
      process.env.SPOTIFY_CLIENT_SECRET?.trim() &&
      process.env.SPOTIFY_CALLBACK_URL?.trim()
  );
}

export function getSpotifyCallbackUrl(): string {
  return process.env.SPOTIFY_CALLBACK_URL!.trim();
}

export function createSpotifyOAuthUrl(userId: string): string {
  cleanupStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { userId, createdAt: Date.now() });
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!.trim(),
    response_type: 'code',
    redirect_uri: getSpotifyCallbackUrl(),
    scope: SPOTIFY_SCOPES,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function completeSpotifyOAuth(
  code: string,
  state: string
): Promise<{
  userId: string;
  displayName: string;
  spotifyUserId: string;
  accessToken: string;
  refreshToken?: string;
  avatarUrl?: string;
  email?: string;
  topArtists?: string[];
} | null> {
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending) return null;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!.trim()}:${process.env.SPOTIFY_CLIENT_SECRET!.trim()}`
  ).toString('base64');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getSpotifyCallbackUrl(),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) return null;

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!tokens.access_token) return null;

  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(8000),
  });

  let spotifyUserId = `spotify_${pending.userId}`;
  let displayName = 'Spotify';
  let avatarUrl: string | undefined;
  let email: string | undefined;
  let topArtists: string[] | undefined;

  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      id?: string;
      display_name?: string;
      email?: string;
      images?: Array<{ url?: string }>;
    };
    spotifyUserId = profile.id ?? spotifyUserId;
    displayName = profile.display_name ?? displayName;
    avatarUrl = profile.images?.[0]?.url;
    email = profile.email;
  }

  try {
    const topRes = await fetch(
      'https://api.spotify.com/v1/me/top/artists?limit=5&time_range=medium_term',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (topRes.ok) {
      const top = (await topRes.json()) as { items?: Array<{ name?: string }> };
      const names = (top.items ?? [])
        .map((a) => a.name?.trim())
        .filter((n): n is string => Boolean(n));
      if (names.length) topArtists = names;
    }
  } catch {
    // best-effort
  }

  return {
    userId: pending.userId,
    displayName,
    spotifyUserId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    avatarUrl,
    email,
    topArtists,
  };
}

export function applySpotifyOAuthToUser(
  user: User,
  data: {
    accessToken: string;
    refreshToken?: string;
    spotifyUserId: string;
    displayName: string;
    avatarUrl?: string;
    email?: string;
    topArtists?: string[];
  }
): void {
  connectPlatformAccount(user, 'spotify');
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'spotify');
  if (idx >= 0) {
    accounts[idx] = encryptPlatformTokens({
      ...accounts[idx],
      externalUserId: data.spotifyUserId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      email: data.email,
      topArtists: data.topArtists,
    });
    user.platformAccounts = accounts;
  }
}

export function getSpotifyAccessToken(user: User | undefined): string | undefined {
  if (!user) return undefined;
  const account = getPlatformAccounts(user).find((a) => a.platform === 'spotify');
  const token = decryptToken(account?.accessToken);
  if (!token || token.startsWith('mock_') || token.startsWith('legacy_')) return undefined;
  return token;
}

export function isRealSpotifyAccount(user: User | undefined): boolean {
  return Boolean(getSpotifyAccessToken(user));
}

/**
 * Renouvelle l'access token Spotify à partir du refresh token stocké.
 * Spotify émet un nouveau refresh token si rotation est activée — on le met
 * à jour si présent dans la réponse.
 */
export async function refreshSpotifyToken(user: User): Promise<string | null> {
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'spotify');
  if (idx < 0) return null;

  const decrypted = decryptPlatformTokens(accounts[idx]);
  if (!decrypted.refreshToken) return null;

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID!.trim()}:${process.env.SPOTIFY_CLIENT_SECRET!.trim()}`
  ).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decrypted.refreshToken,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token) return null;

  accounts[idx] = encryptPlatformTokens({
    ...accounts[idx],
    accessToken: tokens.access_token,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
  });
  user.platformAccounts = accounts;
  return tokens.access_token;
}
