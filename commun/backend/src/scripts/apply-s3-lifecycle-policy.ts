/**
 * Applique une politique de cycle de vie minimale et sûre sur le bucket S3 :
 * - Abandon des uploads multipart incomplets après 7 jours (hygiène de coût,
 *   ne touche JAMAIS aux objets réellement écrits — uniquement les transferts
 *   multipart jamais finalisés).
 *
 * Aucune règle d'expiration n'est appliquée sur les objets eux-mêmes : les
 * médias utilisateurs (photos, reels, stories, compositions) doivent être
 * conservés indéfiniment et ne sont supprimés que via le flux RGPD applicatif
 * (`deleteObjectByUrl` / `deleteObjectsByUrls`).
 *
 * Usage : npx ts-node src/scripts/apply-s3-lifecycle-policy.ts
 */
import dotenv from 'dotenv';
import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';

dotenv.config();

async function main(): Promise<void> {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    console.error('S3_BUCKET manquant.');
    process.exit(1);
  }

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

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'abort-incomplete-multipart-uploads',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          },
        ],
      },
    })
  );

  console.log(`Lifecycle policy appliquée sur ${bucket}.`);

  const current = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
  console.log(JSON.stringify(current.Rules, null, 2));
}

main().catch((err) => {
  console.error('[apply-s3-lifecycle-policy] échec:', err);
  process.exit(1);
});
