import fs from 'fs';
import path from 'path';
import { getPool } from './pool';

function getMigrationsDir(): string {
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '../db/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

function parseMigrationVersion(filename: string): number | null {
  const m = filename.match(/^(\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Bootstrap : crée schema_migrations si inexistant (première exécution)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INTEGER      PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    const dir = getMigrationsDir();
    if (!fs.existsSync(dir)) {
      throw new Error(`Répertoire migrations introuvable : ${dir}`);
    }

    // Récupère les migrations déjà appliquées
    const { rows } = await client.query<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const applied = new Set(rows.map((r) => r.version));

    // Trie les fichiers .sql par numéro de version croissant
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      const version = parseMigrationVersion(filename);
      if (version === null) {
        console.warn(`[onscen] Fichier migration ignoré (pas de numéro) : ${filename}`);
        continue;
      }
      if (applied.has(version)) continue;

      const sql = fs.readFileSync(path.join(dir, filename), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING',
          [version]
        );
        await client.query('COMMIT');
        console.log(`[onscen] Migration v${version} (${filename}) appliquée`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[onscen] Échec migration v${version} (${filename}) :`, err);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
