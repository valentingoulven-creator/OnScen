import { blobToDataUrl, pickRecorderMimeType } from './reelRecording';
import { STORY_VIDEO_MAX_DATA_CHARS } from './storyVideo';

/** Durée max capturée avant effet boomerang (style Instagram). */
export const BOOMERANG_CAPTURE_MAX_SEC = 2.5;

export const BOOMERANG_FPS = 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitVideoSeek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Impossible de lire la vidéo'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.01));
  });
}

/** Encode une courte vidéo en boucle avant / arrière (boomerang). */
export async function createBoomerangVideoFromBlob(
  blob: Blob
): Promise<{ videoUrl: string; posterUrl: string; durationSec: number }> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Boomerang non supporté sur cet appareil');
  }

  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('Vidéo illisible'));
    });

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (!srcW || !srcH) throw new Error('Vidéo invalide');

    const captureDuration = Math.min(video.duration, BOOMERANG_CAPTURE_MAX_SEC);
    const frameCount = Math.max(2, Math.round(captureDuration * BOOMERANG_FPS));
    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');

    const frames: ImageData[] = [];
    for (let i = 0; i < frameCount; i++) {
      const t = frameCount <= 1 ? 0 : (i / (frameCount - 1)) * captureDuration;
      await waitVideoSeek(video, t);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }

    const sequence = [...frames, ...frames.slice(0, -1).reverse()];
    const durationSec = Math.round((sequence.length / BOOMERANG_FPS) * 10) / 10;
    const mime = pickRecorderMimeType();
    const stream = canvas.captureStream(BOOMERANG_FPS);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };

    const encoded = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () =>
        resolve(new Blob(chunks, { type: mime.split(';')[0] ?? 'video/webm' }));
      recorder.onerror = () => reject(new Error('Encodage boomerang impossible'));
      recorder.start(100);

      void (async () => {
        try {
          const frameMs = 1000 / BOOMERANG_FPS;
          for (const frame of sequence) {
            ctx.putImageData(frame, 0, 0);
            await sleep(frameMs);
          }
          await sleep(40);
          recorder.stop();
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Encodage boomerang impossible'));
        }
      })();
    });

    const videoUrl = await blobToDataUrl(encoded);
    if (videoUrl.length > STORY_VIDEO_MAX_DATA_CHARS) {
      throw new Error('Boomerang trop volumineux. Réessayez un clip plus court.');
    }

    ctx.putImageData(frames[0]!, 0, 0);
    const posterUrl = canvas.toDataURL('image/jpeg', 0.82);

    return { videoUrl, posterUrl, durationSec };
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.src = '';
  }
}
