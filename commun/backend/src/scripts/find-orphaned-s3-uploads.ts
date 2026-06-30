/**
 * Audit des fichiers orphelins dans le bucket S3 (Scaleway Object Storage).
 *
 * Liste tous les objets du bucket S3_BUCKET, puis vérifie pour chacun s'il est
 * référencé par au moins une ligne `payload` (JSONB) dans les tables PostgreSQL
 * connues pour stocker des médias utilisateurs. Les objets non référencés et
 * plus vieux que ORPHAN_MIN_AGE_DAYS sont considérés orphelins (le délai évite
 * de signaler un upload tout juste effectué dont l'enregistrement DB n'est pas
 * encore committé).
 *
 * Mode dry-run par défaut — n'efface RIEN. Affiche un rapport + un script
 * shell (`aws s3 rm` / `mc rm`) à exécuter manuellement après revue humaine.
 *
 * Usage :
 *   npx ts-node src/scripts/find-orphaned-s3-uploads.ts
 *   npx ts-node src/scripts/find-orphaned-s3-uploads.ts --min-age-days=14
 */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  S3Client,
  ListObjectsV2Command,
  type _Object as S3Object,
} from '@aws-sdk/client-s3';

dotenv.config();

const DEFAULT_MIN_AGE_DAYS = 7;

const TABLES_WITH_MEDIA_PAYLOAD = [
  'users',
  'feed_posts',
  'feed_post_comments',
  'stories',
  'user_reels',
  'user_albums',
  'user_compositions',
  'direct_messages',
  'group_messages',
  'message_groups',
  'sponsors',
  'support_contact_messages',
];

function parseArgs(): { minAgeDays: number } {
  const arg = process.argv.find((a) => a.startsWith('--min-age-days='));
  const minAgeDays = arg ? Number(arg.split('=')[1]) : DEFAULT_MIN_AGE_DAYS;
  return { minAgeDays: Number.isFinite(minAgeDays) && minAgeDays >= 0 ? minAgeDays : DEFAULT_MIN_AGE_DAYS };
}

async function collectReferencedKeys(pool: Pool, publicBase: string): Promise<Set<string>> {
  const referenced = new Set<string>();
  const urlPattern = new RegExp(
    `${publicBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^"\\\\]+)`,
    'g'
  );
  const uploadsPattern = /\/uploads\/([^"\\]+)/g;

  for (const table of TABLES_WITH_MEDIA_PAYLOAD) {
    const exists = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
      [table]
    );
    if (exists.rowCount === 0) continue;

    const hasPayload = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'payload' LIMIT 1`,
      [table]
    );
    if (hasPayload.rowCount === 0) continue;

    const { rows } = await pool.query(`SELECT payload::text AS p FROM ${table}`);
    for (const row of rows) {
      const text: string = row.p ?? '';
      for (const m of text.matchAll(urlPattern)) referenced.add(m[1]);
      for (const m of text.matchAll(uploadsPattern)) referenced.add(m[1]);
    }
    console.log(`[scan] ${table}: ${rows.length} lignes lues`);
  }

  return referenced;
}

async function listAllBucketObjects(client: S3Client, bucket: string): Promise<S3Object[]> {
  const objects: S3Object[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
    );
    objects.push(...(res.Contents ?? []));
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function main(): Promise<void> {
  const { minAgeDays } = parseArgs();
  const bucket = process.env.S3_BUCKET?.trim();
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!bucket || !publicBase) {
    console.error('S3_BUCKET / S3_PUBLIC_BASE_URL manquants — rien à auditer.');
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error('DATABASE_URL manquant — impossible de croiser avec la base.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || 'auto',
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1',
  });

  console.log(`[scan] Bucket: ${bucket} — seuil d'âge: ${minAgeDays}j\n`);

  const [referenced, objects] = await Promise.all([
    collectReferencedKeys(pool, publicBase),
    listAllBucketObjects(client, bucket),
  ]);

  await pool.end();

  const cutoff = Date.now() - minAgeDays * 24 * 60 * 60 * 1000;
  const orphans = objects.filter((o) => {
    if (!o.Key || referenced.has(o.Key)) return false;
    const modifiedMs = o.LastModified ? o.LastModified.getTime() : 0;
    return modifiedMs < cutoff;
  });

  const totalSizeBytes = orphans.reduce((sum, o) => sum + (o.Size ?? 0), 0);

  console.log(`\n=== RAPPORT ===`);
  console.log(`Objets totaux dans le bucket : ${objects.length}`);
  console.log(`Clés référencées en base     : ${referenced.size}`);
  console.log(`Objets orphelins détectés    : ${orphans.length}`);
  console.log(`Taille cumulée orphelins     : ${(totalSizeBytes / 1024 / 1024).toFixed(2)} Mo\n`);

  if (orphans.length === 0) {
    console.log('Rien à purger. ✅');
    return;
  }

  console.log('Clés orphelines (dry-run — AUCUNE suppression effectuée) :');
  for (const o of orphans) {
    console.log(`  ${o.Key}  (${o.LastModified?.toISOString()}, ${o.Size} octets)`);
  }

  console.log('\nPour supprimer après revue manuelle, exécuter (AWS CLI configuré sur l\'endpoint Scaleway) :');
  for (const o of orphans) {
    console.log(`aws --endpoint-url=${process.env.S3_ENDPOINT} s3 rm s3://${bucket}/${o.Key}`);
  }
}

main().catch((err) => {
  console.error('[find-orphaned-s3-uploads] échec:', err);
  process.exit(1);
});
