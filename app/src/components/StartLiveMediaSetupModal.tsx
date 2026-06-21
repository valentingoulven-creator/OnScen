import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquireLiveCameraStream,
  attachLiveCameraStream,
  ensureMediaDevices,
  getLiveCameraContextHints,
  getLiveCameraPreflightError,
  mapLiveCameraError,
} from '../lib/liveCameraSupport';
import {
  getLiveMediaDraft,
  setLiveMediaDraft,
  setLiveMediaPrefs,
  setPendingLiveCameraStart,
  type LiveMediaPrefs,
} from '../lib/liveMediaPrefs';

type Phase = 'loading' | 'config' | 'error';

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface StartLiveMediaSetupModalProps {
  open: boolean;
  onClose: () => void;
  onReady: (prefs: LiveMediaPrefs) => void;
  confirmLabel?: string;
}

function deviceSelectClass(disabled: boolean): string {
  return `w-full mt-1 px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] text-sm text-white ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  }`;
}

export function StartLiveMediaSetupModal({
  open,
  onClose,
  onReady,
  confirmLabel = 'Démarrer le live',
}: StartLiveMediaSetupModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');
  const [switching, setSwitching] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const el = videoRef.current;
    if (el) el.srcObject = null;
  }, []);

  const attachPreview = useCallback(async (stream: MediaStream) => {
    const el = videoRef.current;
    if (!el) return;
    await attachLiveCameraStream(el, stream);
  }, []);

  const attachPreviewWhenReady = useCallback(
    (stream: MediaStream) => {
      let cancelled = false;
      let raf = 0;
      const tryAttach = () => {
        if (cancelled) return;
        if (!videoRef.current) {
          raf = requestAnimationFrame(tryAttach);
          return;
        }
        void attachPreview(stream);
      };
      tryAttach();
      return () => {
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
      };
    },
    [attachPreview]
  );

  const refreshDeviceLists = useCallback(async () => {
    const md = ensureMediaDevices();
    if (!md?.enumerateDevices) return;
    const all = await md.enumerateDevices();
    setCameras(
      all
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Caméra ${i + 1}` }))
    );
    setMics(
      all
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Micro ${i + 1}` }))
    );
  }, []);

  const openStream = useCallback(async (videoId?: string, audioId?: string) => {
    const md = ensureMediaDevices();
    if (!md?.getUserMedia) throw new DOMException('', 'NotSupportedError');
    return acquireLiveCameraStream((c) => md.getUserMedia(c), {
      videoDeviceId: videoId,
      audioDeviceId: audioId,
    });
  }, []);

  const persistDraft = useCallback((video: string, audio: string) => {
    setLiveMediaDraft({
      videoDeviceId: video || undefined,
      audioDeviceId: audio || undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      return;
    }

    let cancelled = false;

    const init = async () => {
      setPhase('loading');
      setError(null);
      setHints(getLiveCameraContextHints());

      const preflight = getLiveCameraPreflightError();
      if (preflight) {
        if (!cancelled) {
          setError(preflight);
          setPhase('error');
        }
        return;
      }

      const draft = getLiveMediaDraft();

      try {
        stopStream();
        const stream = await openStream(
          draft?.videoDeviceId,
          draft?.audioDeviceId
        );
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        await refreshDeviceLists();

        const vTrack = stream.getVideoTracks()[0];
        const aTrack = stream.getAudioTracks()[0];
        const nextVideoId = vTrack?.getSettings().deviceId ?? draft?.videoDeviceId ?? '';
        const nextAudioId = aTrack?.getSettings().deviceId ?? draft?.audioDeviceId ?? '';
        setVideoDeviceId(nextVideoId);
        setAudioDeviceId(nextAudioId);
        persistDraft(nextVideoId, nextAudioId);
        setPhase('config');
      } catch (e) {
        if (!cancelled) {
          setError(mapLiveCameraError(e));
          setPhase('error');
          stopStream();
        }
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [open, stopStream, openStream, refreshDeviceLists, persistDraft]);

  useEffect(() => {
    if (phase !== 'config' || !streamRef.current) return;
    return attachPreviewWhenReady(streamRef.current);
  }, [phase, attachPreviewWhenReady]);

  const handleVideoChange = async (nextId: string) => {
    setVideoDeviceId(nextId);
    persistDraft(nextId, audioDeviceId);
    setSwitching(true);
    setError(null);
    try {
      stopStream();
      const stream = await openStream(nextId || undefined, audioDeviceId || undefined);
      streamRef.current = stream;
      attachPreviewWhenReady(stream);
    } catch (e) {
      setError(mapLiveCameraError(e));
      setPhase('error');
    } finally {
      setSwitching(false);
    }
  };

  const handleAudioChange = async (nextId: string) => {
    setAudioDeviceId(nextId);
    persistDraft(videoDeviceId, nextId);
    setSwitching(true);
    setError(null);
    try {
      stopStream();
      const stream = await openStream(videoDeviceId || undefined, nextId || undefined);
      streamRef.current = stream;
      attachPreviewWhenReady(stream);
    } catch (e) {
      setError(mapLiveCameraError(e));
      setPhase('error');
    } finally {
      setSwitching(false);
    }
  };

  const handleConfirm = () => {
    const prefs: LiveMediaPrefs = {
      videoDeviceId: videoDeviceId || undefined,
      audioDeviceId: audioDeviceId || undefined,
    };
    setLiveMediaPrefs(prefs);
    setPendingLiveCameraStart();
    stopStream();
    onReady(prefs);
  };

  const handleClose = () => {
    if (phase === 'config') {
      persistDraft(videoDeviceId, audioDeviceId);
    }
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-media-setup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[min(92dvh,36rem)] flex flex-col">
        <div className="h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 shrink-0" />

        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          <p id="live-media-setup-title" className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-red-400">●</span> Caméra et micro
          </p>

          {phase === 'loading' && (
            <p className="text-sm text-gray-400 mt-3">Demande d&apos;accès à la caméra et au micro…</p>
          )}

          {phase === 'error' && error && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-red-300 leading-relaxed">{error}</p>
              {hints.map((hint) => (
                <p key={hint} className="text-xs text-gray-500 leading-relaxed">
                  {hint}
                </p>
              ))}
            </div>
          )}

          {phase === 'config' && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-400 leading-relaxed">
                Choisissez vos périphériques : la caméra s&apos;activera automatiquement dès
                l&apos;ouverture du live.
              </p>

              <div className="relative aspect-video w-full bg-[#0b0b0f] rounded-xl overflow-hidden border border-[#2d2d3d]">
                <video
                  ref={videoRef}
                  autoPlay
                  className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
                  muted
                  playsInline
                  aria-label="Aperçu caméra"
                />
                {switching && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                    Changement…
                  </div>
                )}
              </div>

              {cameras.length > 1 && (
                <label className="block text-xs text-gray-400">
                  Caméra
                  <select
                    value={videoDeviceId}
                    disabled={switching}
                    onChange={(e) => void handleVideoChange(e.target.value)}
                    className={deviceSelectClass(switching)}
                  >
                    {cameras.map((c) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mics.length > 1 && (
                <label className="block text-xs text-gray-400">
                  Microphone
                  <select
                    value={audioDeviceId}
                    disabled={switching}
                    onChange={(e) => void handleAudioChange(e.target.value)}
                    className={deviceSelectClass(switching)}
                  >
                    {mics.map((m) => (
                      <option key={m.deviceId} value={m.deviceId}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {cameras.length <= 1 && mics.length <= 1 && (
                <p className="text-xs text-gray-500">Un seul périphérique détecté pour chaque entrée.</p>
              )}

              {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
          )}
        </div>

        {(phase === 'config' || phase === 'error') && (
          <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl bg-[#2d2d3d] text-white text-sm font-semibold"
            >
              Fermer
            </button>
            {phase === 'config' && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={switching}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
