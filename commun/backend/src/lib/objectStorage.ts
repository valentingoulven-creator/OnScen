import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPublicDir } from '../paths';

export interface StoredObjectResult {
  /** Public URL path (e.g. /uploads/...) or absolute S3 URL. */
  url: string;
  key: string;
  backend: 'local' | 's3';
}

export interface UploadObjectOptions {
  prefix: string;
  filename?: string;
  contentType?: string;
  extension?: string;
}

function localUploadsRoot(): string {
  return path.join(getPublicDir(), 'uploads');
}

function buildLocalKey(prefix: string, filename: string): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/\/+/g, '/');
  return `${safePrefix}/${filename}`.replace(/^\/+/, '');
}

/** Writes a buffer to local disk under public/uploads/. */
export function saveObjectLocal(
  buffer: Buffer,
  options: UploadObjectOptions
): StoredObjectResult {
  const ext = options.extension?.replace(/^\./, '') || 'bin';
  const filename = options.filename ?? `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const key = buildLocalKey(options.prefix, filename);
  const absPath = path.join(localUploadsRoot(), key);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, buffer);
  return { url: `/uploads/${key.replace(/\\/g, '/')}`, key, backend: 'local' };
}

/** Optional S3-compatible upload when S3_BUCKET (+ credentials) are configured. */
export async function saveObjectS3(
  buffer: Buffer,
  options: UploadObjectOptions
): Promise<StoredObjectResult | null> {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;

  try {
    // Optional deps — install @aws-sdk/client-s3 when enabling S3 uploads.
    const s3Module = '@aws-sdk/client-s3';
    const { S3Client, PutObjectCommand } = await import(/* webpackIgnore: true */ s3Module);
    const ext = options.extension?.replace(/^\./, '') || 'bin';
    const filename = options.filename ?? `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    const key = buildLocalKey(options.prefix, filename);
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
    const putInput: {
      Bucket: string;
      Key: string;
      Body: Buffer;
      ContentType?: string;
      ACL?: string;
    } = {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType,
    };
    if (process.env.S3_PUBLIC_READ === '1') {
      putInput.ACL = 'public-read';
    }
    await client.send(new PutObjectCommand(putInput));
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
    const url = publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `s3://${bucket}/${key}`;
    return { url, key, backend: 's3' };
  } catch (err) {
    console.warn('[objectStorage] S3 upload unavailable — fallback local:', err);
    return null;
  }
}

/** Upload with S3 when configured, otherwise local disk. */
export async function uploadObject(
  buffer: Buffer,
  options: UploadObjectOptions
): Promise<StoredObjectResult> {
  const fromS3 = await saveObjectS3(buffer, options);
  if (fromS3) return fromS3;
  return saveObjectLocal(buffer, options);
}

function extractS3KeyFromUrl(url: string): string | null {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (publicBase && url.startsWith(`${publicBase}/`)) {
    return url.slice(publicBase.length + 1);
  }
  const s3Prefix = `s3://${bucket}/`;
  if (url.startsWith(s3Prefix)) {
    return url.slice(s3Prefix.length);
  }
  return null;
}

/**
 * Supprime un objet uploadé (local ou S3) à partir de son URL publique.
 * No-op silencieux pour les URLs externes (CDN tiers, picsum, etc.) que
 * l'application ne possède pas — uniquement utilisé pour le nettoyage RGPD
 * (droit à l'effacement) des médias réellement hébergés par OnScen.
 */
export async function deleteObjectByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (url.startsWith('/uploads/')) {
      const absPath = path.join(getPublicDir(), url.replace(/^\//, ''));
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      return;
    }
    const s3Key = extractS3KeyFromUrl(url);
    if (!s3Key) return; // URL externe non gérée par OnScen
    const bucket = process.env.S3_BUCKET?.trim();
    if (!bucket) return;
    const { S3Client, DeleteObjectCommand } = await import(
      /* webpackIgnore: true */ '@aws-sdk/client-s3'
    );
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
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key }));
  } catch (err) {
    console.warn('[objectStorage] Échec suppression objet (RGPD cleanup):', url, err);
  }
}

/** Supprime plusieurs objets (best-effort, en parallèle). */
export async function deleteObjectsByUrls(urls: Array<string | null | undefined>): Promise<void> {
  await Promise.all(urls.filter(Boolean).map((u) => deleteObjectByUrl(u)));
}
