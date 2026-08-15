import { useEffect } from 'react';

const CONTAINER = '.ms-salon-fullscreen-overlay .live-video-container--theater';
const CLASS = 'live-video-container--tiktok-theater';
const BTN_SEL =
  '.live-theater-chrome-btn[aria-label="Plein écran"], .live-theater-chrome-btn[aria-label="Quitter le plein écran"], .live-theater-chrome-btn[aria-label="Vue immersive"], .live-theater-chrome-btn[aria-label="Vue salle"]';

function syncButton(root: Element, on: boolean) {
  const btn = root.querySelector<HTMLButtonElement>(
    '.live-theater-chrome-btn[aria-label="Plein écran"], .live-theater-chrome-btn[aria-label="Quitter le plein écran"], .live-theater-chrome-btn[aria-label="Vue immersive"], .live-theater-chrome-btn[aria-label="Vue salle"]',
  );
  if (!btn) return;
  const label = on ? 'Vue salle' : 'Vue immersive';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.classList.toggle('live-theater-chrome-btn--tiktok-on', on);
}

/** Bouton plein écran → vue immersive (vidéo pleine, chat overlay). */
export function LiveTikTokFullscreenToggle() {
  useEffect(() => {
    const root = document.querySelector(CONTAINER);
    if (!root) return;

    const onClick = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest(BTN_SEL)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const on = !root.classList.contains(CLASS);
      root.classList.toggle(CLASS, on);
      syncButton(root, on);
    };

    root.addEventListener('click', onClick, true);
    return () => {
      root.removeEventListener('click', onClick, true);
      root.classList.remove(CLASS);
    };
  }, []);

  return null;
}
