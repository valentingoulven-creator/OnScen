import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { subscribeErrorPopups, type ErrorPopup } from '../lib/errorPopups';

const TOAST_TTL_MS = 6500;
const MAX_TOASTS = 3;

/**
 * Affiche les popups d'erreur émis via lib/errorPopups.ts (API réseau/serveur en panne,
 * erreurs JS non interceptées, perte de connexion socket…). Toasts empilés en haut de
 * l'écran pour les erreurs non-bloquantes ; modale bottom-sheet (mobile) pour les erreurs
 * bloquantes nécessitant un clic de l'utilisateur.
 */
export function GlobalErrorPopup() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ErrorPopup[]>([]);
  const [blockingQueue, setBlockingQueue] = useState<ErrorPopup[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((p) => p.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissBlocking = useCallback((id: string) => {
    setBlockingQueue((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return subscribeErrorPopups((popup) => {
      if (popup.blocking) {
        setBlockingQueue((prev) => [...prev, popup]);
        return;
      }
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), popup]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== popup.id));
        timers.delete(popup.id);
      }, TOAST_TTL_MS);
      timers.set(popup.id, timer);
    });
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const activeBlocking = blockingQueue[0] ?? null;

  const toastStack = toasts.length > 0 && (
    <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] left-3 right-3 z-[125] mx-auto max-w-md flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          aria-live="assertive"
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg text-sm flex items-start gap-3 ${
            toast.kind === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
              : 'bg-red-950/90 border-red-500/40 text-red-100'
          }`}
        >
          <span className="shrink-0 text-base" aria-hidden>
            {toast.kind === 'warning' ? '⚠️' : '⛔'}
          </span>
          <span className="flex-1 min-w-0">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="ml-1 shrink-0 text-current opacity-70 hover:opacity-100 bg-transparent border-0 p-0 leading-none cursor-pointer"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );

  const blockingModal = activeBlocking && (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center ms-modal-overlay bg-black/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="global-error-popup-title"
    >
      <div className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl ms-modal-panel shadow-2xl overflow-hidden max-h-[90dvh]">
        <div className="p-5">
          <p id="global-error-popup-title" className="text-lg font-bold text-white">
            {t('errors.generic')}
          </p>
          <p className="mt-2 text-sm text-gray-300">{activeBlocking.message}</p>
        </div>
        <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
          <button
            type="button"
            onClick={() => dismissBlocking(activeBlocking.id)}
            className="w-full py-3 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-sm font-bold cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  if (!toastStack && !blockingModal) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {toastStack}
      {blockingModal}
    </>,
    document.body
  );
}
