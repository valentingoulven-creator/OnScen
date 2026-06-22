import { useCallback, useEffect, useRef, useState } from 'react';
import { notifyReelsUpdated } from '../lib/reelsRefresh';
import { api } from '../lib/api';
import type { MusicReel } from '../content/reels';
import {
  REEL_RECORD_MAX_SEC,
  REEL_RECORD_AUDIO_BITS_PER_SEC,
  REEL_RECORD_VIDEO_BITS_PER_SEC,
  blobToDataUrl,
  cameraErrorMessage,
  captureVideoPosterDataUrl,
  estimateCreateReelPayloadBytes,
  formatPayloadSize,
  importVideoFile,
  payloadTooLargeForMsdev,
  pickRecorderMimeType,
} from '../lib/reelRecording';

interface ProfileReelRecorderProps {
  token: string;
  defaultArtist?: string;
  onSaved: (reel?: MusicReel) => void;
  /** Dans une modale (sans carte section externe). */
  embedded?: boolean;
}

type Phase = 'idle' | 'camera' | 'recording' | 'review' | 'imported';

export function ProfileReelRecorder({
  token,
  defaultArtist = '',
  onSaved,
  embedded = false,
}: ProfileReelRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [importedMediaUrl, setImportedMediaUrl] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState(defaultArtist);
  const [genre, setGenre] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    setArtist((a) => a || defaultArtist);
  }, [defaultArtist]);

  const attachStream = useCallback(() => {
    const stream = streamRef.current;
    const el = videoRef.current;
    if (!stream || !el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    }
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Votre navigateur ne prend pas en charge la caméra.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      setPhase('camera');
      setRecordSec(0);
      window.setTimeout(attachStream, 50);
    } catch (e) {
      setCameraError(cameraErrorMessage(e));
      stopCamera();
      setPhase('idle');
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setError('Enregistrement non supporté sur cet appareil.');
      return;
    }
    chunksRef.current = [];
    const mime = pickRecorderMimeType();
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: REEL_RECORD_VIDEO_BITS_PER_SEC,
        audioBitsPerSecond: REEL_RECORD_AUDIO_BITS_PER_SEC,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void finishRecording();
      recorderRef.current = recorder;
      recorder.start(200);
      setPhase('recording');
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          const next = s + 1;
          if (next >= REEL_RECORD_MAX_SEC) stopRecording();
          return next;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de démarrer l’enregistrement');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const finishRecording = async () => {
    const blob = new Blob(chunksRef.current, { type: pickRecorderMimeType() });
    if (!blob.size) {
      setError('Enregistrement vide. Réessayez.');
      setPhase('camera');
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setDurationSec(Math.max(1, recordSec || 1));
    stopCamera();
    setPhase('review');
    window.setTimeout(() => {
      const el = videoRef.current;
      if (el) {
        el.srcObject = null;
        el.src = url;
        el.muted = false;
        void el.play().catch(() => undefined);
        el.onloadeddata = () => {
          const poster = captureVideoPosterDataUrl(el);
          if (poster) setPosterUrl(poster);
        };
      }
    }, 80);
  };

  const resetToIdle = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPosterUrl(null);
    setImportedMediaUrl(null);
    setTitle('');
    setGenre('');
    setRecordSec(0);
    setDurationSec(0);
    setError(null);
    stopCamera();
    setPhase('idle');
  };

  const savePrivateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!importedMediaUrl && !previewUrl) return;
    setError(null);
    setSubmitting(true);
    try {
      let videoDataUrl: string;
      let poster: string | undefined;
      const dur = durationSec;

      if (importedMediaUrl) {
        videoDataUrl = importedMediaUrl;
        poster = posterUrl ?? undefined;
      } else if (previewUrl) {
        const videoEl = videoRef.current;
        if (videoEl?.src?.startsWith('blob:')) {
          const res = await fetch(videoEl.src);
          videoDataUrl = await blobToDataUrl(await res.blob());
        } else {
          const res = await fetch(previewUrl);
          videoDataUrl = await blobToDataUrl(await res.blob());
        }
        poster =
          posterUrl ||
          (videoEl ? captureVideoPosterDataUrl(videoEl) : null) ||
          undefined;
      } else {
        return;
      }

      const body = {
        title: title.trim(),
        artist: artist.trim(),
        genre: genre.trim(),
        mediaType: 'video' as const,
        mediaUrl: videoDataUrl,
        posterUrl: poster,
        durationSec: dur,
        visibility: 'private' as const,
        isPrivate: true,
      };
      const payloadBytes = estimateCreateReelPayloadBytes(body);
      if (payloadTooLargeForMsdev(payloadBytes)) {
        setError(
          `Vidéo trop lourde (${formatPayloadSize(payloadBytes)}). Enregistrez moins de ${REEL_RECORD_MAX_SEC} s ou rapprochez-vous du routeur.`
        );
        return;
      }
      const res = await api.createReel(token, body);
      resetToIdle();
      notifyReelsUpdated();
      onSaved(res.reel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportVideo = async (file: File) => {
    setError(null);
    setSubmitting(true);
    try {
      const { mediaUrl, posterUrl: importedPoster, durationSec: dur } = await importVideoFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setImportedMediaUrl(mediaUrl);
      setPosterUrl(importedPoster);
      setDurationSec(dur);
      setPhase('imported');
      window.setTimeout(() => {
        const el = videoRef.current;
        if (el) {
          el.srcObject = null;
          el.src = mediaUrl;
          el.muted = false;
          void el.play().catch(() => undefined);
        }
      }, 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible');
    } finally {
      setSubmitting(false);
    }
  };

  const showReviewForm = phase === 'review' || phase === 'imported';

  const content = (
    <>
      {!embedded && (
        <div>
          <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Enregistrer</h3>
          <p className="text-[11px] text-gray-500 mt-1">
            Vos reels enregistrés restent privés sur votre profil. Ils n’apparaissent pas dans l’onglet Reels public.
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-[11px] text-gray-500 leading-snug">
          Enregistrez ou importez une vidéo. Le reel est d’abord privé — vous pourrez le publier dans le flux ensuite.
        </p>
      )}

      {(cameraError || error) && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
          {cameraError ?? error}
        </p>
      )}

      <div className="relative aspect-[9/16] max-h-[52dvh] mx-auto w-full max-w-[240px] rounded-2xl overflow-hidden bg-black border border-[#2d2d3d]">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted={phase === 'camera' || phase === 'recording'}
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500 p-4 text-center">
            <span className="text-4xl">🎬</span>
            <p className="text-xs">Caméra et micro requis</p>
          </div>
        )}
        {phase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-white tabular-nums">
              {recordSec}s / {REEL_RECORD_MAX_SEC}s
            </span>
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void startCamera()}
            className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold text-white shadow-lg shadow-pink-900/30"
          >
            Ouvrir la caméra
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/webm,video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void handleImportVideo(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-200 hover:border-pink-500/40 disabled:opacity-40"
          >
            {submitting ? 'Import…' : 'Importer une vidéo'}
          </button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetToIdle}
            className="flex-1 py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={startRecording}
            className="flex-[2] py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold text-white"
          >
            Enregistrer
          </button>
        </div>
      )}

      {phase === 'recording' && (
        <button
          type="button"
          onClick={stopRecording}
          className="w-full py-3.5 rounded-xl bg-[#1a1a26] border-2 border-red-500 font-bold text-red-300"
        >
          Arrêter
        </button>
      )}

      {showReviewForm && (
        <form onSubmit={(e) => void savePrivateReel(e)} className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-400">Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Artiste</span>
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              required
              maxLength={120}
              className="mt-1 w-full rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Genre</span>
            <input
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              required
              maxLength={80}
              placeholder="Ex: Pop, Électro…"
              className="mt-1 w-full rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetToIdle}
              className="flex-1 py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300"
            >
              Refaire
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !artist.trim() || !genre.trim()}
              className="flex-[2] py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-40"
            >
              {submitting ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
      {content}
    </section>
  );
}
