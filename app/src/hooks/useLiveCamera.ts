import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_CAMERA_FILE_LOAD_ERROR } from '../lib/liveCameraMessages';
import { getLiveMediaPrefs } from '../lib/liveMediaPrefs';
import {
  acquireLiveCameraStream,
  configureLiveVideoElement,
  createVideoFileObjectUrl,
  ensureMediaDevices,
  hasGetUserMediaCapability,
  mapLiveCameraError,
  playLiveVideo,
  validateLiveVideoFile,
  waitForVideoFileMetadata,
} from '../lib/liveCameraSupport';

export type LiveCameraMode = 'camera' | 'file' | null;

export function useLiveCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<LiveCameraMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraUsable, setCameraUsable] = useState(() =>
    typeof window === 'undefined' ? true : hasGetUserMediaCapability()
  );

  useEffect(() => {
    setCameraUsable(hasGetUserMediaCapability());
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
    const el = videoRef.current;
    if (el) {
      el.srcObject = null;
      el.removeAttribute('src');
    }
    setActive(false);
    setMode(null);
  }, []);

  const attachPreview = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    configureLiveVideoElement(el);

    const stream = streamRef.current;
    if (stream) {
      if (el.src) {
        el.removeAttribute('src');
      }
      el.srcObject = stream;
      await playLiveVideo(el);
      return;
    }

    const fileUrl = fileUrlRef.current;
    if (fileUrl) {
      el.srcObject = null;
      el.src = fileUrl;
      try {
        await waitForVideoFileMetadata(el);
        await playLiveVideo(el);
      } catch (e) {
        setError(e instanceof Error ? e.message : LIVE_CAMERA_FILE_LOAD_ERROR);
        stop();
      }
    }
  }, [stop]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);

    const mediaDevices = ensureMediaDevices();
    if (!mediaDevices?.getUserMedia) {
      const msg = mapLiveCameraError(new DOMException('', 'NotSupportedError'));
      setError(msg);
      setCameraUsable(false);
      return false;
    }

    try {
      stop();
      const prefs = getLiveMediaPrefs();
      const stream = await acquireLiveCameraStream(
        (c) => mediaDevices.getUserMedia(c),
        prefs
      );
      streamRef.current = stream;
      setMode('camera');
      setActive(true);
      setCameraUsable(true);
      return true;
    } catch (e) {
      setError(mapLiveCameraError(e));
      stop();
      return false;
    }
  }, [stop]);

  const startFromFile = useCallback(
    async (file: File): Promise<boolean> => {
      setError(null);
      const invalid = validateLiveVideoFile(file);
      if (invalid) {
        setError(invalid);
        return false;
      }

      stop();
      try {
        fileUrlRef.current = createVideoFileObjectUrl(file);
        setMode('file');
        setActive(true);
        return true;
      } catch {
        setError(LIVE_CAMERA_FILE_LOAD_ERROR);
        stop();
        return false;
      }
    },
    [stop]
  );

  useEffect(() => {
    if (active) void attachPreview();
  }, [active, attachPreview]);

  useEffect(() => () => stop(), [stop]);

  const getStream = useCallback((): MediaStream | null => streamRef.current, []);

  return {
    videoRef,
    active,
    mode,
    error,
    setError,
    cameraUsable,
    start,
    startFromFile,
    stop,
    getStream,
  };
}
