import { resolveDuotoneGenre, waveformSeedFromText, type DuotoneGenrePreset } from './storyCreativeEffects';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Duotone procédural (ombre / lumière). */
export function applyDuotoneToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: DuotoneGenrePreset
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const [sr, sg, sb] = hexToRgb(preset.shadow);
  const [hr, hg, hb] = hexToRgb(preset.highlight);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    data[i] = Math.round(lerp(sr, hr, lum));
    data[i + 1] = Math.round(lerp(sg, hg, lum));
    data[i + 2] = Math.round(lerp(sb, hb, lum));
  }
  ctx.putImageData(imageData, 0, 0);
}

/** Glitch RGB slice — effet teaser clip. */
export function applyGlitchToContext(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
  intensity = 1
): void {
  ctx.drawImage(source, 0, 0, width, height);
  const slices = Math.floor(6 + intensity * 4);
  for (let i = 0; i < slices; i++) {
    const sliceH = Math.max(4, Math.floor((height / slices) * (0.6 + Math.random() * 0.8)));
    const sy = Math.min(height - sliceH, Math.floor(Math.random() * height));
    const dx = Math.floor((Math.random() - 0.5) * 36 * intensity);
    const imageData = ctx.getImageData(0, sy, width, sliceH);
    ctx.putImageData(imageData, dx, sy);
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.35 * intensity;
  ctx.drawImage(source, 3 * intensity, 0, width, height);
  ctx.drawImage(source, -4 * intensity, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

/** Barres waveform synthétiques en bas de l'image. */
export function drawWaveformOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: string
): void {
  const rand = seededRandom(seed);
  const barCount = Math.min(48, Math.max(24, Math.floor(width / 18)));
  const barW = width / barCount;
  const maxH = height * 0.14;
  const baseY = height - maxH * 0.35;
  const gradient = ctx.createLinearGradient(0, baseY - maxH, 0, height);
  gradient.addColorStop(0, 'rgba(168, 85, 247, 0.95)');
  gradient.addColorStop(1, 'rgba(236, 72, 153, 0.85)');
  ctx.fillStyle = gradient;
  for (let i = 0; i < barCount; i++) {
    const h = maxH * (0.25 + rand() * 0.75);
    const x = i * barW + barW * 0.15;
    const w = barW * 0.7;
    ctx.beginPath();
    ctx.roundRect(x, baseY - h, w, h, w / 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, height - maxH * 0.5, width, maxH * 0.5);
}

export function applyStoryCanvasEffects(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  opts: {
    glitch?: boolean;
    duotoneGenre?: string | null;
    waveformSeed?: string | null;
    cssFilter?: string;
  }
): void {
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const sctx = scratch.getContext('2d');
  if (!sctx) {
    ctx.drawImage(bitmap, 0, 0, width, height);
    return;
  }
  if (opts.cssFilter && opts.cssFilter !== 'none') sctx.filter = opts.cssFilter;
  sctx.drawImage(bitmap, 0, 0, width, height);

  if (opts.glitch) {
    applyGlitchToContext(ctx, scratch, width, height, 1);
  } else {
    ctx.drawImage(scratch, 0, 0, width, height);
  }

  if (opts.duotoneGenre) {
    applyDuotoneToContext(ctx, width, height, resolveDuotoneGenre(opts.duotoneGenre));
  }

  if (opts.waveformSeed) {
    drawWaveformOverlay(ctx, width, height, opts.waveformSeed);
  }
}

export { resolveDuotoneGenre, waveformSeedFromText };
