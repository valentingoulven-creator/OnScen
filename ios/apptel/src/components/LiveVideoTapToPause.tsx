import { useEffect } from 'react';

const IGNORE =
  'button, a, input, textarea, select, .tiktok-live-chat, .twitch-live-chat, .onscen-salle, .live-theater-live-meta, .live-theater-chrome-btn';
const STAGE = '.live-video-stage-area, video, .live-theater-hero__frame, .live-theater-hero';
const PAUSE_SEL =
  '.live-theater-chrome-btn[aria-label="Mettre en pause"], .live-theater-chrome-btn[aria-label="Reprendre la lecture"]';

/** Tap sur la vidéo (hors chrome / chat) → pause / lecture. */
export function LiveVideoTapToPause() {
  useEffect(() => {
    const root = document.querySelector('.live-video-container--theater');
    if (!root) return;

    const onClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest(IGNORE)) return;
      if (!t.closest(STAGE)) return;
      const pauseBtn = root.querySelector<HTMLButtonElement>(PAUSE_SEL);
      pauseBtn?.click();
    };

    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  return null;
}
