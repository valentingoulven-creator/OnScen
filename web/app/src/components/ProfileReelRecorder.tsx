import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyReelsUpdated } from '../lib/reelsRefresh';
import { api } from '../lib/api';
import type { MusicReel } from '../content/reels';
import type { UserAlbumItem, UserCompositionItem } from './UserCompositionsSection';
import {
  groupCompositionsForPicker,
  resolveCompositionPlaybackUrl,
  type ReelAudioSource,
} from '../lib/reelCompositionAudio';
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

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ProfileReelRecorder({
  token,
  defaultArtist = '',
  onSaved,
  embedded = false,
}: ProfileReelRecorderProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
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
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const [audioSource, setAudioSource] = useState<ReelAudioSource>('mic');
  const [selectedComposition, setSelectedComposition] = useState<UserCompositionItem | null>(null);
  const [compositions, setCompositions] = useState<UserCompositionItem[]>([]);
  const [albums, setAlbums] = useState<UserAlbumItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const usesCompositionAudio = audioSource === 'composition' && selectedComposition != null;

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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void Promise.all([api.getMyCompositions(token), api.getMyAlbums(token)])
      .then(([compRes, albumRes]) => {
        if (cancelled) return;
        setCompositions(compRes.compositions ?? []);
        setAlbums(albumRes.albums ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalogError(t('reels.createCatalogError', { defaultValue: 'Discographie indisponible' }));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const pickComposition = (track: UserCompositionItem) => {
    setSelectedComposition(track);
    if (!title.trim()) setTitle(track.title);
    if (!artist.trim()) setArtist(track.artist?.trim() || defaultArtist);
  };

  const syncCompositionPreview = useCallback(() => {
    const video = videoRef.current;
    const audio = audioPreviewRef.current;
    if (!video || !audio || !usesCompositionAudio || !selectedComposition) return;
    if (Math.abs(audio.currentTime - video.currentTime) > 0.25) {
      audio.currentTime = video.currentTime;
    }
  }, [selectedComposition, usesCompositionAudio]);

  useEffect(() => {
    const inReview = phase === 'review' || phase === 'imported';
    if (!inReview || !usesCompositionAudio) return;
    const video = videoRef.current;
    const audio = audioPreviewRef.current;
    if (!video || !audio || !selectedComposition) return;

    audio.src = resolveCompositionPlaybackUrl(selectedComposition.fileUrl);
    audio.loop = true;
    video.muted = true;

    const onPlay = () => {
      syncCompositionPreview();
      void audio.play().catch(() => undefined);
    };
    const onPause = () => audio.pause();
    const onSeeked = () => syncCompositionPreview();
    const onTimeUpdate = () => syncCompositionPreview();

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('timeupdate', onTimeUpdate);
      audio.pause();
      audio.removeAttribute('src');
    };
  }, [phase, selectedComposition, syncCompositionPreview, usesCompositionAudio]);

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
        audio: !usesCompositionAudio,
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
      setError(e instanceof Error ? e.message : 'Impossible de démarrer l\'enregistrement');
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
        el.muted = usesCompositionAudio;
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
    setLink('');
    setLinkError(null);
    setRecordSec(0);
    setDurationSec(0);
    setError(null);
    setRightsConfirmed(false);
    setSelectedComposition(null);
    setAudioSource('mic');
    stopCamera();
    setPhase('idle');
  };

  const validateLink = (): boolean => {
    if (!link.trim()) return true;
    if (!isValidHttpUrl(link)) {
      setLinkError(t('reels.createLinkInvalid', { defaultValue: 'URL invalide (commencer par https://)' }));
      return false;
    }
    setLinkError(null);
    return true;
  };

  const savePrivateReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!rightsConfirmed) {
      setError(t('profile.compositions.rightsConfirmRequired'));
      return;
    }
    if (!validateLink()) return;
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
        ...(link.trim() ? { link: link.trim() } : {}),
        mediaType: 'video' as const,
        mediaUrl: videoDataUrl,
        posterUrl: poster,
        durationSec: dur,
        visibility: 'private' as const,
        isPrivate: true,
        rightsConfirmed: true,
        ...(usesCompositionAudio && selectedComposition
          ? { compositionId: selectedComposition.id }
          : {}),
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
          el.muted = usesCompositionAudio;
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
  const compositionGroups = groupCompositionsForPicker(compositions, albums);
  const canCapture = audioSource === 'mic' || selectedComposition != null;

  const videoFrameClass = embedded
    ? phase === 'camera' || phase === 'recording'
      ? 'relative aspect-[9/16] mx-auto w-full max-w-[min(100%,15rem)] max-h-[min(48dvh,20rem)] shrink-0 rounded-[1.35rem] overflow-hidden bg-black shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_8px_32px_rgba(236,72,153,0.12)]'
      : phase === 'idle'
        ? 'relative aspect-[9/16] mx-auto w-full max-w-[min(100%,10.5rem)] max-h-[min(36dvh,14rem)] shrink-0 rounded-[1.35rem] overflow-hidden bg-gradient-to-b from-white/[0.06] to-black shadow-[0_0_0_2px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)]'
        : 'relative aspect-[9/16] mx-auto w-full max-w-[min(100%,13rem)] max-h-[min(38dvh,16rem)] shrink-0 rounded-[1.35rem] overflow-hidden bg-black shadow-[0_0_0_2px_rgba(255,255,255,0.08),0_8px_32px_rgba(168,85,247,0.1)]'
    : 'relative aspect-[9/16] max-h-[52dvh] mx-auto w-full max-w-[240px] rounded-2xl overflow-hidden bg-black border border-[#2d2d3d]';

  const segmentBtn = (active: boolean) =>
    embedded
      ? `flex-1 min-h-[44px] py-2.5 rounded-full text-xs font-bold transition-all ${
          active
            ? 'bg-white text-black shadow-sm'
            : 'text-white/55 hover:text-white/80'
        }`
      : `flex-1 min-h-[44px] py-2.5 rounded-xl text-xs font-semibold border ${
          active
            ? 'bg-purple-600/30 border-purple-500 text-purple-100'
            : 'bg-[#1a1a26] border-[#2d2d3d] text-gray-300'
        }`;

  /* ── field helpers ───────────────────────────────────────────────── */
  const fieldClass = embedded
    ? 'w-full rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-pink-500/50 focus:outline-none transition-colors'
    : 'mt-1 w-full rounded-xl bg-[#1a1a28] border border-[#2d2d3d] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none';

  const labelClass = `flex items-center gap-1.5 text-xs mb-1 ${embedded ? 'text-white/45' : 'text-gray-400'}`;

  /* ── video block ─────────────────────────────────────────────────── */
  const videoBlock = (
    <>
      <audio ref={audioPreviewRef} className="hidden" aria-hidden />
      <div className={videoFrameClass}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted={
            phase === 'camera' ||
            phase === 'recording' ||
            (usesCompositionAudio && showReviewForm)
          }
        />
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40 p-4 text-center bg-gradient-to-t from-black/50 via-transparent to-black/30">
            {embedded ? (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                </div>
                <p className="text-[11px] font-medium text-white/50 max-w-[10rem] leading-snug">
                  {audioSource === 'composition'
                    ? selectedComposition
                      ? t('reels.createVideoOnlyHint')
                      : t('reels.createPickTrackHint')
                    : t('reels.createMicHint')}
                </p>
              </>
            ) : (
              <>
                <span className="text-4xl">🎬</span>
                <p className="text-xs">
                  {audioSource === 'composition'
                    ? selectedComposition
                      ? t('reels.createVideoOnlyHint')
                      : t('reels.createPickTrackHint')
                    : t('reels.createMicHint')}
                </p>
              </>
            )}
          </div>
        )}
        {phase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold text-white tabular-nums">
              {recordSec}s / {REEL_RECORD_MAX_SEC}s
            </span>
          </div>
        )}
      </div>
    </>
  );

  /* ── audio source block ──────────────────────────────────────────── */
  const audioSourceBlock = phase === 'idle' && (
    <div className={embedded ? 'space-y-3' : 'space-y-2'}>
      {!embedded && (
        <p className="text-xs font-semibold text-gray-300">
          {t('reels.createAudioSourceLabel', { defaultValue: 'Bande son' })}
        </p>
      )}
      <div
        className={
          embedded
            ? 'flex p-1 rounded-full bg-white/[0.08] border border-white/[0.06] backdrop-blur-sm'
            : 'flex gap-2'
        }
      >
        <button
          type="button"
          onClick={() => {
            setAudioSource('mic');
            setSelectedComposition(null);
          }}
          className={segmentBtn(audioSource === 'mic')}
        >
          {t('reels.createAudioMic', { defaultValue: 'Micro' })}
        </button>
        <button
          type="button"
          onClick={() => setAudioSource('composition')}
          className={segmentBtn(audioSource === 'composition')}
        >
          {t('reels.createAudioDiscography', { defaultValue: 'Ma discographie' })}
        </button>
      </div>

      {audioSource === 'composition' && (
        <div
          className={
            embedded
              ? 'rounded-2xl bg-white/[0.04] border border-white/[0.06] max-h-[min(22dvh,8.5rem)] overflow-y-auto overscroll-y-contain'
              : 'rounded-xl border border-[#2d2d3d] bg-[#12121a] max-h-[min(24dvh,9rem)] overflow-y-auto overscroll-y-contain'
          }
        >
          {catalogLoading ? (
            <p className="text-[11px] text-white/40 px-3 py-3">{t('reels.createCatalogLoading')}</p>
          ) : compositions.length === 0 ? (
            <p className="text-[11px] text-white/40 px-3 py-3 leading-snug">{t('reels.createCatalogEmpty')}</p>
          ) : (
            compositionGroups.map((group) => (
              <div key={group.album?.id ?? 'loose'} className="py-0.5">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
                  {group.album?.title ?? t('reels.createLooseTracks')}
                </p>
                {group.tracks.map((track) => {
                  const selected = selectedComposition?.id === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => pickComposition(track)}
                      className={`w-full text-left px-3 py-2.5 min-h-[44px] flex items-center gap-3 border-t border-white/[0.04] first:border-t-0 transition-colors ${
                        selected ? 'bg-pink-500/15' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-sm ${
                          selected
                            ? 'bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white'
                            : 'bg-white/8 text-white/50'
                        }`}
                        aria-hidden
                      >
                        ♪
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm font-semibold truncate ${
                            selected ? 'text-pink-100' : 'text-white/90'
                          }`}
                        >
                          {track.title}
                        </span>
                        {track.artist?.trim() && (
                          <span className="block text-[10px] text-white/40 truncate">{track.artist}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {usesCompositionAudio && selectedComposition && embedded && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-pink-500/10 border border-pink-500/20">
          <span className="text-pink-400 text-xs" aria-hidden>
            ♪
          </span>
          <p className="text-[11px] text-pink-200/90 truncate min-w-0">
            {t('reels.createAudioSelected', { title: selectedComposition.title })}
          </p>
        </div>
      )}
      {usesCompositionAudio && selectedComposition && !embedded && (
        <p className="text-[11px] text-purple-300/90">
          {t('reels.createAudioSelected', { title: selectedComposition.title })}
        </p>
      )}
    </div>
  );

  /* ── idle actions ────────────────────────────────────────────────── */
  const idleActions = phase === 'idle' && (
    embedded ? (
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={!canCapture}
          className="flex flex-col items-center justify-center gap-2 min-h-[5.5rem] rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-fuchsia-600 text-white font-bold text-sm shadow-lg shadow-pink-900/30 disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.67-1.055 2.31 2.31 0 00-2.826 0L12 7.5l-1.988-2.325z"
            />
            <circle cx="12" cy="12" r="3" strokeWidth="1.75" />
          </svg>
          {t('reels.createOpenCamera', { defaultValue: 'Caméra' })}
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
          disabled={submitting || !canCapture}
          className="flex flex-col items-center justify-center gap-2 min-h-[5.5rem] rounded-2xl bg-white/[0.06] border border-white/10 text-white/90 font-bold text-sm hover:bg-white/[0.09] disabled:opacity-40 active:scale-[0.98] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white/70" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          {submitting
            ? t('reels.createImporting', { defaultValue: 'Import…' })
            : t('reels.createImportVideo', { defaultValue: 'Importer' })}
        </button>
      </div>
    ) : (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={!canCapture}
          className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold text-white shadow-lg shadow-pink-900/30 disabled:opacity-40"
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
          disabled={submitting || !canCapture}
          className="w-full py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-200 hover:border-pink-500/40 disabled:opacity-40"
        >
          {submitting ? 'Import…' : 'Importer une vidéo'}
        </button>
      </div>
    )
  );

  /* ── review form ─────────────────────────────────────────────────── */
  const reviewForm = showReviewForm && (
    <form
      onSubmit={(e) => void savePrivateReel(e)}
      className={embedded ? 'space-y-3 pt-1' : 'space-y-3'}
    >
      {/* Section header */}
      {embedded ? (
        <div className="flex items-center gap-2 pb-0.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <p className="text-xs font-bold text-white/85">
            {t('reels.createDetailsTitle', { defaultValue: 'Détails du reel' })}
          </p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
          {t('reels.createDetailsTitle', { defaultValue: 'Détails' })}
        </p>
      )}

      {/* Title */}
      <label className="block">
        <span className={labelClass}>
          {embedded && (
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.127 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          )}
          Titre
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          placeholder={embedded ? 'Nom du morceau…' : undefined}
          className={fieldClass}
        />
      </label>

      {/* Artist */}
      <label className="block">
        <span className={labelClass}>
          {embedded && (
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          )}
          Artiste
        </span>
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
          maxLength={120}
          className={fieldClass}
        />
      </label>

      {/* Genre */}
      <label className="block">
        <span className={labelClass}>
          {embedded && (
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          )}
          Genre
        </span>
        <input
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          required
          maxLength={80}
          placeholder="Ex: Pop, Électro…"
          className={fieldClass}
        />
      </label>

      {/* Album link (optional) — spinning vinyl on reel when set */}
      <label className="block">
        <span className={labelClass}>
          {embedded && (
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
          {t('reels.createLinkLabel', { defaultValue: 'Lien album (optionnel)' })}
        </span>
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
          onBlur={validateLink}
          maxLength={500}
          type="url"
          inputMode="url"
          placeholder={t('reels.createLinkPlaceholder', { defaultValue: 'Spotify, YouTube, Deezer, Soundy…' })}
          className={
            embedded
              ? `w-full rounded-2xl bg-white/[0.06] border px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none transition-colors ${
                  linkError ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/10 focus:border-pink-500/50'
                }`
              : `mt-1 w-full rounded-xl bg-[#1a1a28] border px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none ${
                  linkError ? 'border-red-500/50' : 'border-[#2d2d3d] focus:border-purple-500/50'
                }`
          }
        />
        <p className={`mt-1 text-[10px] leading-snug ${embedded ? 'text-white/35' : 'text-gray-500'}`}>
          {t('reels.createLinkHint', { defaultValue: 'Affiche un vinyle cliquable en haut à gauche du reel.' })}
        </p>
        {linkError && (
          <p className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            {linkError}
          </p>
        )}
      </label>

      {/* Rights checkbox */}
      <label
        className={
          embedded
            ? 'flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] cursor-pointer'
            : 'flex items-start gap-2.5 cursor-pointer'
        }
      >
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => setRightsConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-white/20 accent-pink-500 shrink-0"
        />
        <span className={`text-[11px] leading-snug ${embedded ? 'text-white/45' : 'text-gray-400'}`}>
          {t('profile.compositions.rightsConfirmLabel')}
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={resetToIdle}
          className={
            embedded
              ? 'flex-1 py-3 rounded-full bg-white/8 border border-white/10 text-sm font-semibold text-white/75 hover:bg-white/[0.12] transition-colors'
              : 'flex-1 py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-sm font-semibold text-gray-300'
          }
        >
          {t('reels.createRedo', { defaultValue: 'Refaire' })}
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim() || !artist.trim() || !genre.trim() || !rightsConfirmed}
          className={
            embedded
              ? 'flex-[2] py-3 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-600 font-bold text-white disabled:opacity-40 shadow-lg shadow-pink-900/25 active:scale-[0.98] transition-all'
              : 'flex-[2] py-3 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-white disabled:opacity-40'
          }
        >
          {submitting
            ? t('reels.createSaving', { defaultValue: 'Sauvegarde…' })
            : t('reels.createSave', { defaultValue: 'Sauvegarder' })}
        </button>
      </div>
    </form>
  );

  /* ── main content ────────────────────────────────────────────────── */
  const content = (
    <>
      {!embedded && (
        <div>
          <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Enregistrer</h3>
          <p className="text-[11px] text-gray-500 mt-1">
            Vos reels enregistrés restent privés sur votre profil. Ils n'apparaissent pas dans l'onglet Reels public.
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-[10px] text-center text-white/35 uppercase tracking-[0.2em] font-semibold">
          {t('reels.createPreviewLabel', { defaultValue: 'Aperçu' })}
        </p>
      )}

      {(cameraError || error || catalogError) && (
        <p
          className={
            embedded
              ? 'text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-2xl px-3 py-2.5'
              : 'text-sm text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2'
          }
        >
          {cameraError ?? error ?? catalogError}
        </p>
      )}

      {embedded ? (
        <>
          {videoBlock}
          {audioSourceBlock}
          {idleActions}
        </>
      ) : (
        <>
          {audioSourceBlock}
          {videoBlock}
          {idleActions}
        </>
      )}

      {phase === 'camera' && (
        embedded ? (
          <div className="flex flex-col items-center gap-4 pt-1">
            <button
              type="button"
              onClick={startRecording}
              className="w-[4.5rem] h-[4.5rem] rounded-full bg-red-500 border-[5px] border-white/90 shadow-[0_0_0_4px_rgba(239,68,68,0.35)] active:scale-95 transition-transform"
              aria-label={t('reels.createRecordStart', { defaultValue: 'Enregistrer' })}
            />
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={resetToIdle}
                className="flex-1 py-3 rounded-full bg-white/8 border border-white/10 text-sm font-semibold text-white/80"
              >
                {t('common.cancel', { defaultValue: 'Annuler' })}
              </button>
            </div>
          </div>
        ) : (
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
        )
      )}

      {phase === 'recording' && (
        embedded ? (
          <div className="flex flex-col items-center gap-3 pt-1">
            <button
              type="button"
              onClick={stopRecording}
              className="w-[4.5rem] h-[4.5rem] rounded-full bg-transparent border-[5px] border-red-500 flex items-center justify-center active:scale-95 transition-transform"
              aria-label={t('reels.createRecordStop', { defaultValue: 'Arrêter' })}
            >
              <span className="w-7 h-7 rounded-md bg-red-500" />
            </button>
            <p className="text-[11px] text-white/45 font-medium">
              {t('reels.createTapToStop', { defaultValue: 'Appuie pour terminer' })}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="w-full py-3.5 rounded-xl bg-[#1a1a26] border-2 border-red-500 font-bold text-red-300"
          >
            Arrêter
          </button>
        )
      )}

      {reviewForm}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-4 min-w-0 pb-1">{content}</div>;
  }

  return (
    <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
      {content}
    </section>
  );
}
