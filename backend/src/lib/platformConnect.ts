import { MusicPlatform, User } from '../models/schema';

export const HOST_PLATFORM_NOT_LINKED = 'HOST_PLATFORM_NOT_LINKED';

export interface PlatformAccount {
  platform: MusicPlatform;
  externalUserId: string;
  connectedAt: number;
  /** msdev: jeton simulé ; prod: OAuth access token (serveur uniquement) */
  accessToken?: string;
}

export function getPlatformAccounts(user: User): PlatformAccount[] {
  return user.platformAccounts ? [...user.platformAccounts] : [];
}

export function syncConnectedPlatforms(user: User): void {
  const platforms = getPlatformAccounts(user).map((a) => a.platform);
  user.connectedPlatforms = platforms.length ? platforms : undefined;
}

export function isPlatformConnected(user: User | undefined, platform: MusicPlatform): boolean {
  if (!user) return false;
  const accounts = user.platformAccounts;
  if (accounts?.length) {
    return accounts.some((a) => a.platform === platform);
  }
  return (user.connectedPlatforms ?? []).includes(platform);
}

export function hostPlatformLinkMessage(platform: MusicPlatform): string {
  return platform === 'spotify'
    ? 'Connectez votre compte Spotify pour héberger ce salon'
    : 'Connectez votre compte YouTube pour héberger ce salon';
}

export function connectPlatformAccount(user: User, platform: MusicPlatform): PlatformAccount {
  const accounts = getPlatformAccounts(user);
  const entry: PlatformAccount = {
    platform,
    externalUserId: `msdev_${platform}_${user.id}`,
    connectedAt: Date.now(),
    accessToken: `mock_${platform}_${Date.now()}`,
  };
  const idx = accounts.findIndex((a) => a.platform === platform);
  if (idx >= 0) accounts[idx] = entry;
  else accounts.push(entry);
  user.platformAccounts = accounts;
  syncConnectedPlatforms(user);
  return entry;
}

export function disconnectPlatformAccount(user: User, platform: MusicPlatform): void {
  user.platformAccounts = getPlatformAccounts(user).filter((a) => a.platform !== platform);
  syncConnectedPlatforms(user);
}

export function publicPlatformLinks(user: User) {
  return getPlatformAccounts(user).map(({ platform, externalUserId, connectedAt }) => ({
    platform,
    externalUserId,
    connectedAt,
  }));
}

/** Seed / legacy users: backfill platformAccounts from connectedPlatforms */
export function ensurePlatformAccountsFromLegacy(user: User): void {
  if (user.platformAccounts?.length) return;
  const legacy = user.connectedPlatforms ?? [];
  if (!legacy.length) return;
  user.platformAccounts = legacy.map((platform) => ({
    platform,
    externalUserId: `legacy_${platform}_${user.id}`,
    connectedAt: user.memberSince ?? Date.now(),
    accessToken: `legacy_${platform}`,
  }));
}
