const DATA_VIDEO_RE = /^data:(video\/[a-z0-9.+-]+);base64,(.+)$/i;

export interface ParsedVideoDataUrl {
  mime: string;
  buffer: Buffer;
}

export function parseVideoDataUrl(source: string): ParsedVideoDataUrl | null {
  const trimmed = source.trim();
  const match = DATA_VIDEO_RE.exec(trimmed);
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

export function isVideoDataUrl(source: string): boolean {
  return DATA_VIDEO_RE.test(source.trim());
}

export function extensionForVideoMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-m4v':
      return 'm4v';
    default:
      return 'mp4';
  }
}
