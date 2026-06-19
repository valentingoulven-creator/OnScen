export const COMPOSITION_MAX_FILE_BYTES = 30 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
]);

const ALLOWED_EXT = /\.(mp3|wav|m4a|ogg|webm|flac)$/i;

export function validateCompositionFile(file: File): string | null {
  if (file.size > COMPOSITION_MAX_FILE_BYTES) {
    return 'Fichier trop volumineux (max 30 Mo)';
  }
  const mimeOk = file.type ? ALLOWED_MIME.has(file.type) : false;
  const extOk = ALLOWED_EXT.test(file.name);
  if (!mimeOk && !extOk) {
    return 'Format non supporté (mp3, wav, m4a, ogg)';
  }
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture du fichier impossible'));
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export function getAudioDurationSec(dataUrl: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      if (Number.isFinite(duration) && duration > 0) resolve(Math.round(duration));
      else resolve(undefined);
    };
    audio.onerror = () => resolve(undefined);
    audio.src = dataUrl;
  });
}

export function formatDurationSec(sec?: number): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
