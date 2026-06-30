import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVE_CAMERA_FILE_LOAD_ERROR } from '../lib/liveCameraMessages';
import { getLiveMediaPrefs, setLiveMediaPrefs } from '../lib/liveMediaPrefs';
import {
  DEFAULT_LIVE_VIDEO_RESOLUTION,
  getLiveVideoResolutionPreset,
  type LiveVideoResolutionPreset,
} from '../lib/liveVideoResolution';
import {
  DEFAULT_LIVE_VIDEO_ASPECT_RATIO,
  getLiveVideoAspectRatioPreset,
  type LiveVideoAspectRatioPreset,
} from '../lib/liveVideoAspectRatio';
import { takeLiveCameraHandoff } from '../lib/liveCameraHandoff';
import {
  acquireLiveCameraStream,
  attachLiveCameraStream,
  configureLiveVideoElement,
  createVideoFileObjectUrl,
  ensureMediaDevices,
  hasGetUserMediaCapability,
  listLiveAudioInputDevices,
  listLiveVideoInputDevices,
  mapLiveCameraError,
  playLiveVideo,
  replaceLiveAudioTrack,
  replaceLiveVideoTrack,
  validateLiveVideoFile,
  waitForVideoFileMetadata,
  type LiveMediaDeviceOption,
} from '../lib/liveCameraSupport';

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
  const [videoDevices, setVideoDevices] = useState<LiveMediaDeviceOption[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [videoResolution, setVideoResolution] = useState<LiveVideoResolutionPreset>(
    DEFAULT_LIVE_VIDEO_RESOLUTION
  );
  const [videoAspectRatio, setVideoAspectRatio] = useState<LiveVideoAspectRatioPreset>(
    DEFAULT_LIVE_VIDEO_ASPECT_RATIO
  );
  const [micSwitching, setMicSwitching] = useState(false);
  const [camSwitching, setCamSwitching] = useState(false);
  const [previewBlocked, setPreviewBlocked] = useState(false);

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
    setPreviewBlocked(false);
    const prefs = getLiveMediaPrefs();
    setAudioDeviceId(prefs?.audioDeviceId ?? '');
    setVideoDeviceId(prefs?.videoDeviceId ?? '');
    setVideoResolution(getLiveVideoResolutionPreset(prefs?.videoResolution));
    setVideoAspectRatio(getLiveVideoAspectRatioPreset(prefs?.videoAspectRatio));
  }, []);

  const attachPreview = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    configureLiveVideoElement(el);

    const stream = streamRef.current;
    if (stream) {
      await attachLiveCameraStream(el, stream);
      setPreviewBlocked(el.paused || el.videoWidth === 0);
      return;
    }

    const fileUrl = fileUrlRef.current;
    if (fileUrl) {
      el.srcObject = null;
      el.src = fileUrl;
      try {
        await waitForVideoFileMetadata(el);
        await playLiveVideo(el);
        setPreviewBlocked(el.paused || el.videoWidth === 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : LIVE_CAMERA_FILE_LOAD_ERROR);
        stop();
      }
    }
  }, [stop]);

  const enableHostPreview = useCallback(async (): Promise<boolean> => {
    const el = videoRef.current;
    const stream = streamRef.current;
    const fileUrl = fileUrlRef.current;
    if (!el) return false;

    try {
      if (stream) {
        await attachLiveCameraStream(el, stream);
      } else if (fileUrl) {
        el.srcObject = null;
        el.src = fileUrl;
        await waitForVideoFileMetadata(el);
        await playLiveVideo(el);
      } else {
        return false;
      }
      const ok = !el.paused && el.videoWidth > 0;
      setPreviewBlocked(!ok);
      return ok;
    } catch {
      setPreviewBlocked(true);
      return false;
    }
  }, []);

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

      const handedOff = takeLiveCameraHandoff();
      if (handedOff) {
        for (const track of handedOff.getTracks()) {
          track.enabled = true;
        }
        streamRef.current = handedOff;
        setBroadcastStream(handedOff);
        setMode('camera');
        setActive(true);
        setCameraUsable(true);

        const previewEl = videoRef.current;
        if (previewEl) {
          configureLiveVideoElement(previewEl);
          if (previewEl.src) previewEl.removeAttribute('src');
          previewEl.srcObject = handedOff;
        }

        const [mics, cams] = await Promise.all([
          listLiveAudioInputDevices(),
          listLiveVideoInputDevices(),
        ]);
        setAudioDevices(mics);
        setVideoDevices(cams);
        const activeMic = handedOff.getAudioTracks()[0]?.getSettings().deviceId ?? '';
        const activeCam = handedOff.getVideoTracks()[0]?.getSettings().deviceId ?? '';
        setAudioDeviceId(activeMic);
        setVideoDeviceId(activeCam);
        const el = previewEl ?? (await waitForVideoElement());
        if (el) await attachPreview();
        return true;
      }

      const prefs = getLiveMediaPrefs();
      const stream = await acquireLiveCameraStream(
        (c) => mediaDevices.getUserMedia(c),
        prefs
      );
      for (const track of stream.getTracks()) {
        track.enabled = true;
      }
      streamRef.current = stream;
      setBroadcastStream(stream);
      setMode('camera');
      setActive(true);
      setCameraUsable(true);

      const previewEl = videoRef.current;
      if (previewEl) {
        configureLiveVideoElement(previewEl);
        if (previewEl.src) previewEl.removeAttribute('src');
        previewEl.srcObject = stream;
      }

      const [mics, cams] = await Promise.all([
        listLiveAudioInputDevices(),
        listLiveVideoInputDevices(),
      ]);
      setAudioDevices(mics);
      setVideoDevices(cams);
      const activeMic = stream.getAudioTracks()[0]?.getSettings().deviceId ?? '';
      const activeCam = stream.getVideoTracks()[0]?.getSettings().deviceId ?? '';
      setAudioDeviceId(activeMic);
      setVideoDeviceId(activeCam);
      const el = previewEl ?? (await waitForVideoElement());
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

  const refreshMediaDevices = useCallback(async () => {
    const [mics, cams] = await Promise.all([
      listLiveAudioInputDevices(),
      listLiveVideoInputDevices(),
    ]);
    setAudioDevices(mics);
    setVideoDevices(cams);
    const stream = streamRef.current;
    if (stream && mode === 'camera') {
      setAudioDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? '');
      setVideoDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? '');
      return;
    }
    const prefs = getLiveMediaPrefs();
    if (prefs?.audioDeviceId) setAudioDeviceId(prefs.audioDeviceId);
    if (prefs?.videoDeviceId) setVideoDeviceId(prefs.videoDeviceId);
    if (prefs?.videoResolution) setVideoResolution(getLiveVideoResolutionPreset(prefs.videoResolution));
    if (prefs?.videoAspectRatio) setVideoAspectRatio(getLiveVideoAspectRatioPreset(prefs.videoAspectRatio));
  }, [mode]);

  const updateMediaDevicePrefs = useCallback(
    (next: {
      videoDeviceId?: string;
      audioDeviceId?: string;
      videoResolution?: LiveVideoResolutionPreset;
      videoAspectRatio?: LiveVideoAspectRatioPreset;
    }) => {
      const prefs = getLiveMediaPrefs();
      setLiveMediaPrefs({
        ...prefs,
        videoDeviceId: next.videoDeviceId ?? prefs?.videoDeviceId,
        audioDeviceId: next.audioDeviceId ?? prefs?.audioDeviceId,
        videoResolution: next.videoResolution ?? prefs?.videoResolution ?? DEFAULT_LIVE_VIDEO_RESOLUTION,
        videoAspectRatio:
          next.videoAspectRatio ?? prefs?.videoAspectRatio ?? DEFAULT_LIVE_VIDEO_ASPECT_RATIO,
      });
      if (next.audioDeviceId !== undefined) setAudioDeviceId(next.audioDeviceId);
      if (next.videoDeviceId !== undefined) setVideoDeviceId(next.videoDeviceId);
      if (next.videoResolution !== undefined) setVideoResolution(next.videoResolution);
      if (next.videoAspectRatio !== undefined) setVideoAspectRatio(next.videoAspectRatio);
    },
    []
  );

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

  const switchCamera = useCallback(
    async (nextDeviceId: string): Promise<MediaStreamTrack | null> => {
      const stream = streamRef.current;
      const md = ensureMediaDevices();
      if (!stream || !md?.getUserMedia || mode !== 'camera' || !nextDeviceId) return null;
      if (nextDeviceId === videoDeviceId) return stream.getVideoTracks()[0] ?? null;

      setCamSwitching(true);
      setError(null);
      try {
        const track = await replaceLiveVideoTrack(
          stream,
          (c) => md.getUserMedia(c),
          nextDeviceId,
          videoResolution,
          videoAspectRatio
        );
        setVideoDeviceId(nextDeviceId);
        setLiveMediaPrefs({
          videoDeviceId: nextDeviceId,
          audioDeviceId: stream.getAudioTracks()[0]?.getSettings().deviceId ?? audioDeviceId,
        });
        const el = videoRef.current;
        if (el && el.srcObject === stream) {
          void attachPreview();
        }
        return track;
      } catch (e) {
        setError(mapLiveCameraError(e));
        return null;
      } finally {
        setCamSwitching(false);
      }
    },
    [audioDeviceId, attachPreview, mode, videoAspectRatio, videoDeviceId, videoResolution]
  );

  return {
    videoRef: setVideoRef,
    active,
    mode,
    error,
    setError,
    cameraUsable,
    audioDevices,
    videoDevices,
    audioDeviceId,
    videoDeviceId,
    videoResolution,
    videoAspectRatio,
    micSwitching,
    camSwitching,
    start,
    startFromFile,
    stop,
    getStream,
    broadcastStream,
    switchMicrophone,
    switchCamera,
    refreshMediaDevices,
    updateMediaDevicePrefs,
    previewBlocked,
    enableHostPreview,
  };
}
