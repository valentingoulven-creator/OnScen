import { getPool, isPostgresEnabled } from '../db/pool';

/**
 * Purge PostgreSQL rows tied to a user (post-RAM cascade).
 *
 * Historique financier/comptable (audit DB/infra §2 — Critical) : on ne
 * supprime PLUS ici les lignes de `creator_subscriptions`,
 * `subscription_checkouts` ni `donation_payments` — c'était une double
 * destruction de l'historique de paiement Stripe (en plus de l'ancienne
 * ON DELETE CASCADE côté FK). Depuis la migration 028, ces FK sont en
 * ON DELETE SET NULL : la suppression de l'utilisateur (plus bas dans le
 * flux, via `removeUserFromPg`) anonymise automatiquement ces lignes
 * (sender_id/subscriber_id/creator_id passent à NULL) sans effacer les
 * pièces comptables. Seules les données de session (credentials WebAuthn,
 * abonnements push) — sans valeur d'historique — sont supprimées ici.
 */
export async function purgeUserAccountFromPg(userId: string): Promise<void> {
  if (!isPostgresEnabled()) return;
  const pool = getPool();

  await pool.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
}
