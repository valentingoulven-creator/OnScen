export function isOAuthOnlyPasswordHash(passwordHash: string): boolean {
  return passwordHash.startsWith('oauth_');
}
