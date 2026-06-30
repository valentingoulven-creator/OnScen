/**
 * Shared image validation utilities.
 * Centralises magic-byte checks and MIME allowlists used across upload modules
 * (sponsor banners, sponsor logos, album covers, etc.).
 */

export type AllowedImageMime = 'jpeg' | 'png' | 'webp' | 'gif';

/**
 * Verifies that `buffer` starts with the expected magic bytes for the given
 * `mime` type. The MIME type declared by the client is untrusted and must
 * always be verified against the actual binary content.
 */
export function validateImageMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  const m = mime.toLowerCase().replace('image/', '');
  if (m === 'jpeg' || m === 'jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (m === 'png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (m === 'webp') {
    // RIFF????WEBP
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  if (m === 'gif') {
    // GIF87a or GIF89a
    return (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    );
  }
  return false;
}

/** Maps a MIME type string to the canonical file extension. */
export function extForImageMime(mime: string): string {
  const m = mime.toLowerCase().replace('image/', '');
  if (m === 'png') return 'png';
  if (m === 'webp') return 'webp';
  if (m === 'gif') return 'gif';
  return 'jpg';
}
