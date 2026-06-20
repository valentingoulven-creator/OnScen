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

export function canUseMockPlatformConnect(user: User | undefined): boolean {
  if (!user) return false;
  const allow = parseMockPlatformConnectUsernames();
  if (!allow.size) return false;
  return allow.has(user.username.trim().toLowerCase());
}
