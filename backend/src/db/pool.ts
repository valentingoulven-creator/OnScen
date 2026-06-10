import { Pool, type PoolClient, type PoolConfig } from 'pg';

let pool: Pool | null = null;

export function isPostgresEnabled(): boolean {
  return (
    process.env.APP_ENV === 'production' &&
    Boolean(process.env.DATABASE_URL?.trim())
  );
}

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url || null;
}

export function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL est requis pour la persistance PostgreSQL');
    }

    const config: PoolConfig = {
      connectionString,

      // ── Taille du pool ──────────────────────────────────────────
      // PG_POOL_MAX=20 recommandé pour Scaleway DB-DEV-S (max_connections=100)
      // Laisser de la marge pour pgBouncer ou d'autres clients
      max: Number(process.env.PG_POOL_MAX) || 10,

      // ── Timeouts ────────────────────────────────────────────────
      // Délai max pour obtenir une connexion depuis le pool
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 10_000,
      // Délai avant qu'une connexion idle soit fermée et retirée du pool
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30_000,
      // Timeout au niveau requête Node (driver) — dernier recours
      query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS) || 60_000,
      // Keepalive TCP pour détecter les connexions drop (réseau Scaleway)
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    };

    if (process.env.PG_SSL === '1' || process.env.PG_SSL === 'true') {
      config.ssl = {
        rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== '0',
      };
    }

    pool = new Pool(config);

    // ── statement_timeout par connexion ─────────────────────────
    // Tue les requêtes SQL qui dépassent 30 s (défaut) côté PostgreSQL.
    // Plus fiable que query_timeout côté Node pour les requêtes longues.
    pool.on('connect', (client: PoolClient) => {
      const statementTimeout = Number(process.env.PG_STATEMENT_TIMEOUT_MS) || 30_000;
      client.query(`SET statement_timeout = ${statementTimeout}`).catch((err) => {
        console.warn('[soundly] Impossible de définir statement_timeout :', err.message);
      });
    });

    pool.on('error', (err) => {
      console.error('[soundly] Erreur pool PostgreSQL :', err.message);
    });

    // Log au démarrage pour confirmer la config
    console.log(
      `[soundly] Pool PostgreSQL initialisé — max=${config.max} ` +
      `idle=${config.idleTimeoutMillis}ms conn=${config.connectionTimeoutMillis}ms ` +
      `ssl=${config.ssl ? 'oui' : 'non'}`
    );
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  try {
    await current.end();
  } catch (err) {
    console.warn('[soundly] Erreur à la fermeture du pool PostgreSQL :', err);
  }
}

/**
 * Vérifie que la connexion PostgreSQL est opérationnelle.
 * Utilisé par un éventuel healthcheck HTTP (/health).
 */
export async function checkPoolHealth(): Promise<boolean> {
  try {
    const p = getPool();
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
