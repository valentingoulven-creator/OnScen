import type { Pool, PoolClient } from 'pg';
import { getPool, isPostgresEnabled } from '../db/pool';
import type { DirectMessage } from '../models/schema';

type DbExec = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

export async function upsertDirectMessage(dbExec: DbExec, dm: DirectMessage): Promise<void> {
  await dbExec.query(
    `INSERT INTO direct_messages (id, payload) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
    [dm.id, JSON.stringify(dm)]
  );
}

export async function deleteDirectMessageFromPg(dbExec: DbExec, messageId: string): Promise<void> {
  await dbExec.query('DELETE FROM direct_messages WHERE id = $1', [messageId]);
}

export function schedulePersistDirectMessageToPg(dm: DirectMessage): void {
  if (!isPostgresEnabled()) return;
  void upsertDirectMessage(getPool(), dm).catch((e) => {
    console.error('[pgDirectMessages] Échec upsert DM PostgreSQL:', e);
  });
}

export function scheduleDeleteDirectMessageFromPg(messageId: string): void {
  if (!isPostgresEnabled()) return;
  void deleteDirectMessageFromPg(getPool(), messageId).catch((e) => {
    console.error('[pgDirectMessages] Échec suppression DM PostgreSQL:', e);
  });
}

/**
 * Upsert intégral des DMs en RAM — AUCUN DELETE global sur la table, à
 * l'image de `writeUsersToPg` pour `users` (voir commentaire sur `writeStore`
 * dans `pgStore.ts`).
 *
 * ⚠️ Ce sync ne doit JAMAIS supprimer un DM absent de `dms` : depuis l'ajout
 * du cap RAM par paire (`trimDirectMessages` dans `chatHistory.ts`, appelé
 * par `purgeUnboundedChatHistory` avant chaque snapshot), `dms` ne contient
 * plus l'historique complet — seulement les N derniers messages par paire.
 * Un DELETE-par-diff basé sur ce snapshot tronqué effacerait définitivement
 * de PostgreSQL tout l'historique DM au-delà du cap à chaque flush (10 s).
 * La suppression individuelle d'un DM (action utilisateur) passe déjà par
 * `scheduleDeleteDirectMessageFromPg` (voir routes/dm.ts) — c'est le seul
 * chemin de suppression légitime.
 */
export async function syncDirectMessagesToPg(
  client: PoolClient,
  dms: DirectMessage[]
): Promise<void> {
  for (const dm of dms) {
    await upsertDirectMessage(client, dm);
  }
}
