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
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType,
      })
    );
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
