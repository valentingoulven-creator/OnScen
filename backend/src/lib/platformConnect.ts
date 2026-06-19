import { ConnectPlatform, MusicPlatform, User } from '../models/schema';

const MUSIC_PLATFORMS = new Set<MusicPlatform>(['spotify', 'youtube']);

function isMusicPlatform(platform: ConnectPlatform): platform is MusicPlatform {
  return MUSIC_PLATFORMS.has(platform as MusicPlatform);
}
import {
  decryptPlatformTokens,
  encryptPlatformTokens,
  decryptToken,
  encryptToken,
} from './tokenEncryption';

export const HOST_PLATFORM_NOT_LINKED = 'HOST_PLATFORM_NOT_LINKED';
export const PARTICIPANT_PLATFORM_NOT_LINKED = 'PARTICIPANT_PLATFORM_NOT_LINKED';

export interface PlatformAccount {
  platform: ConnectPlatform;
  externalUserId: string;
  connectedAt: number;
  /** msdev: jeton simulé ; prod: OAuth access token (serveur uniquement) */
  accessToken?: string;
  refreshToken?: string;
  /** Epoch ms — renouvellement proactif avant expiration Spotify. */
  accessTokenExpiresAt?: number;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  topArtists?: string[];
  /** Scopes OAuth accordés par Spotify (séparés par des espaces). */
  oauthScopes?: string;
  /** Produit Spotify (premium, free, open) — renseigné à l'OAuth et au refresh. */
  spotifyProduct?: string;
}

export function getPlatformAccounts(user: User): PlatformAccount[] {
  return user.platformAccounts ? [...user.platformAccounts] : [];
}

export function syncConnectedPlatforms(user: User): void {
  const platforms = getPlatformAccounts(user)
    .map((a) => a.platform)
    .filter(isMusicPlatform);
  user.connectedPlatforms = platforms.length ? platforms : undefined;
}

export function isPlatformConnected(user: User | undefined, platform: ConnectPlatform): boolean {
  if (!user) return false;
  const accounts = user.platformAccounts;
  if (accounts?.length) {
    if (accounts.some((a) => a.platform === platform)) return true;
  }
  if (!isMusicPlatform(platform)) return false;
  return (user.connectedPlatforms ?? []).includes(platform);
}

export function hostPlatformLinkMessage(platform: MusicPlatform): string {
  return platform === 'spotify'
    ? 'Connectez votre compte Spotify pour héberger ce salon'
    : 'Connectez votre compte YouTube pour héberger ce salon';
}

export function participantPlatformLinkMessage(platform: MusicPlatform): string {
  return platform === 'spotify'
    ? 'Connectez votre compte Spotify pour rejoindre ce salon'
    : 'Connectez votre compte YouTube pour rejoindre ce salon';
}

export function connectPlatformAccount(user: User, platform: ConnectPlatform): PlatformAccount {
  const accounts = getPlatformAccounts(user).map((a) => decryptPlatformTokens(a));
  const entry: PlatformAccount = encryptPlatformTokens({
    platform,
    externalUserId: `msdev_${platform}_${user.id}`,
    connectedAt: Date.now(),
    accessToken: `mock_${platform}_${Date.now()}`,
  });
  const idx = accounts.findIndex((a) => a.platform === platform);
  if (idx >= 0) accounts[idx] = entry;
  else accounts.push(entry);
  user.platformAccounts = accounts;
  syncConnectedPlatforms(user);
  return entry;
}

export function disconnectPlatformAccount(user: User, platform: ConnectPlatform): void {
  user.platformAccounts = getPlatformAccounts(user).filter((a) => a.platform !== platform);
  syncConnectedPlatforms(user);
  if (platform === 'instagram') {
    delete user.instagramHandle;
  }
}

export function isRealPlatformAccount(account: PlatformAccount): boolean {
  const token = decryptToken(account.accessToken);
  return Boolean(token && !token.startsWith('mock_') && !token.startsWith('legacy_'));
}

export function hasRealPlatformConnection(user: User | undefined): boolean {
  if (!user) return false;
  return getPlatformAccounts(user).some((a) => isRealPlatformAccount(a));
}

export function publicPlatformLinks(user: User) {
  return getPlatformAccounts(user).map(
    ({ platform, externalUserId, connectedAt, displayName, avatarUrl, email, topArtists, accessToken }) => ({
      platform,
      externalUserId,
      connectedAt,
      displayName,
      avatarUrl,
      email,
      topArtists,
      isRealOAuth: isRealPlatformAccount({ platform, externalUserId, connectedAt, accessToken }),
    })
  );
}

export function getYoutubeAccessToken(user: User | undefined): string | undefined {
  if (!user) return undefined;
  const account = getPlatformAccounts(user).find((a) => a.platform === 'youtube');
  const token = decryptToken(account?.accessToken);
  if (!token || token.startsWith('mock_') || token.startsWith('legacy_')) return undefined;
  return token;
}

export function isRealYoutubeAccount(user: User | undefined): boolean {
  return Boolean(getYoutubeAccessToken(user));
}

/** Seed / legacy users: backfill platformAccounts from connectedPlatforms */
export function ensurePlatformAccountsFromLegacy(user: User): void {
  if (user.platformAccounts?.length) return;
  const legacy = user.connectedPlatforms ?? [];
  if (!legacy.length) return;
  user.platformAccounts = legacy.map((platform) =>
    encryptPlatformTokens({
      platform,
      externalUserId: `legacy_${platform}_${user.id}`,
      connectedAt: user.memberSince ?? Date.now(),
      accessToken: `legacy_${platform}`,
    })
  );
}

/** Chiffre les jetons OAuth en clair (migration à la connexion). */
export function migratePlaintextPlatformTokens(user: User): void {
  if (!user.platformAccounts?.length) return;
  let changed = false;
  user.platformAccounts = user.platformAccounts.map((a) => {
    const plain = decryptPlatformTokens(a);
    const enc = encryptPlatformTokens(plain);
    if (enc.accessToken !== a.accessToken || enc.refreshToken !== a.refreshToken) {
      changed = true;
    }
    return enc;
  });
  if (changed) {
    // tokens migrés silencieusement
  }
}
