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

function IconFlip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" />
      <path d="M7 12h10M14 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  const stopStream = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCameraReady(false);
    setError(null);
    stopStream();
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facingMode, stopStream]);

  const finishRecording = useCallback(
    async (blob: Blob, durationSec: number) => {
      setProcessing(true);
      setError(null);
      try {
        if (captureEffect === 'boomerang') {
          const result = await createBoomerangVideoFromBlob(blob);
          onVideoCapture({
            videoUrl: result.videoUrl,
            posterUrl: result.posterUrl,
            durationSec: result.durationSec,
          });
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
        onVideoCapture({
          videoUrl,
          posterUrl,
          durationSec: Math.min(Math.max(durationSec, 1), STORY_VIDEO_MAX_SEC),
        });
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
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
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
      // 1080×1920 cible : 450 kbps vidéo produisait un rendu très pixelisé à cette résolution.
      // 2,5 Mbps / 128 kbps reste sous les standards TikTok/Instagram (3,5-16 Mbps) tout en
      // gardant une marge de sécurité sous le plafond de taille backend (STORY_VIDEO_MAX_DATA_
      // CHARS / MAX_FEED_VIDEO_DATA_CHARS ≈ 9 Mo bruts pour 15 s max → ~4,9 Mo utilisés ici).
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
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current.split(';')[0] ?? 'video/webm',
      });
      void finishRecording(blob, recordSecRef.current || 1);
    };
    recorder.start(250);
    setRecording(true);
    setRecordSec(0);
    timerRef.current = window.setInterval(() => {
      recordSecRef.current += 1;
      setRecordSec(recordSecRef.current);
      const maxSec =
        captureEffect === 'boomerang' ? BOOMERANG_CAPTURE_MAX_SEC : STORY_VIDEO_MAX_SEC;
      if (recordSecRef.current >= maxSec) {
        stopRecordingRef.current();
      }
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
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    clearHoldTimer();
    setShutterPressed(false);
    if (holdRecordingRef.current || recording) {
      holdRecordingRef.current = false;
      if (recording) stopRecording();
    }
  };

  const progressPct = Math.min(100, (recordSec / STORY_VIDEO_MAX_SEC) * 100);
  const ringRadius = 38;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progressPct / 100) * ringCirc;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black">
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          playsInline
          muted
          autoPlay
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/80 pointer-events-none" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0 pointer-events-none">
        <div className="shrink-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
            aria-label={t('stories.createClose', { defaultValue: 'Fermer' })}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          {recording ? (
            <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white tabular-nums shadow-lg">
              ● {recordSec}s
            </span>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
              Story
            </span>
          )}
          <button
            type="button"
            onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={processing || recording}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md disabled:opacity-40"
            aria-label={t('stories.createFlipCamera', { defaultValue: 'Retourner la caméra' })}
          >
            <IconFlip className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0" />

        <div className="shrink-0 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pointer-events-auto">
          {error ? (
            <p className="mb-3 text-center text-xs text-red-300 px-2 drop-shadow">{error}</p>
          ) : null}
          {processing ? (
            <p className="mb-3 text-center text-sm text-white/70">
              {captureEffect === 'boomerang'
                ? t('stories.createBoomerangProcessing', { defaultValue: 'Création du boomerang…' })
                : t('stories.createPreparing', { defaultValue: 'Préparation…' })}
            </p>
          ) : null}

          <div className="flex justify-center gap-2 mb-4">
            {(['normal', 'boomerang'] as const).map((effect) => (
              <button
                key={effect}
                type="button"
                disabled={processing || recording}
                onClick={() => setCaptureEffect(effect)}
                className={`min-h-9 px-3 rounded-full text-[11px] font-bold transition-all disabled:opacity-40 ${
                  captureEffect === effect
                    ? 'bg-white text-black'
                    : 'bg-white/15 text-white/70 ring-1 ring-white/20'
                }`}
              >
                {effect === 'normal'
                  ? t('stories.createEffectNormal', { defaultValue: 'Normal' })
                  : t('stories.createEffectBoomerang', { defaultValue: 'Boomerang' })}
              </button>
            ))}
          </div>

          <div className="flex items-end justify-between gap-6">
            <button
              type="button"
              onClick={onImportVideo}
              disabled={processing || recording}
              className="flex flex-col items-center gap-1.5 min-w-[4.5rem] disabled:opacity-40"
              aria-label={t('stories.createVideoImport', { defaultValue: 'Importer une vidéo' })}
            >
              <span className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 text-white">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect x="2" y="5" width="14" height="14" rx="2" />
                  <path d="M16 9l6-3v12l-6-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[10px] font-medium text-white/70">
                {t('stories.createVideoImportShort', { defaultValue: 'Importer' })}
              </span>
            </button>

            <div className="flex flex-col items-center gap-2">
              <div className="relative w-[5.25rem] h-[5.25rem] flex items-center justify-center">
                {recording ? (
                  <svg
                    className="absolute inset-0 -rotate-90 w-full h-full"
                    viewBox="0 0 88 88"
                    aria-hidden
                  >
                    <circle cx="44" cy="44" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                    <circle
                      cx="44"
                      cy="44"
                      r={ringRadius}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={ringCirc}
                      strokeDashoffset={ringOffset}
                      className="transition-[stroke-dashoffset] duration-300"
                    />
                  </svg>
                ) : null}
                <button
                  type="button"
                  disabled={processing || !cameraReady}
                  onPointerDown={onShutterPointerDown}
                  onPointerUp={onShutterPointerUp}
                  onPointerCancel={onShutterPointerCancel}
                  className={`relative z-10 w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center touch-none select-none transition-transform duration-100 ring-[3px] ring-white ${
                    recording ? 'scale-105' : shutterPressed ? 'scale-95' : ''
                  } disabled:opacity-40`}
                  aria-label={t('stories.createShutter', { defaultValue: 'Capturer' })}
                >
                  <span
                    className={`transition-all duration-150 ${
                      recording
                        ? 'w-7 h-7 rounded-md bg-red-500'
                        : shutterPressed
                          ? 'w-[3rem] h-[3rem] rounded-full bg-white/90'
                          : 'w-[3.75rem] h-[3.75rem] rounded-full bg-white'
                    }`}
                  />
                </button>
              </div>
              {!recording && !processing ? (
                <p className="text-[10px] text-white/55 text-center leading-snug max-w-[8rem]">
                  {captureEffect === 'boomerang'
                    ? t('stories.createBoomerangHint', {
                        defaultValue: 'Maintenir · max {{sec}} s',
                        sec: BOOMERANG_CAPTURE_MAX_SEC,
                      })
                    : t('stories.createCameraHintIg', {
                        defaultValue: 'Maintenir · vidéo · Appuyer · photo',
                      })}
                </p>
              ) : null}
            </div>

            <div className="min-w-[4.5rem]" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
