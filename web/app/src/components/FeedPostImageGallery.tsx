import { useTranslation } from 'react-i18next';

export interface FeedPostImageGalleryProps {
  urls: string[];
  index: number;
  onIndexChange: (next: number) => void;
  label: string;
  /** `feed` = vignette fil ; `modal` = détail publication */
  variant?: 'feed' | 'modal';
}

export function FeedPostImageGallery({
  urls,
  index,
  onIndexChange,
  label,
  variant = 'modal',
}: FeedPostImageGalleryProps) {
  const { t } = useTranslation();
  const safeIndex = Math.min(Math.max(0, index), urls.length - 1);

  if (urls.length === 0) return null;

  const goPrev = () => onIndexChange(safeIndex <= 0 ? urls.length - 1 : safeIndex - 1);
  const goNext = () => onIndexChange(safeIndex >= urls.length - 1 ? 0 : safeIndex + 1);

  const isFeed = variant === 'feed';
  const imgClass = isFeed
    ? 'w-full rounded-lg max-h-64 object-cover bg-[#1e1e2f]'
    : 'w-full max-h-[min(55dvh,24rem)] object-contain mx-auto';

  return (
    <div className={`relative ${isFeed ? '' : 'bg-black/50'}`}>
      <img
        src={urls[safeIndex]}
        alt=""
        loading="lazy"
        decoding="async"
        className={imgClass}
      />
      {urls.length > 1 ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-black/55 text-white border border-white/15 hover:bg-black/75 transition ${
              isFeed ? 'left-1.5 w-9 h-9' : 'left-2 w-11 h-11'
            }`}
            aria-label={t('profile.galleryPrev', { defaultValue: 'Image précédente' })}
          >
            <svg viewBox="0 0 24 24" className={isFeed ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-black/55 text-white border border-white/15 hover:bg-black/75 transition ${
              isFeed ? 'right-1.5 w-9 h-9' : 'right-2 w-11 h-11'
            }`}
            aria-label={t('profile.galleryNext', { defaultValue: 'Image suivante' })}
          >
            <svg viewBox="0 0 24 24" className={isFeed ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p
            className={`absolute text-[10px] font-semibold text-white/90 bg-black/55 px-2 py-0.5 rounded-full border border-white/10 ${
              isFeed ? 'top-2 right-2' : 'bottom-2 left-1/2 -translate-x-1/2 text-[11px] px-2.5 py-1'
            }`}
          >
            {safeIndex + 1} / {urls.length}
          </p>
          {!isFeed ? (
            <div className="flex justify-center gap-1.5 pb-2 pt-1">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={`w-2 h-2 rounded-full transition ${
                    i === safeIndex ? 'bg-purple-400 scale-110' : 'bg-white/35 hover:bg-white/55'
                  }`}
                  aria-label={`${label} (${i + 1}/${urls.length})`}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
