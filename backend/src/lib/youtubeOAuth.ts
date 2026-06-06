import crypto from 'crypto';
import { User } from '../models/schema';
import { connectPlatformAccount, getPlatformAccounts } from './platformConnect';

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const pendingStates = new Map<string, { userId: string; createdAt: number }>();

function cleanupStates(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}

export function isYoutubeOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REDIRECT_URI?.trim()
  );
}

export function getYoutubeOAuthRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI!.trim();
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

export async function completeYoutubeOAuth(
  code: string,
  state: string
): Promise<{
  userId: string;
  channelTitle: string;
  accessToken: string;
  refreshToken?: string;
  channelId: string;
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
  };
  if (!tokens.access_token) return null;

  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    }
  );
  let channelId = `google_${pending.userId}`;
  let channelTitle = 'YouTube';
  if (channelRes.ok) {
    const ch = (await channelRes.json()) as {
      items?: Array<{ id?: string; snippet?: { title?: string } }>;
    };
    channelId = ch.items?.[0]?.id ?? channelId;
    channelTitle = ch.items?.[0]?.snippet?.title ?? channelTitle;
  }

  return {
    userId: pending.userId,
    channelTitle,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    channelId,
  };
}

export function applyYoutubeOAuthToUser(
  user: User,
  data: {
    accessToken: string;
    refreshToken?: string;
    channelId: string;
    channelTitle: string;
  }
): void {
  connectPlatformAccount(user, 'youtube');
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'youtube');
  if (idx >= 0) {
    accounts[idx] = {
      ...accounts[idx],
      externalUserId: data.channelId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      displayName: data.channelTitle,
    };
    user.platformAccounts = accounts;
  }
}
