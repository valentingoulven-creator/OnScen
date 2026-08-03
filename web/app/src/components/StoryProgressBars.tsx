/** Barres de progression type Instagram (segments stories / live). */

export interface StoryProgressSegment {
  id: string;
}

export function StoryProgressBars({
  segments,
  activeIndex,
  progress,
  activeFillClassName = 'bg-white',
  className = 'ms-safe-area-top sm:pt-3',
}: {
  segments: StoryProgressSegment[];
  activeIndex: number;
  /** Progression 0–1 du segment actif. */
  progress: number;
  activeFillClassName?: string;
  /** Padding top (safe area géré par le parent en overlay). */
  className?: string;
}) {
  if (segments.length === 0) return null;

  return (
    <div className={`flex gap-1 px-3 shrink-0 ${className}`.trim()} role="presentation">
      {segments.map((seg, i) => {
        let fill = 0;
        if (i < activeIndex) fill = 1;
        else if (i === activeIndex) fill = Math.min(1, Math.max(0, progress));
        return (
          <div key={seg.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden min-w-[12px] shadow-sm">
            <div
              className={`h-full rounded-full transition-none ${activeFillClassName}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
