import crypto from 'crypto';

import { User } from '../models/schema';

import {
  connectPlatformAccount,
  disconnectPlatformAccount,
  getPlatformAccounts,
  isPlatformConnected,
} from './platformConnect';

import { savePersistedStore, schedulePersist } from './persist';

import { encryptPlatformTokens, decryptPlatformTokens, decryptToken } from './tokenEncryption';

import {
  isSpotifyPlaybackHostProduct,
  normalizeSpotifyProduct,
  type SpotifyProduct,
} from './spotifyApi';



// Profil + bibliothèque + contrôle lecture (pause/play/seek via Spotify Connect).

// Pas de scope « streaming » : Soundy ne diffuse pas l'audio dans le navigateur (Web Playback SDK non utilisé).

export const SPOTIFY_SCOPES =

  'user-read-email user-read-private user-library-read user-top-read playlist-read-private playlist-read-collaborative user-modify-playback-state user-read-playback-state user-read-currently-playing';

/** Scopes requis pour lancer / contrôler la lecture (Spotify Connect). */
export const SPOTIFY_PLAYBACK_SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
] as const;

export function getMissingSpotifyScopes(grantedScopes?: string): string[] {
  const granted = new Set((grantedScopes ?? '').split(/\s+/).filter(Boolean));
  return SPOTIFY_PLAYBACK_SCOPES.filter((scope) => !granted.has(scope));
}



const TOKEN_EXPIRY_BUFFER_MS = 60_000;



const pendingStates = new Map<string, { userId: string; createdAt: number }>();



export type SpotifyRefreshFailureReason = 'not_connected' | 'invalid_refresh' | 'network' | 'not_configured';



export type SpotifyRefreshResult =

  | { ok: true; accessToken: string }

  | { ok: false; reason: SpotifyRefreshFailureReason };



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



/** Client ID + secret suffisent pour client_credentials (recherche sans jeton utilisateur). */

export function isSpotifyApiConfigured(): boolean {

  return Boolean(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim());

}



function spotifyBasicAuthHeader(): string | null {

  const id = process.env.SPOTIFY_CLIENT_ID?.trim();

  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!id || !secret) return null;

  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;

}



let cachedAppToken: { token: string; expiresAt: number } | null = null;



/** Jeton application (client_credentials) — cache ~50 min. Utilisable pour /v1/search. */

export async function getSpotifyAppAccessToken(): Promise<string | null> {

  const auth = spotifyBasicAuthHeader();

  if (!auth) return null;

  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - 60_000) {

    return cachedAppToken.token;

  }

  try {

    const res = await fetch('https://accounts.spotify.com/api/token', {

      method: 'POST',

      headers: {

        'Content-Type': 'application/x-www-form-urlencoded',

        Authorization: auth,

      },

      body: new URLSearchParams({ grant_type: 'client_credentials' }),

      signal: AbortSignal.timeout(10_000),

    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };

    if (!data.access_token) return null;

    cachedAppToken = {

      token: data.access_token,

      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,

    };

    return data.access_token;

  } catch {

    return null;

  }

}



export function getSpotifyCallbackUrl(): string {

  return process.env.SPOTIFY_CALLBACK_URL!.trim();

}



export function createSpotifyOAuthUrl(userId: string, options?: { forceConsent?: boolean }): string {

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

  if (options?.forceConsent) {
    params.set('show_dialog', 'true');
  }

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

  accessTokenExpiresAt: number;

  oauthScopes?: string;

  avatarUrl?: string;

  email?: string;

  topArtists?: string[];

  spotifyProduct?: SpotifyProduct;

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

    expires_in?: number;

    scope?: string;

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

  let spotifyProduct: SpotifyProduct = 'unknown';



  if (profileRes.ok) {

    const profile = (await profileRes.json()) as {

      id?: string;

      display_name?: string;

      email?: string;

      product?: string;

      images?: Array<{ url?: string }>;

    };

    spotifyUserId = profile.id ?? spotifyUserId;

    displayName = profile.display_name ?? displayName;

    avatarUrl = profile.images?.[0]?.url;

    email = profile.email;

    spotifyProduct = normalizeSpotifyProduct(profile.product);

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

    accessTokenExpiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,

    oauthScopes: tokens.scope?.trim() || SPOTIFY_SCOPES,

    avatarUrl,

    email,

    topArtists,

    spotifyProduct,

  };

}



export async function fetchSpotifyUserProduct(accessToken: string): Promise<SpotifyProduct> {

  try {

    const profileRes = await fetch('https://api.spotify.com/v1/me', {

      headers: { Authorization: `Bearer ${accessToken}` },

      signal: AbortSignal.timeout(8000),

    });

    if (!profileRes.ok) return 'unknown';

    const profile = (await profileRes.json()) as { product?: string };

    return normalizeSpotifyProduct(profile.product);

  } catch {

    return 'unknown';

  }

}



export function getStoredSpotifyProduct(user: User): SpotifyProduct | undefined {

  const account = getPlatformAccounts(user).find((a) => a.platform === 'spotify');

  if (!account?.spotifyProduct) return undefined;

  return normalizeSpotifyProduct(account.spotifyProduct);

}



export function isUserSpotifyPremium(user: User): boolean | undefined {

  const product = getStoredSpotifyProduct(user);

  if (!product || product === 'unknown') return undefined;

  return isSpotifyPlaybackHostProduct(product);

}



export function persistSpotifyProduct(user: User, product: SpotifyProduct): void {

  if (product === 'unknown') return;

  const accounts = getPlatformAccounts(user);

  const idx = accounts.findIndex((a) => a.platform === 'spotify');

  if (idx < 0) return;

  if (accounts[idx].spotifyProduct === product) return;

  accounts[idx] = { ...accounts[idx], spotifyProduct: product };

  user.platformAccounts = accounts;

  schedulePersist();

}



export function applySpotifyOAuthToUser(

  user: User,

  data: {

    accessToken: string;

    refreshToken?: string;

    accessTokenExpiresAt?: number;

    oauthScopes?: string;

    spotifyUserId: string;

    displayName: string;

    avatarUrl?: string;

    email?: string;

    topArtists?: string[];

    spotifyProduct?: SpotifyProduct;

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

      accessTokenExpiresAt: data.accessTokenExpiresAt,

      oauthScopes: data.oauthScopes,

      displayName: data.displayName,

      avatarUrl: data.avatarUrl,

      email: data.email,

      topArtists: data.topArtists,

      ...(data.spotifyProduct && data.spotifyProduct !== 'unknown'

        ? { spotifyProduct: data.spotifyProduct }

        : {}),

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



function isAccessTokenFresh(user: User): boolean {

  const account = getPlatformAccounts(user).find((a) => a.platform === 'spotify');

  if (!account) return false;

  const expiresAt = decryptPlatformTokens(account).accessTokenExpiresAt;

  if (!expiresAt) return false;

  return Date.now() < expiresAt - TOKEN_EXPIRY_BUFFER_MS;

}



/**

 * Renouvelle l'access token Spotify à partir du refresh token stocké.

 * Spotify émet un nouveau refresh token si rotation est activée — on le met

 * à jour si présent dans la réponse.

 */

export async function refreshSpotifyAccessToken(user: User): Promise<SpotifyRefreshResult> {

  const auth = spotifyBasicAuthHeader();

  if (!auth) return { ok: false, reason: 'not_configured' };



  const accounts = getPlatformAccounts(user);

  const idx = accounts.findIndex((a) => a.platform === 'spotify');

  if (idx < 0) return { ok: false, reason: 'not_connected' };



  const decrypted = decryptPlatformTokens(accounts[idx]);

  if (!decrypted.refreshToken) return { ok: false, reason: 'not_connected' };



  let res: Response;

  try {

    res = await fetch('https://accounts.spotify.com/api/token', {

      method: 'POST',

      headers: {

        'Content-Type': 'application/x-www-form-urlencoded',

        Authorization: auth,

      },

      body: new URLSearchParams({

        grant_type: 'refresh_token',

        refresh_token: decrypted.refreshToken,

      }),

      signal: AbortSignal.timeout(10_000),

    });

  } catch {

    return { ok: false, reason: 'network' };

  }



  if (!res.ok) {

    let reason: SpotifyRefreshFailureReason = 'network';

    try {

      const body = (await res.json()) as { error?: string };

      if (res.status === 400 && body.error === 'invalid_grant') {

        reason = 'invalid_refresh';

      }

    } catch {

      // ignore parse errors

    }

    return { ok: false, reason };

  }



  const tokens = (await res.json()) as {

    access_token?: string;

    refresh_token?: string;

    expires_in?: number;

    scope?: string;

  };

  if (!tokens.access_token) return { ok: false, reason: 'network' };



  accounts[idx] = encryptPlatformTokens({

    ...accounts[idx],

    accessToken: tokens.access_token,

    accessTokenExpiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,

    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),

    ...(tokens.scope?.trim() ? { oauthScopes: tokens.scope.trim() } : {}),

  });

  user.platformAccounts = accounts;

  schedulePersist();

  try {
    savePersistedStore();
  } catch (e) {
    console.warn('[spotify-oauth] persist immédiat échoué après refresh:', e);
  }

  const product = await fetchSpotifyUserProduct(tokens.access_token);

  if (product !== 'unknown') {
    persistSpotifyProduct(user, product);
    try {
      savePersistedStore();
    } catch {
      /* ignore */
    }
  }

  return { ok: true, accessToken: tokens.access_token };

}



/** @deprecated Préférer refreshSpotifyAccessToken pour distinguer invalid_grant. */

export async function refreshSpotifyToken(user: User): Promise<string | null> {

  const result = await refreshSpotifyAccessToken(user);

  return result.ok ? result.accessToken : null;

}



/** Jeton hôte valide : renouvellement proactif si expiration connue, sinon refresh à la demande. */

export async function ensureFreshSpotifyAccessToken(user: User): Promise<SpotifyRefreshResult> {

  const token = getSpotifyAccessToken(user);

  if (!token) {

    return refreshSpotifyAccessToken(user);

  }

  if (isAccessTokenFresh(user)) {

    return { ok: true, accessToken: token };

  }

  const refreshed = await refreshSpotifyAccessToken(user);

  if (refreshed.ok) return refreshed;

  if (refreshed.reason === 'invalid_refresh' || refreshed.reason === 'not_connected') {

    return refreshed;

  }

  // Échec transitoire (réseau / config) : conserver le jeton stocké ; les appels API réessaient le refresh sur 401/403.

  return { ok: true, accessToken: token };

}



export type SpotifyHostTokenResult =

  | { ok: true; accessToken: string }

  | { ok: false; reason: SpotifyRefreshFailureReason; disconnected?: boolean };



/** Révoque le lien Spotify côté serveur après refresh impossible (invalid_grant). */

export function disconnectSpotifyOnAuthFailure(user: User, reason: string): void {

  if (!isPlatformConnected(user, 'spotify')) return;

  disconnectPlatformAccount(user, 'spotify');

  schedulePersist();

  try {
    savePersistedStore();
  } catch {
    /* ignore */
  }

  console.warn('[spotify-oauth] auto-disconnect Spotify', { userId: user.id, reason });

}



/**

 * Jeton hôte unifié pour recherche, playlists et load-playlist.

 * Sur invalid_grant : déconnexion automatique pour éviter un faux « compte connecté ».

 */

export async function getValidSpotifyHostToken(user: User): Promise<SpotifyHostTokenResult> {

  const result = await ensureFreshSpotifyAccessToken(user);

  if (result.ok) return result;

  if (result.reason === 'invalid_refresh') {

    disconnectSpotifyOnAuthFailure(user, result.reason);

    return { ok: false, reason: result.reason, disconnected: true };

  }

  console.warn('[spotify-oauth] getValidSpotifyHostToken failed', {

    userId: user.id,

    reason: result.reason,

  });

  return { ok: false, reason: result.reason };

}



export function getStoredSpotifyOAuthScopes(user: User): string | undefined {

  const account = getPlatformAccounts(user).find((a) => a.platform === 'spotify');

  return account?.oauthScopes;

}



export function userNeedsSpotifyScopeReconnect(user: User): boolean {

  if (!isPlatformConnected(user, 'spotify')) return false;

  const account = getPlatformAccounts(user).find((a) => a.platform === 'spotify');

  if (!account?.oauthScopes) return false;

  return getMissingSpotifyScopes(account.oauthScopes).length > 0;

}


