/** Comptes créés via Google/Facebook OAuth (mot de passe factice, non bcrypt). */
export function isOAuthOnlyPasswordHash(passwordHash: string): boolean {
  return passwordHash.startsWith('oauth_');
}
