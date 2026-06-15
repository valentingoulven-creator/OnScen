import { describe, expect, it } from 'vitest';
import {
  normalizeHeicFileMetadata,
  sniffHeicMagicBytes,
  isHeicImageFile,
  validateStoryPhotoAsync,
} from './imageConstraints';

/** En-tête ISO BMFF minimal ftyp heic (12 octets). */
function heicHeader(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]); // size=24, 'ftyp'
  bytes.set([0x68, 0x65, 0x69, 0x63], 8); // 'heic'
  bytes.set([0, 0, 0, 0], 12); // minor version
  bytes.set([0x6d, 0x69, 0x66, 0x31], 16); // compatible 'mif1'
  return bytes;
}

describe('HEIC detection and normalization', () => {
  it('sniffs HEIC from ftyp compatible brands', () => {
    expect(sniffHeicMagicBytes(heicHeader())).toBe(true);
  });

  it('adds .heic extension when filename lacks one', () => {
    const raw = new File([new Blob(['x'])], 'IMG_1234', { type: '' });
    const normalized = normalizeHeicFileMetadata(raw, heicHeader());
    expect(normalized.name).toBe('IMG_1234.heic');
    expect(normalized.type).toBe('image/heic');
  });

  it('preserves .heif extension and MIME', () => {
    const raw = new File([new Blob(['x'])], 'photo.heif', { type: 'image/heif' });
    const normalized = normalizeHeicFileMetadata(raw, heicHeader());
    expect(normalized.name).toBe('photo.heif');
    expect(normalized.type).toBe('image/heif');
  });

  it('detects HEIC via extension when MIME is empty', () => {
    const file = new File([new Blob(['x'])], 'IMG_0001.HEIC', { type: '' });
    expect(isHeicImageFile(file)).toBe(true);
  });

  it('validateStoryPhotoAsync accepts HEIC without extension via magic bytes', async () => {
    const raw = new File([new Blob(['x'])], 'IMG_5678', { type: '' });
    const result = await validateStoryPhotoAsync(raw);
    expect(result.valid).toBe(false);

    const heic = new File([new Blob([heicHeader() as BlobPart])], 'IMG_5678', { type: '' });
    const ok = await validateStoryPhotoAsync(heic);
    expect(ok.valid).toBe(true);
  });
});
