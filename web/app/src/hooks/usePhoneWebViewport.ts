import { useSyncExternalStore } from 'react';
import {
  isCompactMapViewport,
  isPhoneWebViewport,
  subscribeCompactMapViewport,
  subscribePhoneWebViewport,
} from '../lib/phoneViewport';

export function usePhoneWebViewport(): boolean {
  return useSyncExternalStore(
    subscribePhoneWebViewport,
    isPhoneWebViewport,
    () => false
  );
}

export function useCompactMapViewport(): boolean {
  return useSyncExternalStore(
    subscribeCompactMapViewport,
    isCompactMapViewport,
    () => false
  );
}
