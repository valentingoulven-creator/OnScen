import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';
import { isDirectAudioPlaybackUrl, resolveCompositionPlaybackUrl } from '../lib/compositionUpload';
import {
  applyMusicPlayerVolume,
  getMusicPlayerMuted,
  getMusicPlayerVolume,
  setMusicPlayerMuted,
  setMusicPlayerVolume,
} from '../lib/musicPlayerVolume';

/** Morceau jouable par le lecteur global (façon Spotify). */
export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string;
  fileUrl: string;
  hostId: string;
  albumId?: string;
}

interface MusicPlayerContextValue {
  /** Référence stable vers l'élément <audio> partagé (lecture directe des events par MusicPlayerBar). */
  audioRef: RefObject<HTMLAudioElement | null>;
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  isPlaying: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  playbackError: string | null;
  /** Joue un morceau ; `queue` optionnelle = liste de la rangée pour lecture continue (suivant/précédent). */
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  /** Ajoute un morceau en fin de file d'attente sans changer la lecture en cours. */
  addToQueue: (track: PlayerTrack) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  close: () => void;
  volume: number;
  muted: boolean;
  setVolume: (value: number) => void;
  toggleMuted: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const tokenRef = useRef<string | null>(token ?? null);
  useEffect(() => {
    tokenRef.current = token ?? null;
  }, [token]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const indexRef = useRef(-1);
  const nextRef = useRef<() => void>(() => {});

  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(() => getMusicPlayerVolume());
  const [muted, setMutedState] = useState(() => getMusicPlayerMuted());

  const setVolume = useCallback((value: number) => {
    const v = setMusicPlayerVolume(value);
    setVolumeState(v);
    if (v > 0) {
      setMutedState(false);
      setMusicPlayerMuted(false);
    }
  }, []);

  const toggleMuted = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMusicPlayerMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) applyMusicPlayerVolume(audio, volume, muted);
  }, [volume, muted]);

  const applyIndex = useCallback((nextQueue: PlayerTrack[], idx: number) => {
    const track = nextQueue[idx];
    if (!track?.fileUrl || !isDirectAudioPlaybackUrl(track.fileUrl)) {
      setPlaybackError('Ce morceau ne peut pas être lu ici (fichier audio requis).');
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      setPlaybackError('Lecteur audio indisponible.');
      return;
    }

    queueRef.current = nextQueue;
    indexRef.current = idx;
    setQueue(nextQueue);
    setCurrentIndex(idx);
    setPlaybackError(null);

    const src = resolveCompositionPlaybackUrl(track.fileUrl);
    audio.src = src;
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => {
        setIsPlaying(true);
        if (tokenRef.current) {
          void api.recordCompositionPlay(tokenRef.current, track.id).catch(() => undefined);
        }
      })
      .catch(() => {
        setIsPlaying(false);
        setPlaybackError('Impossible de lire ce morceau (fichier introuvable ou format non supporté).');
      });
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    queueRef.current = [];
    indexRef.current = -1;
    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setPlaybackError(null);
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    const idx = indexRef.current;
    if (idx < 0 || idx + 1 >= q.length) {
      close();
      return;
    }
    applyIndex(q, idx + 1);
  }, [applyIndex, close]);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    const idx = indexRef.current;
    if (idx <= 0) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
      return;
    }
    applyIndex(q, idx - 1);
  }, [applyIndex]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          setPlaybackError('Impossible de lire ce morceau (fichier introuvable ou format non supporté).');
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(sec, audio.duration));
  }, []);

  const playTrack = useCallback(
    (track: PlayerTrack, trackQueue?: PlayerTrack[]) => {
      if (!track.fileUrl || !isDirectAudioPlaybackUrl(track.fileUrl)) return;
      const isSameTrack = queueRef.current[indexRef.current]?.id === track.id;
      if (isSameTrack) {
        togglePlay();
        return;
      }
      const q = trackQueue && trackQueue.length > 0 ? trackQueue : [track];
      const idx = Math.max(0, q.findIndex((t) => t.id === track.id));
      applyIndex(q, idx);
    },
    [applyIndex, togglePlay]
  );

  const addToQueue = useCallback((track: PlayerTrack) => {
    if (!track.fileUrl || !isDirectAudioPlaybackUrl(track.fileUrl)) return;
    const q = [...queueRef.current, track];
    queueRef.current = q;
    setQueue(q);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => nextRef.current();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setPlaybackError('Impossible de lire ce morceau (fichier introuvable ou format non supporté).');
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const hasNext = currentIndex >= 0 && currentIndex + 1 < queue.length;
  const hasPrev = currentIndex > 0;

  const value = useMemo<MusicPlayerContextValue>(
    () => ({
      audioRef,
      currentTrack,
      queue,
      isPlaying,
      hasNext,
      hasPrev,
      playbackError,
      playTrack,
      addToQueue,
      togglePlay,
      next,
      prev,
      seek,
      close,
      volume,
      muted,
      setVolume,
      toggleMuted,
    }),
    [
      currentTrack,
      queue,
      isPlaying,
      hasNext,
      hasPrev,
      playbackError,
      playTrack,
      addToQueue,
      togglePlay,
      next,
      prev,
      seek,
      close,
      volume,
      muted,
      setVolume,
      toggleMuted,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      <audio ref={audioRef} preload="metadata" className="hidden" aria-hidden playsInline />
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer(): MusicPlayerContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error('useMusicPlayer must be used within MusicPlayerProvider');
  return ctx;
}