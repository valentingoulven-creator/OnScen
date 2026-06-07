import { useEffect, useState } from 'react';

export interface ViewportInfo {
  isMobile: boolean;
  isCoarsePointer: boolean;
  isStandalone: boolean;
}

function readViewport(): ViewportInfo {
  if (typeof window === 'undefined') {
    return { isMobile: false, isCoarsePointer: false, isStandalone: false };
  }
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { isMobile: isMobile || isCoarsePointer, isCoarsePointer, isStandalone };
}

export function useViewport(): ViewportInfo {
  const [viewport, setViewport] = useState<ViewportInfo>(readViewport);

  useEffect(() => {
    const sync = () => setViewport(readViewport());
    const mobileMq = window.matchMedia('(max-width: 640px)');
    const pointerMq = window.matchMedia('(pointer: coarse)');
    mobileMq.addEventListener('change', sync);
    pointerMq.addEventListener('change', sync);
    window.addEventListener('orientationchange', sync);
    window.visualViewport?.addEventListener('resize', sync);
    sync();
    return () => {
      mobileMq.removeEventListener('change', sync);
      pointerMq.removeEventListener('change', sync);
      window.removeEventListener('orientationchange', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  return viewport;
}
