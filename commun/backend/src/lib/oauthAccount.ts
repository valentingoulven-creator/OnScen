export function isOAuthOnlyPasswordHash(passwordHash: string): boolean {
  return passwordHash.startsWith('oauth_');
}

/** Connexion OAuth : pas de mot de passe app à changer (compte Google/Apple/Facebook). */
export function clearPasswordChangeRequiredForOAuthLogin(user: {
  mustChangePassword?: boolean;
}): void {
  if (user.mustChangePassword) {
    user.mustChangePassword = false;
  }
}
