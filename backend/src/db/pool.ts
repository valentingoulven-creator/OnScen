import { Pool, type PoolConfig } from 'pg';

let pool: Pool | null = null;

export function isPostgresEnabled(): boolean {
  const env = process.env.APP_ENV;
  return (
    (env === 'production' || env === 'preproduction') &&
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

    // ── statement_timeout défini comme paramètre de démarrage PostgreSQL ──
    // Évite le problème de requête fire-and-forget dans pool.on('connect')
    // qui pouvait provoquer des DeprecationWarnings pg (concurrent client queries).
    const statementTimeout = Number(process.env.PG_STATEMENT_TIMEOUT_MS) || 30_000;

    const config: PoolConfig = {
      connectionString,

      // Paramètre de démarrage PostgreSQL — défini avant toute requête sur la connexion.
      options: `-c statement_timeout=${statementTimeout}`,

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

    pool.on('error', (err) => {
      console.error('[soundy] Erreur pool PostgreSQL :', err.message);
    });

    // Log au démarrage pour confirmer la config
    console.log(
      `[soundy] Pool PostgreSQL initialisé — max=${config.max} ` +
      `idle=${config.idleTimeoutMillis}ms conn=${config.connectionTimeoutMillis}ms ` +
      `ssl=${config.ssl ? 'oui' : 'non'} statement_timeout=${statementTimeout}ms`
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
    console.warn('[soundy] Erreur à la fermeture du pool PostgreSQL :', err);
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
