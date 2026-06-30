import crypto from 'crypto';
import { User } from '../models/schema';
import { connectPlatformAccount, getPlatformAccounts } from './platformConnect';
import { encryptPlatformTokens } from './tokenEncryption';

const FB_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const INSTAGRAM_SCOPES = 'instagram_basic,pages_show_list,public_profile';

const pendingStates = new Map<string, { userId: string; createdAt: number }>();

function cleanupStates(): void {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}

export function getInstagramCallbackUrl(): string {
  const explicit = process.env.INSTAGRAM_CALLBACK_URL?.trim();
  if (explicit) return explicit;
  const webApp = process.env.WEB_APP_URL?.trim();
  if (webApp) return `${webApp.replace(/\/$/, '')}/api/auth/instagram/callback`;
  return '';
}

export function isInstagramOAuthConfigured(): boolean {
  return Boolean(
    process.env.FACEBOOK_APP_ID?.trim() &&
      process.env.FACEBOOK_APP_SECRET?.trim() &&
      getInstagramCallbackUrl()
  );
}

export function createInstagramOAuthUrl(userId: string): string {
  cleanupStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { userId, createdAt: Date.now() });
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!.trim(),
    redirect_uri: getInstagramCallbackUrl(),
    state,
    scope: INSTAGRAM_SCOPES,
    response_type: 'code',
  });
  return `${FB_AUTH_URL}?${params}`;
}

interface InstagramProfile {
  instagramUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile | null> {
  const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/accounts');
  accountsUrl.searchParams.set(
    'fields',
    'instagram_business_account{id,username,name,profile_picture_url}'
  );
  accountsUrl.searchParams.set('access_token', accessToken);

  const res = await fetch(accountsUrl.toString(), { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    data?: Array<{
      instagram_business_account?: {
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };
    }>;
  };

  for (const page of data.data ?? []) {
    const ig = page.instagram_business_account;
    if (ig?.id && ig.username) {
      return {
        instagramUserId: ig.id,
        username: ig.username.replace(/^@/, ''),
        displayName: ig.name?.trim() || `@${ig.username.replace(/^@/, '')}`,
        avatarUrl: ig.profile_picture_url,
      };
    }
  }

  return null;
}

export async function completeInstagramOAuth(
  code: string,
  state: string
): Promise<{
  userId: string;
  accessToken: string;
  instagramUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
} | null> {
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!pending) return null;

  const tokenRes = await fetch(FB_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!.trim(),
      client_secret: process.env.FACEBOOK_APP_SECRET!.trim(),
      redirect_uri: getInstagramCallbackUrl(),
      code,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) return null;

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return null;

  const profile = await fetchInstagramProfile(tokens.access_token);
  if (!profile) return null;

  return {
    userId: pending.userId,
    accessToken: tokens.access_token,
    instagramUserId: profile.instagramUserId,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };
}

export function applyInstagramOAuthToUser(
  user: User,
  data: {
    accessToken: string;
    instagramUserId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  }
): void {
  connectPlatformAccount(user, 'instagram');
  const accounts = getPlatformAccounts(user);
  const idx = accounts.findIndex((a) => a.platform === 'instagram');
  if (idx >= 0) {
    accounts[idx] = encryptPlatformTokens({
      ...accounts[idx],
      externalUserId: data.instagramUserId,
      accessToken: data.accessToken,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    });
    user.platformAccounts = accounts;
  }
  user.instagramHandle = data.username;
}
