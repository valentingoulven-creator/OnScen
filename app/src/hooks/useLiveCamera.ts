import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_CAMERA_FILE_LOAD_ERROR } from '../lib/liveCameraMessages';
import { getLiveMediaPrefs } from '../lib/liveMediaPrefs';
import {
  acquireLiveCameraStream,
  attachLiveCameraStream,
  configureLiveVideoElement,
  createVideoFileObjectUrl,
  ensureMediaDevices,
  hasGetUserMediaCapability,
  listLiveAudioInputDevices,
  mapLiveCameraError,
  playLiveVideo,
  replaceLiveAudioTrack,
  validateLiveVideoFile,
  waitForVideoFileMetadata,
  type LiveMediaDeviceOption,
} from '../lib/liveCameraSupport';
import { setLiveMediaPrefs } from '../lib/liveMediaPrefs';

export type LiveCameraMode = 'camera' | 'file' | null;

export function useLiveCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<LiveCameraMode>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraUsable, setCameraUsable] = useState(() =>
    typeof window === 'undefined' ? true : hasGetUserMediaCapability()
  );
  const [audioDevices, setAudioDevices] = useState<LiveMediaDeviceOption[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [micSwitching, setMicSwitching] = useState(false);

  useEffect(() => {
    setCameraUsable(hasGetUserMediaCapability());
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setBroadcastStream(null);
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
    setAudioDevices([]);
    setAudioDeviceId('');
  }, []);

  const attachPreview = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    configureLiveVideoElement(el);

    const stream = streamRef.current;
    if (stream) {
      await attachLiveCameraStream(el, stream);
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

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && (streamRef.current || fileUrlRef.current)) {
        void attachPreview();
      }
    },
    [attachPreview]
  );

  const waitForVideoElement = useCallback(async (): Promise<HTMLVideoElement | null> => {
    for (let i = 0; i < 90; i++) {
      if (videoRef.current) return videoRef.current;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return videoRef.current;
  }, []);

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
      setBroadcastStream(stream);
      setMode('camera');
      setActive(true);
      setCameraUsable(true);
      const mics = await listLiveAudioInputDevices();
      setAudioDevices(mics);
      const activeMic = stream.getAudioTracks()[0]?.getSettings().deviceId ?? '';
      setAudioDeviceId(activeMic);
      const el = await waitForVideoElement();
      if (el) await attachPreview();
      return true;
    } catch (e) {
      setError(mapLiveCameraError(e));
      stop();
      return false;
    }
  }, [stop, waitForVideoElement, attachPreview]);

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
    if (!active) return;
    let cancelled = false;
    let raf = 0;
    const tryAttach = () => {
      if (cancelled) return;
      if (!videoRef.current) {
        raf = requestAnimationFrame(tryAttach);
        return;
      }
      void attachPreview();
    };
    tryAttach();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active, attachPreview]);

  useEffect(() => {
    if (!active) return;
    const el = videoRef.current;
    if (!el) return;
    const onPause = () => {
      if (!streamRef.current && !fileUrlRef.current) return;
      if (el.paused) void playLiveVideo(el);
    };
    el.addEventListener('pause', onPause);
    return () => el.removeEventListener('pause', onPause);
  }, [active]);

  useEffect(() => () => stop(), [stop]);

  const getStream = useCallback((): MediaStream | null => streamRef.current, []);

  const switchMicrophone = useCallback(
    async (nextDeviceId: string): Promise<MediaStreamTrack | null> => {
      const stream = streamRef.current;
      const md = ensureMediaDevices();
      if (!stream || !md?.getUserMedia || mode !== 'camera' || !nextDeviceId) return null;
      if (nextDeviceId === audioDeviceId) return stream.getAudioTracks()[0] ?? null;

      setMicSwitching(true);
      setError(null);
      try {
        const track = await replaceLiveAudioTrack(stream, (c) => md.getUserMedia(c), nextDeviceId);
        setAudioDeviceId(nextDeviceId);
        setLiveMediaPrefs({
          videoDeviceId: stream.getVideoTracks()[0]?.getSettings().deviceId,
          audioDeviceId: nextDeviceId,
        });
        return track;
      } catch (e) {
        setError(mapLiveCameraError(e));
        return null;
      } finally {
        setMicSwitching(false);
      }
    },
    [audioDeviceId, mode]
  );

  return {
    videoRef: setVideoRef,
    active,
    mode,
    error,
    setError,
    cameraUsable,
    audioDevices,
    audioDeviceId,
    micSwitching,
    start,
    startFromFile,
    stop,
    getStream,
    broadcastStream,
    switchMicrophone,
  };
}
