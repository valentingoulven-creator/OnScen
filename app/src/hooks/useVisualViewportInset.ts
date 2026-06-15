import { useEffect, useState } from 'react';

/** Hauteur masquée par le clavier virtuel (iOS/Android), en px. */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(hidden)));
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
