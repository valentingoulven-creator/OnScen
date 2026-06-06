/** Maintient une session audio active (écran verrouillé / app en arrière-plan). */

const SILENT_AUDIO_SRC =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let sharedAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let retainCount = 0;
let lifecycleBound = false;

function resumeKeepAlivePlayback(): void {
  if (sharedAudio) {
    void sharedAudio.play().catch(() => {});
  }
  if (audioContext?.state === 'suspended') {
    void audioContext.resume().catch(() => {});
  }
}

function startAudioContextKeepAlive(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioContext = new Ctx();
      oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
    }
    void audioContext.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}

function ensureBackgroundLifecycle(): void {
  if (lifecycleBound || typeof document === 'undefined') return;
  lifecycleBound = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resumeKeepAlivePlayback();
  });
  window.addEventListener('pagehide', () => {
    resumeKeepAlivePlayback();
  });
}

export function retainBackgroundAudioSession(): () => void {
  retainCount += 1;
  if (typeof document === 'undefined') return () => undefined;

  ensureBackgroundLifecycle();

  if (!sharedAudio) {
    sharedAudio = new Audio(SILENT_AUDIO_SRC);
    sharedAudio.loop = true;
    sharedAudio.volume = 0.001;
    sharedAudio.preload = 'auto';
    sharedAudio.setAttribute('playsinline', 'true');
  }

  startAudioContextKeepAlive();
  resumeKeepAlivePlayback();

  return () => {
    retainCount = Math.max(0, retainCount - 1);
    if (retainCount === 0) {
      if (sharedAudio) {
        sharedAudio.pause();
        sharedAudio.removeAttribute('src');
        sharedAudio.load();
        sharedAudio = null;
      }
      try {
        oscillator?.disconnect();
        oscillator?.stop();
      } catch {
        /* ignore */
      }
      oscillator = null;
      void audioContext?.close();
      audioContext = null;
    }
  };
}

export interface MediaSessionMeta {
  title: string;
  artist: string;
  artworkUrl?: string;
}

export function updateMediaSession(meta: MediaSessionMeta, playing: boolean): void {
  if (!('mediaSession' in navigator)) return;
  try {
    if (playing) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.title,
        artist: meta.artist,
        artwork: meta.artworkUrl
          ? [{ src: meta.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
      navigator.mediaSession.playbackState = 'playing';
    } else {
      navigator.mediaSession.playbackState = 'paused';
    }
  } catch {
    /* ignore */
  }
}

export function clearMediaSession(): void {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.metadata = null;
  } catch {
    /* ignore */
  }
}
