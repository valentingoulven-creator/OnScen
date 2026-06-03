import { useCallback, useEffect, useRef, useState } from 'react';
import {
  REEL_RECORD_AUDIO_BITS_PER_SEC,
  REEL_RECORD_MAX_SEC,
  REEL_RECORD_VIDEO_BITS_PER_SEC,
  blobToDataUrl,
  cameraErrorMessage,
  captureVideoPosterDataUrl,
  pickRecorderMimeType,
} from '../lib/reelRecording';

export type RecordedReelMedia = {
  mediaUrl: string;
  posterUrl: string;
  durationSec: number;
  videoBlob: Blob;
};

type ReelRecorderProps = {
  onRecorded: (media: RecordedReelMedia) => void;
  onCancel: () => void;
};

type Phase = 'idle' | 'live' | 'recorded';

export function ReelRecorder({ onRecorded, onCancel }: ReelRecorderProps) {
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('idle');
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    setRecording(false);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      stopRecorder();
      stopStream();
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, [playbackUrl, stopRecorder, stopStream]);

  const attachLivePreview = useCallback((stream: MediaStream) => {
    const video = liveVideoRef.current;
    if (!video) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('L’enregistrement vidéo n’est pas pris en charge par ce navigateur.');
      return;
    }
    stopRecorder();
    stopStream();
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    setRecordedBlob(null);
    setRecordedDurationSec(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      });
      streamRef.current = stream;
      attachLivePreview(stream);
      setPhase('live');
    } catch (err) {
      setError(cameraErrorMessage(err));
      setPhase('idle');
    }
  }, [attachLivePreview, playbackUrl, stopRecorder, stopStream]);

  const finishRecording = useCallback(
    (blob: Blob, durationSec: number) => {
      stopStream();
      const url = URL.createObjectURL(blob);
      setPlaybackUrl(url);
      setRecordedBlob(blob);
      setRecordedDurationSec(durationSec);
      setPhase('recorded');
      setElapsedSec(durationSec);
    },
    [stopStream]
  );

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    setError(null);
    chunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: REEL_RECORD_VIDEO_BITS_PER_SEC,
        audioBitsPerSecond: REEL_RECORD_AUDIO_BITS_PER_SEC,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de démarrer l’enregistrement.');
      return;
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const durationSec = Math.max(
        1,
        Math.min(REEL_RECORD_MAX_SEC, Math.round((Date.now() - startedAtRef.current) / 1000))
      );
      const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] || 'video/webm' });
      chunksRef.current = [];
      if (blob.size < 1) {
        setError('Enregistrement vide. Réessayez.');
        setPhase('live');
        return;
      }
      finishRecording(blob, durationSec);
    };
    recorder.onerror = () => {
      setError('Erreur pendant l’enregistrement.');
      stopRecorder();
    };

    startedAtRef.current = Date.now();
    setRecording(true);
    setElapsedSec(0);
    recorder.start(500);

    timerRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(sec);
      if (sec >= REEL_RECORD_MAX_SEC) {
        stopRecorder();
      }
    }, 200);
  }, [finishRecording, recording, stopRecorder]);

  const retake = useCallback(() => {
    stopRecorder();
    if (playbackUrl) {
      URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(null);
    }
    setRecordedBlob(null);
    setRecordedDurationSec(0);
    setElapsedSec(0);
    void startCamera();
  }, [playbackUrl, startCamera, stopRecorder]);

  const confirmRecording = useCallback(async () => {
    if (!recordedBlob) return;
    setProcessing(true);
    setError(null);
    try {
      const mediaUrl = await blobToDataUrl(recordedBlob);
      const video = playbackRef.current;
      let posterUrl = video ? captureVideoPosterDataUrl(video) : null;
      if (!posterUrl) {
        posterUrl =
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';
      }
      onRecorded({
        mediaUrl,
        posterUrl,
        durationSec: recordedDurationSec,
        videoBlob: recordedBlob,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de préparer la vidéo.');
    } finally {
      setProcessing(false);
    }
  }, [onRecorded, recordedBlob, recordedDurationSec]);

  useEffect(() => {
    if (phase === 'recorded' && playbackUrl && playbackRef.current) {
      playbackRef.current.src = playbackUrl;
      void playbackRef.current.play().catch(() => {});
    }
  }, [phase, playbackUrl]);

  const timerLabel =
    phase === 'recorded'
      ? `${recordedDurationSec} s`
      : recording
        ? `${elapsedSec} / ${REEL_RECORD_MAX_SEC} s`
        : `Max ${REEL_RECORD_MAX_SEC} s`;

  return (
    <div className="rounded-xl border border-[#2d2d3d] bg-[#1a1a28] p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">Enregistrer un reel</p>
        <button
          type="button"
          onClick={() => {
            stopRecorder();
            stopStream();
            onCancel();
          }}
          className="text-xs text-gray-400 hover:text-white px-2"
        >
          Annuler
        </button>
      </div>

      <p className="text-[11px] text-gray-500 leading-snug">
        Prise courte recommandée (max {REEL_RECORD_MAX_SEC} s, faible débit) pour rester sous la limite
        serveur de 2 Mo en développement.
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="relative aspect-[9/16] max-h-[42dvh] mx-auto w-full max-w-[220px] rounded-xl overflow-hidden bg-black">
        {phase === 'recorded' && playbackUrl ? (
          <video
            ref={playbackRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            loop
            controls={false}
          />
        ) : (
          <video
            ref={liveVideoRef}
            className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
            playsInline
            muted
            autoPlay
          />
        )}
        {(phase === 'live' || phase === 'recorded') && (
          <span className="absolute top-2 left-2 z-10 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {recording && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
            {timerLabel}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="px-4 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold"
          >
            Activer la caméra
          </button>
        )}
        {phase === 'live' && !recording && (
          <button
            type="button"
            onClick={startRecording}
            className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-semibold"
          >
            Démarrer
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stopRecorder}
            className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold"
          >
            Arrêter
          </button>
        )}
        {phase === 'recorded' && (
          <>
            <button
              type="button"
              onClick={retake}
              disabled={processing}
              className="px-4 py-2 rounded-full border border-[#3d3d50] text-gray-200 text-sm disabled:opacity-40"
            >
              Reprendre
            </button>
            <button
              type="button"
              onClick={() => void confirmRecording()}
              disabled={processing}
              className="px-4 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {processing ? 'Préparation…' : 'Utiliser cette vidéo'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
