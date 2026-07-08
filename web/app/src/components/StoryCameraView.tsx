import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  blobToDataUrl,
  cameraErrorMessage,
  captureVideoPosterDataUrl,
  pickRecorderMimeType,
} from '../lib/reelRecording';
import { BOOMERANG_CAPTURE_MAX_SEC, createBoomerangVideoFromBlob } from '../lib/storyBoomerang';
import { STORY_VIDEO_MAX_SEC } from '../lib/storyVideo';

const HOLD_THRESHOLD_MS = 220;

export type StoryCaptureEffect = 'normal' | 'boomerang';

export interface StoryVideoCaptureResult {
  videoUrl: string;
  posterUrl: string;
  durationSec: number;
}

interface StoryCameraViewProps {
  onPhotoCapture: (dataUrl: string) => void;
  onVideoCapture: (result: StoryVideoCaptureResult) => void;
  onImportVideo: () => void;
  onClose: () => void;
}

/* ─── Icon helpers ─── */

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function IconFlip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" />
      <path d="M7 12h10M14 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlash({ className, on }: { className?: string; on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBoomerang({ className, active }: { className?: string; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M12 5C7.03 5 3 9.03 3 14s4.03 9 9 9"
        strokeLinecap="round"
        style={{ opacity: active ? 1 : 0.6 }}
      />
      <path
        d="M12 5C16.97 5 21 9.03 21 14s-4.03 9-9 9"
        strokeLinecap="round"
        style={{ opacity: active ? 1 : 0.6 }}
      />
      <path d="M12 5V2M9.5 3.5L12 2l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGallery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M3 15l5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Small vertical sidebar button (right rail) */
function SidebarBtn({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 disabled:opacity-40 group`}
      aria-label={label}
    >
      <span
        className={`w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-md transition-colors ${
          active
            ? 'bg-white text-black'
            : 'bg-black/50 text-white ring-1 ring-white/20'
        }`}
      >
        {children}
      </span>
      <span className="text-[9px] font-semibold text-white/70 leading-none max-w-[3rem] text-center">{label}</span>
    </button>
  );
}

/* ─── Main component ─── */

export function StoryCameraView({
  onPhotoCapture,
  onVideoCapture,
  onImportVideo,
  onClose,
}: StoryCameraViewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const recordSecRef = useRef(0);
  const holdRecordingRef = useRef(false);
  const stopRecordingRef = useRef<() => void>(() => {});
  const mimeTypeRef = useRef('video/webm');

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [captureEffect, setCaptureEffect] = useState<StoryCaptureEffect>('normal');
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [shutterPressed, setShutterPressed] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [flashSupported, setFlashSupported] = useState(false);

  /* ── stream management ── */

  const stopStream = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current != null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (holdTimerRef.current != null) { window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCameraReady(false);
    setError(null);
    setFlashOn(false);
    setFlashSupported(false);
    stopStream();
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const caps = videoTrack.getCapabilities?.() as Record<string, unknown> | undefined;
          if (caps && 'torch' in caps) setFlashSupported(true);
        }
        setCameraReady(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();
    return () => { cancelled = true; stopStream(); };
  }, [facingMode, stopStream]);

  const toggleFlash = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !flashSupported) return;
    const next = !flashOn;
    try {
      await (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
        .applyConstraints({ advanced: [{ torch: next }] });
      setFlashOn(next);
    } catch { /* torch not available */ }
  }, [flashOn, flashSupported]);

  /* ── recording ── */

  const finishRecording = useCallback(
    async (blob: Blob, durationSec: number) => {
      setProcessing(true);
      setError(null);
      try {
        if (captureEffect === 'boomerang') {
          const result = await createBoomerangVideoFromBlob(blob);
          onVideoCapture({ videoUrl: result.videoUrl, posterUrl: result.posterUrl, durationSec: result.durationSec });
          return;
        }
        const videoUrl = await blobToDataUrl(blob);
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('Aperçu vidéo impossible'));
          video.src = videoUrl;
        });
        const posterUrl = captureVideoPosterDataUrl(video) ?? '';
        onVideoCapture({ videoUrl, posterUrl, durationSec: Math.min(Math.max(durationSec, 1), STORY_VIDEO_MAX_SEC) });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Enregistrement impossible');
        setProcessing(false);
        setRecording(false);
        setShutterPressed(false);
        holdRecordingRef.current = false;
      }
    },
    [captureEffect, onVideoCapture]
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current != null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
    setShutterPressed(false);
  }, []);

  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recording || processing) return;
    setError(null);
    chunksRef.current = [];
    recordSecRef.current = 0;
    const mimeType = pickRecorderMimeType();
    mimeTypeRef.current = mimeType;
    let recorder: MediaRecorder;
    try {
      // 2.5 Mbps / 128 kbps: qualité suffisante pour 1080×1920, sous le plafond backend (~9 Mo / 15 s)
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      });
    } catch {
      setError(t('stories.createVideoRecordError', { defaultValue: 'Enregistrement non supporté' }));
      holdRecordingRef.current = false;
      setShutterPressed(false);
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current.split(';')[0] ?? 'video/webm' });
      void finishRecording(blob, recordSecRef.current || 1);
    };
    recorder.start(250);
    setRecording(true);
    setRecordSec(0);
    timerRef.current = window.setInterval(() => {
      recordSecRef.current += 1;
      setRecordSec(recordSecRef.current);
      const maxSec = captureEffect === 'boomerang' ? BOOMERANG_CAPTURE_MAX_SEC : STORY_VIDEO_MAX_SEC;
      if (recordSecRef.current >= maxSec) stopRecordingRef.current();
    }, 1000);
  }, [captureEffect, finishRecording, processing, recording, t]);

  const capturePhoto = useCallback(() => {
    if (captureEffect === 'boomerang') return;
    const video = videoRef.current;
    if (!video || processing || recording) return;
    const dataUrl = captureVideoPosterDataUrl(video, 1080, 0.92);
    if (!dataUrl) {
      setError(t('stories.createAttachError', { defaultValue: "Impossible d'ajouter l'image." }));
      return;
    }
    onPhotoCapture(dataUrl);
  }, [captureEffect, onPhotoCapture, processing, recording, t]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) { window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
  };

  /* ── pointer handlers ── */

  const onShutterPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (processing || !cameraReady) return;
    if (captureEffect === 'boomerang' && !recording) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setShutterPressed(true);
      holdRecordingRef.current = true;
      startRecording();
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setShutterPressed(true);
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdRecordingRef.current = true;
      startRecording();
    }, HOLD_THRESHOLD_MS);
  };

  const onShutterPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    clearHoldTimer();
    setShutterPressed(false);
    if (holdRecordingRef.current || recording) {
      holdRecordingRef.current = false;
      if (recording) stopRecording();
      return;
    }
    capturePhoto();
  };

  const onShutterPointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    clearHoldTimer();
    setShutterPressed(false);
    if (holdRecordingRef.current || recording) {
      holdRecordingRef.current = false;
      if (recording) stopRecording();
    }
  };

  /* ── progress ring ── */

  const progressPct = Math.min(100, (recordSec / STORY_VIDEO_MAX_SEC) * 100);
  const ringRadius = 40;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progressPct / 100) * ringCirc;

  /* ─────────────────────────────────────────────── */
  /* Render                                          */
  /* ─────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-[120] bg-black touch-none overflow-hidden">

      {/* ── Video layer ── */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          playsInline
          muted
          autoPlay
        />
        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        {/* Camera loading shimmer */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          </div>
        )}
      </div>

      {/* ── Recording progress bar (absolute top) ── */}
      {recording && (
        <div className="absolute top-0 inset-x-0 z-30 h-[3px] bg-white/15">
          <div
            className="h-full bg-red-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 pointer-events-auto">
        {/* Close */}
        <button
          type="button"
          onClick={() => { stopStream(); onClose(); }}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-white ring-1 ring-white/10"
          aria-label={t('stories.createClose', { defaultValue: 'Fermer' })}
        >
          <IconClose className="w-5 h-5" />
        </button>

        {/* Center: recording badge or mode label */}
        {recording ? (
          <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-bold text-white tabular-nums tracking-wide">{recordSec}s</span>
          </div>
        ) : processing ? (
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            <span className="text-[11px] font-semibold text-white/80">
              {captureEffect === 'boomerang'
                ? t('stories.createBoomerangProcessing', { defaultValue: 'Boomerang…' })
                : t('stories.createPreparing', { defaultValue: 'Préparation…' })}
            </span>
          </div>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Story
          </span>
        )}

        {/* Flash toggle */}
        <button
          type="button"
          onClick={() => { void toggleFlash(); }}
          disabled={!flashSupported || recording}
          className={`w-11 h-11 flex items-center justify-center rounded-full backdrop-blur-md ring-1 transition-colors disabled:opacity-30 ${
            flashOn
              ? 'bg-yellow-400/90 text-black ring-yellow-300/50'
              : 'bg-black/45 text-white ring-white/10'
          }`}
          aria-label={
            flashOn
              ? t('stories.createFlashOn', { defaultValue: 'Flash activé' })
              : t('stories.createFlashOff', { defaultValue: 'Flash désactivé' })
          }
        >
          <IconFlash className="w-5 h-5" on={flashOn} />
        </button>
      </div>

      {/* ── Right sidebar ── */}
      <div
        className="absolute right-3 z-20 flex flex-col items-center gap-4 pointer-events-auto"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        {/* Flip camera */}
        <SidebarBtn
          onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={processing || recording}
          label={t('stories.createFlipCamera', { defaultValue: 'Retourner' })}
        >
          <IconFlip className="w-5 h-5" />
        </SidebarBtn>

        {/* Boomerang effect */}
        <SidebarBtn
          onClick={() => setCaptureEffect((e) => (e === 'boomerang' ? 'normal' : 'boomerang'))}
          disabled={processing || recording}
          active={captureEffect === 'boomerang'}
          label={t('stories.createEffectBoomerang', { defaultValue: 'Boomerang' })}
        >
          <IconBoomerang className="w-5 h-5" active={captureEffect === 'boomerang'} />
        </SidebarBtn>
      </div>

      {/* ── Bottom area ── */}
      <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">

        {/* Error message */}
        {error && (
          <p className="mb-3 text-center text-xs text-red-300 px-6 drop-shadow leading-snug">
            {error}
          </p>
        )}

        {/* Effect label strip (when boomerang active and not recording) */}
        {captureEffect === 'boomerang' && !recording && !processing && (
          <div className="flex justify-center mb-3">
            <span className="bg-white/15 backdrop-blur-sm ring-1 ring-white/20 rounded-full px-3 py-1 text-[10px] font-bold text-white/80 uppercase tracking-wider">
              {t('stories.createEffectBoomerang', { defaultValue: 'Boomerang' })}
              {' '}· {t('stories.createBoomerangHint', { defaultValue: 'Maintenir · max {{sec}} s', sec: BOOMERANG_CAPTURE_MAX_SEC })}
            </span>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-end justify-between px-10">

          {/* Gallery / Import */}
          <button
            type="button"
            onClick={onImportVideo}
            disabled={processing || recording}
            className="flex flex-col items-center gap-1.5 disabled:opacity-40"
            aria-label={t('stories.createVideoImport', { defaultValue: 'Importer une vidéo' })}
          >
            <span className="w-[3.25rem] h-[3.25rem] flex items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white transition-opacity">
              <IconGallery className="w-6 h-6" />
            </span>
            <span className="text-[9px] font-semibold text-white/60 leading-none">
              {t('stories.createGallery', { defaultValue: 'Galerie' })}
            </span>
          </button>

          {/* Shutter button */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Animated progress ring */}
              {recording && (
                <svg
                  className="absolute inset-0 -rotate-90 w-full h-full"
                  viewBox="0 0 96 96"
                  aria-hidden
                >
                  <circle cx="48" cy="48" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
                  <circle
                    cx="48"
                    cy="48"
                    r={ringRadius}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
              )}

              {/* Outer ring pulse on shutter press */}
              {shutterPressed && !recording && (
                <span className="absolute inset-0 rounded-full ring-[3px] ring-white/40 scale-110 animate-ping pointer-events-none" />
              )}

              <button
                type="button"
                disabled={processing || !cameraReady}
                onPointerDown={onShutterPointerDown}
                onPointerUp={onShutterPointerUp}
                onPointerCancel={onShutterPointerCancel}
                className={`relative z-10 w-[4.75rem] h-[4.75rem] rounded-full flex items-center justify-center touch-none select-none transition-transform duration-150 ring-[3.5px] ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] disabled:opacity-40 ${
                  recording ? 'scale-[1.08]' : shutterPressed ? 'scale-90' : 'active:scale-90'
                }`}
                aria-label={
                  recording
                    ? t('stories.createVideoRecordStop', { defaultValue: 'Arrêter' })
                    : t('stories.createShutter', { defaultValue: 'Capturer' })
                }
              >
                <span
                  className={`transition-all duration-150 pointer-events-none ${
                    recording
                      ? 'w-6 h-6 rounded-[6px] bg-red-500 shadow-sm'
                      : shutterPressed
                        ? 'w-[3.25rem] h-[3.25rem] rounded-full bg-white/85'
                        : 'w-[4rem] h-[4rem] rounded-full bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Hint */}
            {!recording && !processing && (
              <p className="text-[10px] text-white/50 text-center leading-snug max-w-[9rem]">
                {captureEffect === 'boomerang'
                  ? t('stories.createBoomerangHint', { defaultValue: 'Maintenir · max {{sec}} s', sec: BOOMERANG_CAPTURE_MAX_SEC })
                  : t('stories.createCameraHintIg', { defaultValue: 'Maintenir · vidéo  ·  Appuyer · photo' })}
              </p>
            )}
          </div>

          {/* Spacer (mirrors gallery width) */}
          <div className="w-[3.25rem] h-[3.25rem]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
