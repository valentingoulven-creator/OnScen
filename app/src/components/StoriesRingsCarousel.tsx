import { type ReactNode } from 'react';
import { HorizontalScrollCarousel } from './HorizontalScrollCarousel';

/** Nombre d'anneaux stories défilés par clic flèche (~3–4). */
export const STORIES_RINGS_SCROLL_STEP = 3.5;

export interface StoriesRingsCarouselProps {
  children: ReactNode;
  itemCount: number;
}

/** Carrousel anneaux stories avec flèches Précédent / Suivant. */
export function StoriesRingsCarousel({ children, itemCount }: StoriesRingsCarouselProps) {
  return (
    <HorizontalScrollCarousel
      itemCount={itemCount}
      ariaPrevLabel="Précédent"
      ariaNextLabel="Suivant"
      scrollStepCount={STORIES_RINGS_SCROLL_STEP}
      scrollClassName="stories-rings-carousel flex flex-nowrap gap-2 pb-1 -mx-2 px-2"
    >
      {children}
    </HorizontalScrollCarousel>
  );
}
