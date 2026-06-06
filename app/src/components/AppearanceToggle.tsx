import { useEffect, useRef, useState } from 'react';
import {
  APP_THEME_CHANGED_EVENT,
  getStoredAppTheme,
  resolveAppTheme,
  setAppTheme,
  type AppTheme,
} from '../lib/appTheme';

const OPTIONS: { id: AppTheme; label: string; icon: string }[] = [
  { id: 'dark', label: 'Sombre', icon: '🌙' },
  { id: 'light', label: 'Clair', icon: '☀️' },
  { id: 'system', label: 'Système', icon: '💻' },
];

function themeButtonLabel(theme: AppTheme): string {
  return OPTIONS.find((o) => o.id === theme)?.label ?? 'Apparence';
}

export function AppearanceToggle() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => getStoredAppTheme());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setTheme(getStoredAppTheme());
    window.addEventListener(APP_THEME_CHANGED_EVENT, sync);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onSystem = () => {
      if (getStoredAppTheme() === 'system') sync();
    };
    mq.addEventListener('change', onSystem);
    return () => {
      window.removeEventListener(APP_THEME_CHANGED_EVENT, sync);
      mq.removeEventListener('change', onSystem);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const resolved = resolveAppTheme(theme);
  const activeIcon = resolved === 'light' ? '☀️' : '🌙';

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 flex items-center justify-center rounded-full text-base bg-[var(--ms-surface-elevated)] border border-[var(--ms-border)] hover:border-purple-500/50 transition"
        title={`Apparence : ${themeButtonLabel(theme)}`}
        aria-label={`Apparence : ${themeButtonLabel(theme)}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span aria-hidden>{activeIcon}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-50 min-w-[9.5rem] rounded-xl border border-[var(--ms-border)] bg-[var(--ms-surface)] shadow-xl shadow-black/30 py-1"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === opt.id}
              onClick={() => {
                setAppTheme(opt.id);
                setTheme(opt.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${
                theme === opt.id
                  ? 'text-purple-400 bg-purple-900/25'
                  : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)] hover:bg-[var(--ms-surface-elevated)]'
              }`}
            >
              <span aria-hidden>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
