/**
 * Auth token storage — Capacitor native (Keychain / Android Keystore).
 *
 * Overrides app/src/lib/authStorage.ts in apptel builds.
 * Migrates legacy localStorage tokens on first launch.
 */

import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const TOKEN_KEY = 'melosong_token';
const REMEMBER_KEY = 'melosong_remember_me';
const SESSION_TOKEN_KEY = 'melosong_token_session';

let cachedToken: string | null = null;
let initDone = false;

function isNativePlatform(): boolean {
  try {
    return !!(
      (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
        .Capacitor?.isNativePlatform?.()
    );
  } catch {
    return false;
  }
}

async function readRememberMe(): Promise<boolean> {
  const { value } = await Preferences.get({ key: REMEMBER_KEY });
  return value === '1' || value === null;
}

async function migrateLegacyStorage(): Promise<string | null> {
  const remember = localStorage.getItem(REMEMBER_KEY);
  const session = sessionStorage.getItem(TOKEN_KEY);
  const local = localStorage.getItem(TOKEN_KEY);
  const legacy =
    session ||
    (local && (remember === '1' || remember === null) ? local : null);

  if (!legacy) return null;

  const rememberMe = remember !== '0';
  await persistToken(legacy, rememberMe);

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);

  return legacy;
}

async function readSecureToken(rememberMe: boolean): Promise<string | null> {
  const key = rememberMe ? TOKEN_KEY : SESSION_TOKEN_KEY;
  try {
    const value = await SecureStorage.get(key);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Loads JWT from secure storage (async). Call once before auth boot on native.
 */
export async function initAuthStorage(): Promise<string | null> {
  if (!isNativePlatform()) return null;
  if (initDone) return cachedToken;

  const rememberMe = await readRememberMe();
  let token = await readSecureToken(rememberMe);
  if (!token) token = await migrateLegacyStorage();

  cachedToken = token;
  initDone = true;
  return token;
}

/** In-memory cache after initAuthStorage(); null before init completes. */
export function getStoredToken(): string | null {
  if (!isNativePlatform()) return null;
  return cachedToken;
}

export async function persistToken(token: string, rememberMe: boolean): Promise<void> {
  if (!isNativePlatform()) return;

  cachedToken = token;
  initDone = true;

  await Preferences.set({ key: REMEMBER_KEY, value: rememberMe ? '1' : '0' });

  try {
    await SecureStorage.remove(TOKEN_KEY);
    await SecureStorage.remove(SESSION_TOKEN_KEY);
  } catch {
    /* first write */
  }

  const key = rememberMe ? TOKEN_KEY : SESSION_TOKEN_KEY;
  await SecureStorage.set(key, token);
}

export async function clearStoredToken(): Promise<void> {
  if (!isNativePlatform()) return;

  cachedToken = null;
  initDone = true;

  try {
    await SecureStorage.remove(TOKEN_KEY);
    await SecureStorage.remove(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  await Preferences.remove({ key: REMEMBER_KEY });

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

export { isNativePlatform };
