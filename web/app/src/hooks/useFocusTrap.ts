import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Piège le focus clavier dans un conteneur pendant qu'une modale/sheet est ouverte :
 * Tab / Shift+Tab restent dans la boîte, Echap ferme (si `onEscape` fourni), et le
 * focus revient à l'élément précédemment actif à la fermeture.
 *
 * Cf. audit accessibilité mobile — aucune modale du projet n'avait de focus trap,
 * ce qui casse la navigation clavier (WCAG 2.1.2 "No Keyboard Trap" / 2.4.3 "Focus Order").
 *
 * Usage : `const ref = useFocusTrap(open, onCancel); <div ref={ref} tabIndex={-1}>…</div>`
 */
export function useFocusTrap(active: boolean, onEscape?: () => void): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // "Latest ref" mis à jour à chaque render (pas de dep instable dans l'effet ci-dessous).
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    const focusables = (): HTMLElement[] =>
      container ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];

    const first = focusables()[0];
    (first ?? container)?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!onEscapeRef.current) return;
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
