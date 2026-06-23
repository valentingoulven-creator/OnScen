import { useEffect, useState } from 'react';

/** True when the document tab is visible (Page Visibility API). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return visible;
}

/** Interval that pauses when the tab is hidden (reduces background polling). */
export function useVisibleInterval(callback: () => void, ms: number, enabled = true): void {
  const visible = usePageVisible();

  useEffect(() => {
    if (!enabled || !visible) return;
    callback();
    const id = window.setInterval(callback, ms);
    return () => window.clearInterval(id);
  }, [callback, ms, enabled, visible]);
}
