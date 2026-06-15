import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPhotoFilterCss } from './photoFilters';
import {
  clampPanOffset,
  composePhotoImageWithEdits,
  computeStoryCropRect,
  defaultStoryTagPosition,
  FEED_VIEWPORT_H,
  FEED_VIEWPORT_W,
  initialFeedCoverScale,
  initialStoryCoverScale,
  resolveStoryTagPosition,
  STORY_VIEWPORT_H,
  STORY_VIEWPORT_W,
  zoomPanAtViewportPoint,
} from './storyImageCompose';

describe('storyImageCompose', () => {
  it('computes initial cover scale for portrait viewport', () => {
    const scale = initialStoryCoverScale(4000, 3000);
    expect(scale).toBeGreaterThan(0);
  });

  it('returns valid crop rect within image bounds', () => {
    const crop = computeStoryCropRect(1000, 800, 280, 498, 0.5, 0, 0);
    expect(crop.sx).toBeGreaterThanOrEqual(0);
    expect(crop.sy).toBeGreaterThanOrEqual(0);
    expect(crop.sw).toBeGreaterThan(0);
    expect(crop.sh).toBeGreaterThan(0);
    expect(crop.sx + crop.sw).toBeLessThanOrEqual(1000);
    expect(crop.sy + crop.sh).toBeLessThanOrEqual(800);
  });

  it('clamps pan offset so image covers viewport', () => {
    const viewW = 280;
    const viewH = 498;
    const scale = initialStoryCoverScale(1000, 800);
    const clamped = clampPanOffset(1000, 800, viewW, viewH, scale, 500, -400);
    expect(Math.abs(clamped.offsetX)).toBeLessThanOrEqual((1000 * scale - viewW) / 2 + 1);
    expect(Math.abs(clamped.offsetY)).toBeLessThanOrEqual((800 * scale - viewH) / 2 + 1);
  });

  it('zooms around viewport point and keeps pan in bounds', () => {
    const viewW = 280;
    const viewH = 498;
    const scale = initialStoryCoverScale(1000, 800);
    const next = zoomPanAtViewportPoint(1000, 800, viewW, viewH, scale, 0, 0, scale * 1.5, 140, 249);
    expect(next.scale).toBeCloseTo(scale * 1.5, 5);
    expect(Math.abs(next.offsetX)).toBeLessThanOrEqual((1000 * next.scale - viewW) / 2 + 1);
    expect(Math.abs(next.offsetY)).toBeLessThanOrEqual((800 * next.scale - viewH) / 2 + 1);
  });

  it('cover scale must use actual viewport size (not stale defaults)', () => {
    const imgW = 1000;
    const imgH = 800;
    const staleScale = Math.max(STORY_VIEWPORT_W / imgW, STORY_VIEWPORT_H / imgH);
    const actualViewH = 622;
    const actualScale = Math.max(350 / imgW, actualViewH / imgH);
    expect(imgH * staleScale).toBeLessThan(actualViewH);
    expect(imgH * actualScale).toBeGreaterThanOrEqual(actualViewH);
    expect(imgW * actualScale).toBeGreaterThanOrEqual(350);
  });

  it('computes initial cover scale for feed 4:5 viewport', () => {
    const scale = initialFeedCoverScale(4000, 3000);
    expect(scale).toBeGreaterThan(0);
    expect(FEED_VIEWPORT_W / FEED_VIEWPORT_H).toBeCloseTo(0.8, 2);
  });

  it('returns staggered default tag positions within 0–1', () => {
    const a = defaultStoryTagPosition(0, 3);
    const b = defaultStoryTagPosition(1, 3);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x).toBeLessThanOrEqual(1);
    expect(a.y).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('resolveStoryTagPosition prefers stored coordinates', () => {
    const resolved = resolveStoryTagPosition({ x: 0.2, y: 0.8 }, 0, 1);
    expect(resolved).toEqual({ x: 0.2, y: 0.8 });
  });

  describe('composePhotoImageWithEdits', () => {
    const filterHistory: string[] = [];
    let drawImage: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      filterHistory.length = 0;
      drawImage = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          blob: () => Promise.resolve(new Blob([''], { type: 'image/jpeg' })),
        })
      );
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockResolvedValue({
          width: 400,
          height: 600,
          close: vi.fn(),
        })
      );

      const ctx = {
        _filter: 'none',
        drawImage,
        shadowBlur: 0,
        shadowColor: '',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      };
      Object.defineProperty(ctx, 'filter', {
        enumerable: true,
        get() {
          return ctx._filter;
        },
        set(value: string) {
          filterHistory.push(value);
          ctx._filter = value;
        },
      });

      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: () => 'data:image/jpeg;base64,filtered',
      };

      vi.stubGlobal('document', {
        createElement: (tag: string) => {
          if (tag === 'canvas') return canvas;
          throw new Error(`unexpected tag: ${tag}`);
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('bakes AI filter into export canvas (filter-only, no overlays)', async () => {
      const expected = getPhotoFilterCss('ai_valencia');
      const out = await composePhotoImageWithEdits('data:image/jpeg;base64,xx', [], 'ai_valencia');
      expect(filterHistory).toContain(expected);
      expect(drawImage).toHaveBeenCalled();
      expect(out).toBe('data:image/jpeg;base64,filtered');
    });

    it('skips canvas filter when preset is none and no overlays', async () => {
      await composePhotoImageWithEdits('data:image/jpeg;base64,xx', [], 'none');
      expect(filterHistory.filter((f) => f !== 'none')).toHaveLength(0);
    });

    it('applies overlay scale when drawing text', async () => {
      const fonts: string[] = [];
      let fontValue = '';
      const ctx = {
        _filter: 'none',
        drawImage,
        shadowBlur: 0,
        shadowColor: '',
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        textAlign: '',
        textBaseline: '',
        fillStyle: '',
        measureText: (text: string) => ({ width: text.length * 10 }),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
      };
      Object.defineProperty(ctx, 'filter', {
        enumerable: true,
        get() {
          return ctx._filter;
        },
        set(value: string) {
          filterHistory.push(value);
          ctx._filter = value;
        },
      });
      Object.defineProperty(ctx, 'font', {
        enumerable: true,
        get() {
          return fontValue;
        },
        set(value: string) {
          fontValue = value;
          fonts.push(value);
        },
      });

      vi.stubGlobal('document', {
        createElement: (tag: string) => {
          if (tag === 'canvas') {
            return {
              width: 0,
              height: 0,
              getContext: () => ctx,
              toDataURL: () => 'data:image/jpeg;base64,scaled',
            };
          }
          throw new Error(`unexpected tag: ${tag}`);
        },
      });

      await composePhotoImageWithEdits(
        'data:image/jpeg;base64,xx',
        [{ id: '1', text: 'Hi', x: 0.5, y: 0.5, color: '#fff', fontSize: 20, scale: 2 }],
        'none',
        { referenceViewportW: 280 }
      );

      expect(fonts.some((f) => f.includes('57px'))).toBe(true);
    });
  });
});
