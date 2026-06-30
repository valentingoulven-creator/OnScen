const DATA_IMAGE_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

export interface ParsedImageDataUrl {
  mime: string;
  buffer: Buffer;
}

export function parseImageDataUrl(source: string): ParsedImageDataUrl | null {
  const trimmed = source.trim();
  const match = DATA_IMAGE_RE.exec(trimmed);
  if (!match) return null;
  const mime = match[1]!.toLowerCase();
  const b64 = match[2]!.replace(/\s/g, '');
  if (!b64) return null;
  try {
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

export function isImageDataUrl(source: string): boolean {
  return DATA_IMAGE_RE.test(source.trim());
}

export function extensionForImageMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    default:
      return 'bin';
  }
}
