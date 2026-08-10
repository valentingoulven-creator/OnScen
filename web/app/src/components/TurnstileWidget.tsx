import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile_script'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
}

/** Cloudflare Turnstile — affiché seulement si VITE_TURNSTILE_SITE_KEY est défini. */
export function TurnstileWidget({ onToken, theme = 'auto', className }: TurnstileWidgetProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) {
      onToken(null);
      return;
    }
    let cancelled = false;
    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => {
            setFailed(true);
            onToken(null);
          },
        });
      })
      .catch(() => {
        setFailed(true);
        onToken(null);
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, onToken]);

  if (!siteKey) return null;
  if (failed) {
    return (
      <p className="text-xs text-amber-400/90" role="status">
        Vérification anti-robot indisponible — réessayez plus tard.
      </p>
    );
  }
  return <div ref={containerRef} className={className} />;
}

export function isTurnstileEnabledClient(): boolean {
  return Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim());
}
