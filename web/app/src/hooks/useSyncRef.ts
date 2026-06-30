import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps a ref in sync with `value` without updating ref.current during render
 * (eslint react-hooks/refs).
 */
export function useSyncRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
