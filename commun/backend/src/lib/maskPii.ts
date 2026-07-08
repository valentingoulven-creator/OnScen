/**
 * Masquage partiel d'informations personnelles pour les logs console des
 * scripts d'administration/seed (voir audit RGPD-4 : e-mails en clair dans
 * des console.log de scripts exécutés manuellement, potentiellement
 * centralisés en environnement partagé).
 */

/**
 * `jean.dupont@example.com` → `j***@example.com`.
 * Conserve le domaine (utile pour distinguer les comptes démo/msdev) et la
 * première lettre du nom d'utilisateur, masque le reste.
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '(inconnu)';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
