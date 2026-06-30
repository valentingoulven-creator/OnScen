import { describe, expect, it } from 'vitest';

/** Copie des helpers internes pour tests unitaires (heic2any rejette { code, message }). */
function heic2anyErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(err ?? '');
}

function browserReadableKindFromHeic2anyError(
  err: unknown
): 'jpeg' | 'png' | 'gif' | null {
  const msg = heic2anyErrorMessage(err);
  if (!msg.includes('already browser readable')) return null;
  if (msg.includes('image/png')) return 'png';
  if (msg.includes('image/gif')) return 'gif';
  return 'jpeg';
}

describe('heic2any error parsing', () => {
  it('reads message from heic2any rejection object', () => {
    const err = {
      code: 1,
      message: 'ERR_USER Image is already browser readable: image/jpeg',
    };
    expect(heic2anyErrorMessage(err)).toContain('already browser readable');
    expect(String(err)).not.toContain('already browser readable');
  });

  it('detects browser-readable JPEG from heic2any object rejection', () => {
    const err = {
      code: 1,
      message: 'ERR_USER Image is already browser readable: image/jpeg',
    };
    expect(browserReadableKindFromHeic2anyError(err)).toBe('jpeg');
  });

  it('detects browser-readable PNG from heic2any object rejection', () => {
    const err = {
      code: 1,
      message: 'ERR_USER Image is already browser readable: image/png',
    };
    expect(browserReadableKindFromHeic2anyError(err)).toBe('png');
  });

  it('returns null for libheif errors', () => {
    const err = { code: 2, message: 'ERR_LIBHEIF format not supported' };
    expect(browserReadableKindFromHeic2anyError(err)).toBeNull();
  });
});
