import { pickRecorderMimeType, blobToDataUrl } from './reelRecording';
import { STORY_VIDEO_MAX_DATA_CHARS } from './storyVideo';

const PULSE_FPS = 24;
const PULSE_DURATION_SEC = 3;
const PULSE_BPM = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}

function pulseScale(frameIndex: number, fps: number, bpm: number): number {
  const beatPhase = ((frameIndex / fps) * (bpm / 60)) % 1;
  const peak = 1 - Math.abs(beatPhase * 2 - 1);
  return 1 + peak * 0.09;
}

/** Photo → vidéo loop pulsée sur le beat (120 BPM, 3 s). */
export async function createBeatPulseVideoFromImage(
  imageDataUrl: string,
  bpm = PULSE_BPM
): Promise<{ videoUrl: string; posterUrl: string; durationSec: number }> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Effet pulse non supporté sur cet appareil');
  }

  const img = await loadImage(imageDataUrl);
  const maxW = 1080;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');

  const frameCount = PULSE_FPS * PULSE_DURATION_SEC;
  const mime = pickRecorderMimeType();
  const stream = canvas.captureStream(PULSE_FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const encoded = await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mime.split(';')[0] ?? 'video/webm' }));
    recorder.onerror = () => reject(new Error('Encodage pulse impossible'));
    recorder.start(100);

    void (async () => {
      try {
        const frameMs = 1000 / PULSE_FPS;
        for (let i = 0; i < frameCount; i++) {
          const s = pulseScale(i, PULSE_FPS, bpm);
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.scale(s, s);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          await sleep(frameMs);
        }
        recorder.stop();
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Encodage pulse impossible'));
      }
    })();
  });

  const videoUrl = await blobToDataUrl(encoded);
  if (videoUrl.length > STORY_VIDEO_MAX_DATA_CHARS) {
    throw new Error('Vidéo pulse trop volumineuse');
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const posterUrl = canvas.toDataURL('image/jpeg', 0.82);

  return { videoUrl, posterUrl, durationSec: PULSE_DURATION_SEC };
}

export { PULSE_DURATION_SEC, PULSE_BPM };
