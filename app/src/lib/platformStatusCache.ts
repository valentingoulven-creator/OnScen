export type PlatformStatusResponse = {
  links: Array<{
    platform: 'youtube' | 'instagram';
    externalUserId: string;
    connectedAt: number;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
    topArtists?: string[];
    isRealOAuth?: boolean;
  }>;
  connectedPlatforms: ('youtube')[];
  youtubeOAuthAvailable: boolean;
  youtubeMockConnectAvailable?: boolean;
  instagramOAuthAvailable: boolean;
  oauthConfigured?: boolean;
  platformConnectionRequired?: boolean;
  hasRealPlatformConnection?: boolean;
  youtubeSessionValid?: boolean;
  youtubeSessionCode?: string;
};

const TTL_MS = 25_000;

let cache: { token: string; fetchedAt: number; data: PlatformStatusResponse } | null = null;

export function readCachedPlatformStatus(token: string): PlatformStatusResponse | null {
  if (!cache || cache.token !== token) return null;
  if (Date.now() - cache.fetchedAt > TTL_MS) return null;
  return cache.data;
}

export function writeCachedPlatformStatus(token: string, data: PlatformStatusResponse): void {
  cache = { token, fetchedAt: Date.now(), data };
}

export function invalidatePlatformStatusCache(): void {
  cache = null;
}
