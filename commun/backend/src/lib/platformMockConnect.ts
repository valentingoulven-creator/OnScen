import type { User } from '../models/schema';

/** Comptes autorisés à la connexion YouTube simulée en prod (tests sans OAuth Google). */
function parseMockPlatformConnectUsernames(): Set<string> {
  const raw = process.env.MOCK_PLATFORM_CONNECT_USERNAMES?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;]/)
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isProductionAppEnv(): boolean {
  return process.env.APP_ENV?.trim().toLowerCase() === 'production';
}

export function canUseMockPlatformConnect(user: User | undefined): boolean {
  if (!user) return false;
  if (!isProductionAppEnv()) return true;
  const allow = parseMockPlatformConnectUsernames();
  if (!allow.size) return false;
  return allow.has(user.username.trim().toLowerCase());
}
