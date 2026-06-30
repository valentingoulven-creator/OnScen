export const ANCHORED_POPOVER_VIEWPORT_PAD = 8;

/** Position a fixed popover near an anchor; flips above when clipped at bottom. */
export function clampAnchoredPopoverPosition(
  anchor: DOMRect,
  menuWidth: number,
  menuHeight: number,
  preferAbove = false,
): { top: number; left: number } {
  const gap = 4;
  let left = anchor.right - menuWidth;
  left = Math.max(
    ANCHORED_POPOVER_VIEWPORT_PAD,
    Math.min(left, window.innerWidth - menuWidth - ANCHORED_POPOVER_VIEWPORT_PAD),
  );

  const topBelow = anchor.bottom + gap;
  const topAbove = anchor.top - menuHeight - gap;
  let top = preferAbove ? topAbove : topBelow;
  if (!preferAbove && top + menuHeight > window.innerHeight - ANCHORED_POPOVER_VIEWPORT_PAD) {
    top = topAbove;
  }
  top = Math.max(
    ANCHORED_POPOVER_VIEWPORT_PAD,
    Math.min(top, window.innerHeight - menuHeight - ANCHORED_POPOVER_VIEWPORT_PAD),
  );
  return { top, left };
}
