/** localStorage key for map style preference (flat | globe). */
export const MAP_STYLE_STORAGE_KEY = 'soundly_map_style';

/** sessionStorage flag set when globe 3D fails at runtime. */
export const MAP_GLOBE_DISABLED_KEY = 'soundy_disable_globe';

/** Dispatched when the 3D globe must fall back to the flat map (runtime WebGL failure). */
export const GLOBE_UNAVAILABLE_EVENT = 'soundy_globe_unavailable';

export interface WebGLSupportResult {
  supported: boolean;
  reason?: 'no-window' | 'context-unavailable';
}

let cached: WebGLSupportResult | null = null;

export function isWebGLError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  return (
    lower.includes('webgl') ||
    lower.includes('webgpu') ||
    lower.includes('error creating webgl context') ||
    lower.includes('error creating webgl context with your selected attributes') ||
    lower.includes('failed to initialize webgl') ||
    lower.includes('could not create a webgl') ||
    lower.includes('webglrenderer')
  );
}

function tryCreateContext(
  canvas: HTMLCanvasElement,
  contextId: 'webgl2' | 'webgl' | 'experimental-webgl',
  attrs: WebGLContextAttributes
): WebGLRenderingContext | WebGL2RenderingContext | null {
  try {
    return canvas.getContext(contextId, attrs) as WebGLRenderingContext | WebGL2RenderingContext | null;
  } catch {
    return null;
  }
}

function releaseContext(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  try {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* ignore */
  }
}

/** Probe WebGL availability (cached). Uses relaxed context attrs for low-power / software GL. */
export function detectWebGLSupport(force = false): WebGLSupportResult {
  if (!force && cached) return cached;

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    cached = { supported: false, reason: 'no-window' };
    return cached;
  }

  const canvas = document.createElement('canvas');
  // Match GlobeView / Three.js rendererConfig (antialias only on low-DPR screens).
  const antialias =
    typeof window !== 'undefined' && window.devicePixelRatio <= 1;
  const attrs: WebGLContextAttributes = {
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: true,
    alpha: true,
    antialias,
    powerPreference: 'default',
  };

  const gl =
    tryCreateContext(canvas, 'webgl2', attrs) ??
    tryCreateContext(canvas, 'webgl', attrs) ??
    tryCreateContext(canvas, 'experimental-webgl', attrs);

  if (!gl) {
    cached = { supported: false, reason: 'context-unavailable' };
    return cached;
  }

  releaseContext(gl);
  cached = { supported: true };
  return cached;
}

export function isWebGLSupported(): boolean {
  return detectWebGLSupport().supported;
}

export function invalidateWebGLSupportCache(): void {
  cached = null;
}

/** Persist flat-map preference after a runtime globe failure. */
export function disableGlobeView(): void {
  cached = { supported: false, reason: 'context-unavailable' };

  let notify = false;
  try {
    notify = sessionStorage.getItem(MAP_GLOBE_DISABLED_KEY) !== '1';
    sessionStorage.setItem(MAP_GLOBE_DISABLED_KEY, '1');
    localStorage.setItem(MAP_STYLE_STORAGE_KEY, 'flat');
  } catch {
    notify = true;
  }

  if (notify && typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(GLOBE_UNAVAILABLE_EVENT));
    } catch {
      /* ignore */
    }
  }
}

/** True when globe 3D can be attempted (probe OK and no prior runtime failure this session). */
export function canUseGlobeView(): boolean {
  return isWebGLSupported() && !shouldForceFlatMap();
}

/** True when a prior session hit a WebGL failure (skip globe on reload). */
export function shouldForceFlatMap(): boolean {
  try {
    return sessionStorage.getItem(MAP_GLOBE_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}
