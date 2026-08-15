import { useEffect } from 'react';

const CONTAINER = '.ms-salon-fullscreen-overlay .live-video-container--theater';
const CLASS = 'live-video-container--landscape-theater';

function isPhoneLandscape(): boolean {
  const landscape =
    window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
  if (!landscape) return false;
  return window.innerHeight <= 540 || window.matchMedia('(pointer: coarse)').matches;
}

/** Basculer le téléphone → live en grand (cinéma). */
export function LiveLandscapeExpand() {
  useEffect(() => {
    const apply = () => {
      const el = document.querySelector(CONTAINER);
      if (!el) return;
      el.classList.toggle(CLASS, isPhoneLandscape());
    };

    apply();
    const mq = window.matchMedia('(orientation: landscape)');
    mq.addEventListener('change', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('resize', apply);
    screen.orientation?.addEventListener('change', apply);

    const timer = window.setInterval(apply, 800);

    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('resize', apply);
      screen.orientation?.removeEventListener('change', apply);
      window.clearInterval(timer);
      document.querySelector(CONTAINER)?.classList.remove(CLASS);
    };
  }, []);

  return null;
}
