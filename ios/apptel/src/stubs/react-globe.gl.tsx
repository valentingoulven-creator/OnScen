import { forwardRef, useImperativeHandle } from 'react';

/** Stub Capacitor natif — globe 3D exclu du bundle mobile. */
export interface GlobeMethods {
  pointOfView: (coords: { lat?: number; lng?: number; altitude?: number }, transition?: number) => void;
  controls: () => { autoRotate: boolean; autoRotateSpeed: number };
}

const EmptyGlobe = forwardRef<GlobeMethods, Record<string, unknown>>(function EmptyGlobe(_props, ref) {
  useImperativeHandle(ref, () => ({
    pointOfView: () => undefined,
    controls: () => ({ autoRotate: false, autoRotateSpeed: 0 }),
  }));
  return null;
});

export default EmptyGlobe;
