/**
 * Override mobile — barre live retirée.
 * Cœur : à droite du nom hôte. Quitter : haut à droite.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface LiveHostTopBarProps {
  title: string;
  viewers: number;
  remainingMs: number | null;
  onBack: () => void;
  onShare: () => void;
  hostControls?: ReactNode;
  centerControls?: ReactNode;
  trailing?: ReactNode;
}

const LIKE_SLOT = '.ms-salon-fullscreen-overlay .live-theater-live-meta__like';
const STAGE = '.ms-salon-fullscreen-overlay .live-video-stage-area';

function clickHiddenLeave() {
  const root = document.querySelector('.live-theater-leave-like');
  if (!root) return;
  const buttons = root.querySelectorAll<HTMLButtonElement>('button');
  const leave = [...buttons].find((btn) => /quitter|leave/i.test(btn.textContent ?? ''));
  leave?.click();
}

export function LiveHostTopBar({ trailing }: LiveHostTopBarProps) {
  const [likeSlot, setLikeSlot] = useState<HTMLElement | null>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const find = () => {
      setLikeSlot(document.querySelector<HTMLElement>(LIKE_SLOT));
      setStage(document.querySelector<HTMLElement>(STAGE));
    };
    find();
    const id = window.setInterval(find, 400);
    return () => window.clearInterval(id);
  }, []);

  if (!trailing) return null;

  return (
    <>
      {likeSlot
        ? createPortal(<div className="live-theater-leave-like">{trailing}</div>, likeSlot)
        : null}
      {stage
        ? createPortal(
            <div className="live-theater-leave-slot">
              <button
                type="button"
                className="live-theater-leave-btn"
                aria-label="Quitter le live"
                onClick={clickHiddenLeave}
              >
                Quitter
              </button>
            </div>,
            stage,
          )
        : null}
    </>
  );
}
