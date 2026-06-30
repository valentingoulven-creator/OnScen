import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HorizontalScrollCarousel } from './HorizontalScrollCarousel';

/** Nombre d'anneaux stories défilés par clic flèche (~3–4). */
export const STORIES_RINGS_SCROLL_STEP = 3.5;

export interface StoriesRingsCarouselProps {
  children: ReactNode;
  itemCount: number;
}

/** Carrousel anneaux stories avec flèches Précédent / Suivant. */
export function StoriesRingsCarousel({ children, itemCount }: StoriesRingsCarouselProps) {
  const { t } = useTranslation();

  return (
    <HorizontalScrollCarousel
      itemCount={itemCount}
      ariaPrevLabel={t('stories.rail.scrollPrev')}
      ariaNextLabel={t('stories.rail.scrollNext')}
      scrollStepCount={STORIES_RINGS_SCROLL_STEP}
      scrollClassName="stories-rings-carousel ms-hscroll-track flex flex-nowrap gap-3 px-3 py-3"
    >
      {children}
    </HorizontalScrollCarousel>
  );
}
