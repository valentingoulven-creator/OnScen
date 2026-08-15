import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import './TikTokLiveChatOverlay.css';

/**
 * Fosse OnScen — voix de la salle sous le player, pas un clone de chat tiers.
 */
export function TikTokLiveChatOverlay({
  chat,
  chatInput,
}: {
  chat: ReactNode;
  chatInput?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const userAwayFromBottom = useRef(false);
  const [paused, setPaused] = useState(false);

  const getScrollEl = useCallback((): HTMLElement | null => {
    return feedRef.current?.querySelector('.chat-messages-scroll') ?? null;
  }, []);

  const isNearBottom = (el: HTMLElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < 64;

  const jumpToLatest = useCallback(() => {
    const scrollEl = getScrollEl();
    if (!scrollEl) return;
    userAwayFromBottom.current = false;
    setPaused(false);
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  }, [getScrollEl]);

  useEffect(() => {
    const scrollEl = getScrollEl();
    if (!scrollEl) return;

    const onScroll = () => {
      const away = !isNearBottom(scrollEl);
      userAwayFromBottom.current = away;
      setPaused(away);
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });

    const sentinel = scrollEl.lastElementChild as HTMLElement | null;
    if (sentinel && !sentinel.dataset.tiktokScrollPatched) {
      sentinel.dataset.tiktokScrollPatched = '1';
      const orig = sentinel.scrollIntoView.bind(sentinel);
      sentinel.scrollIntoView = ((arg?: boolean | ScrollIntoViewOptions) => {
        if (userAwayFromBottom.current) return;
        orig(arg as ScrollIntoViewOptions);
      }) as typeof sentinel.scrollIntoView;
    }

    return () => scrollEl.removeEventListener('scroll', onScroll);
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const input = root.querySelector<HTMLInputElement>('.onscen-salle__voice input');
    if (input) input.placeholder = 'Parler depuis la salle…';
    const btn = root.querySelector<HTMLButtonElement>('.onscen-salle__voice button[type="submit"]');
    if (btn) {
      btn.setAttribute('aria-label', 'Envoyer à la scène');
      if (btn.textContent?.trim() === '→') btn.textContent = '✦';
    }
  });

  return (
    <div
      ref={rootRef}
      className="tiktok-live-chat onscen-salle"
      aria-label="Voix de la salle"
    >
      <div className="onscen-salle__haze" aria-hidden />
      <div className="onscen-salle__pit">
        <div ref={feedRef} className="onscen-salle__voices">
          {chat}
        </div>
        {paused ? (
          <button type="button" className="onscen-salle__catchup" onClick={jumpToLatest}>
            <span aria-hidden>↓</span>
            Rejoindre le fil
          </button>
        ) : null}
      </div>
      {chatInput ? <div className="onscen-salle__voice">{chatInput}</div> : null}
    </div>
  );
}
