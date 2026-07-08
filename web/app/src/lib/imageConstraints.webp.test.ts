import { afterEach, describe, expect, it } from 'vitest';
import {
  __setCanvasWebpEncodeSupportForTests,
  isCanvasWebpEncodeSupported,
  resolveImageOutputFormat,
} from './imageConstraints';

// Audit Medium #4 — WebP output with JPEG fallback when canvas encoding is
// unsupported. vitest runs with `environment: 'node'` (no `document`), which
// doubles as a regression guard for the "no browser globals" fallback path.
describe('WebP output format detection (audit Medium #4)', () => {
  afterEach(() => {
    __setCanvasWebpEncodeSupportForTests(null);
  });

  it('falls back to JPEG when there is no `document` (Node/test environment)', () => {
    __setCanvasWebpEncodeSupportForTests(null);
    expect(isCanvasWebpEncodeSupported()).toBe(false);
    expect(resolveImageOutputFormat()).toBe('image/jpeg');
  });

  it('memoizes the detection result across calls', () => {
    __setCanvasWebpEncodeSupportForTests(null);
    const first = isCanvasWebpEncodeSupported();
    const second = isCanvasWebpEncodeSupported();
    expect(first).toBe(second);
  });

  it('resolves to WebP when encoding support is detected', () => {
    __setCanvasWebpEncodeSupportForTests(true);
    expect(resolveImageOutputFormat()).toBe('image/webp');
  });

  it('resolves to JPEG when encoding support is explicitly false (old Safari)', () => {
    __setCanvasWebpEncodeSupportForTests(false);
    expect(resolveImageOutputFormat()).toBe('image/jpeg');
  });
});
