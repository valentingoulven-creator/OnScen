import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export const HOLD_ACCELERATE_DELAY_MS = 250;
export const HOLD_ACCELERATE_RATE = 2;

export interface HoldAccelerateMediaRefs {
  video?: HTMLVideoElement | null;
  audio?: HTMLAudioElement | null;
}

export interface UseHoldToAccelerateOptions {
  enabled?: boolean;
  rate?: number;
  delayMs?: number;
  getMedia?: () => HoldAccelerateMediaRefs;
  /** Lecteurs externes (YouTube iframe, etc.) */
  onApplyRate?: (rate: number) => void;
  getSavedRate?: () => number;
}

export function useHoldToAccelerate(options: UseHoldToAccelerateOptions = {}) {
  const {
    enabled = true,
    rate = HOLD_ACCELERATE_RATE,
    delayMs = HOLD_ACCELERATE_DELAY_MS,
    getMedia,
    onApplyRate,
    getSavedRate,
  } = options;

  const [accelerating, setAccelerating] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAcceleratingRef = useRef(false);
  const savedRateRef = useRef(1);
  const optionsRef = useRef(options);
  optionsRef.current = { enabled, rate, delayMs, getMedia, onApplyRate, getSavedRate };

  const applyPlaybackRate = useCallback((targetRate: number) => {
    const { onApplyRate: applyCustom, getMedia: getRefs } = optionsRef.current;
    if (applyCustom) {
      applyCustom(targetRate);
      return;
    }
    const refs = getRefs?.();
    if (refs?.video) refs.video.playbackRate = targetRate;
    if (refs?.audio) refs.audio.playbackRate = targetRate;
  }, []);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const stopAccelerating = useCallback(() => {
    clearHoldTimer();
    if (!isAcceleratingRef.current) return false;
    applyPlaybackRate(savedRateRef.current);
    isAcceleratingRef.current = false;
    setAccelerating(false);
    return true;
  }, [applyPlaybackRate, clearHoldTimer]);

  const startAccelerating = useCallback(() => {
    const opts = optionsRef.current;
    if (!opts.enabled || isAcceleratingRef.current) return;
    if (opts.getSavedRate) {
      savedRateRef.current = opts.getSavedRate();
    } else {
      const refs = opts.getMedia?.();
      savedRateRef.current = refs?.video?.playbackRate ?? refs?.audio?.playbackRate ?? 1;
    }
    applyPlaybackRate(opts.rate ?? HOLD_ACCELERATE_RATE);
    isAcceleratingRef.current = true;
    setAccelerating(true);
  }, [applyPlaybackRate]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!optionsRef.current.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearHoldTimer();
      holdTimerRef.current = setTimeout(startAccelerating, optionsRef.current.delayMs ?? delayMs);
    },
    [clearHoldTimer, startAccelerating, delayMs]
  );

  const onPointerEnd = useCallback(() => {
    const wasAccelerating = isAcceleratingRef.current;
    clearHoldTimer();
    if (wasAccelerating) {
      stopAccelerating();
      return true;
    }
    return false;
  }, [clearHoldTimer, stopAccelerating]);

  useEffect(() => {
    if (!enabled) {
      stopAccelerating();
      clearHoldTimer();
    }
  }, [enabled, stopAccelerating, clearHoldTimer]);

  useEffect(
    () => () => {
      clearHoldTimer();
      if (isAcceleratingRef.current) {
        applyPlaybackRate(savedRateRef.current);
        isAcceleratingRef.current = false;
      }
    },
    [clearHoldTimer, applyPlaybackRate]
  );

  return {
    accelerating,
    handlers: {
      onPointerDown,
      onPointerUp: onPointerEnd,
      onPointerLeave: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    stopAccelerating,
  };
}
