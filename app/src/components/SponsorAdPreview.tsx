import { useTranslation } from 'react-i18next';
import type { SponsorAccent, SponsorKind, SponsorPlacement } from '../types';
import {
  DEFAULT_DISPLAY_DURATION_SEC,
  SPONSOR_ACCENT_GRADIENTS,
  sponsorKindBadgeLabel,
} from '../lib/sponsorDisplaySpec';

export type SponsorPreviewProps = {
  placement: SponsorPlacement;
  name: string;
  title: string;
  subtitle: string;
  cta: string;
  accent: SponsorAccent;
  kind: SponsorKind;
  logoUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  displayDurationSec?: number;
  className?: string;
};

function PreviewLogo({ logoUrl, className }: { logoUrl?: string; className: string }) {
  if (logoUrl?.trim()) {
    return (
      <img
        src={logoUrl.trim()}
        alt=""
        className={`${className} object-cover bg-[#1a1a26] shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className={`${className} bg-[#1a1a26] shrink-0 flex items-center justify-center text-[10px] text-gray-500`}
    >
      AD
    </div>
  );
}

function MapBannerPreview({
  name,
  title,
  subtitle,
  cta,
  accent,
  kind,
}: Omit<SponsorPreviewProps, 'placement' | 'logoUrl' | 'displayDurationSec' | 'className'>) {
  const badgeLabel = sponsorKindBadgeLabel(kind);
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r ${SPONSOR_ACCENT_GRADIENTS[accent]} shadow-lg shadow-black/20`}
    >
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="text-[13.5px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/25">
          {badgeLabel}
        </span>
        {name.trim() && (
          <span className="text-[13.5px] font-semibold text-white/55 truncate max-w-[9rem] sm:max-w-none">
            {name.trim()}
          </span>
        )}
      </div>
      <div className="flex items-stretch gap-3 p-4 pt-9 pr-4 min-h-[5.625rem] sm:min-h-[6rem]">
        <div className="flex-1 min-w-0">
          <p className="text-[19.5px] sm:text-[21px] font-bold text-white leading-tight truncate">
            {title.trim() || 'Titre du bandeau'}
          </p>
          <p className="text-[15px] sm:text-[16.5px] text-white/85 mt-1 line-clamp-2 leading-snug">
            {subtitle.trim() || 'Sous-titre descriptif'}
          </p>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 self-center px-4 sm:px-[1.125rem] py-2 sm:py-3 rounded-lg bg-white/15 border border-white/20 text-[16.5px] sm:text-[18px] font-bold text-white whitespace-nowrap opacity-90 cursor-default"
        >
          {cta.trim() || 'CTA'}
        </button>
      </div>
    </div>
  );
}

function FeedInlinePreview({
  name,
  title,
  subtitle,
  cta,
  accent,
  kind,
  logoUrl,
}: Omit<SponsorPreviewProps, 'placement' | 'displayDurationSec' | 'className'>) {
  const badgeLabel = sponsorKindBadgeLabel(kind);
  return (
    <div className="rounded-2xl border border-[#2d2d3d] bg-[#12121a] overflow-hidden">
      <div
        className={`h-1 bg-gradient-to-r ${SPONSOR_ACCENT_GRADIENTS[accent]}`}
        aria-hidden
      />
      <div className="flex items-start gap-3 p-3">
        <PreviewLogo logoUrl={logoUrl} className="w-12 h-12 rounded-xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/25">
              {badgeLabel}
            </span>
            {name.trim() && <span className="text-xs text-gray-400 truncate">{name.trim()}</span>}
          </div>
          <p className="text-sm font-semibold text-white truncate">
            {title.trim() || 'Titre du bandeau'}
          </p>
          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
            {subtitle.trim() || 'Sous-titre descriptif'}
          </p>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 self-center px-3 py-1.5 rounded-lg text-xs font-bold text-purple-200 border border-purple-500/40 bg-purple-600/20 cursor-default"
        >
          {cta.trim() || 'CTA'}
        </button>
      </div>
    </div>
  );
}

function StoriesBannerPreview({
  name,
  title,
  cta,
  accent,
  kind,
  logoUrl,
}: Pick<
  SponsorPreviewProps,
  'name' | 'title' | 'cta' | 'accent' | 'kind' | 'logoUrl'
>) {
  const badgeLabel = sponsorKindBadgeLabel(kind);
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 min-h-14 rounded-xl border border-white/10 bg-gradient-to-r ${SPONSOR_ACCENT_GRADIENTS[accent]}`}
    >
      <PreviewLogo logoUrl={logoUrl} className="w-8 h-8 rounded-lg" />
      <span className="text-[10px] font-bold uppercase text-amber-200 shrink-0">{badgeLabel}</span>
      {name.trim() && (
        <span className="text-xs font-semibold text-white/70 truncate max-w-[4.5rem] shrink-0">
          {name.trim()}
        </span>
      )}
      <p className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
        {title.trim() || 'Titre du bandeau'}
      </p>
      <span className="text-xs font-bold text-white/90 shrink-0">{cta.trim() || 'CTA'}</span>
    </div>
  );
}

function ReelsSponsoredPreview({
  name,
  title,
  subtitle,
  cta,
  accent,
  kind,
  logoUrl,
  posterUrl,
}: Pick<
  SponsorPreviewProps,
  'name' | 'title' | 'subtitle' | 'cta' | 'accent' | 'kind' | 'logoUrl' | 'posterUrl'
>) {
  const badgeLabel = sponsorKindBadgeLabel(kind);
  const bg = posterUrl?.trim() || logoUrl?.trim();
  return (
    <div className="relative mx-auto w-[180px] aspect-[9/16] rounded-2xl overflow-hidden border border-[#2d2d3d] bg-black shadow-xl">
      {bg ? (
        <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${SPONSOR_ACCENT_GRADIENTS[accent]}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50" />
      <div className="absolute top-2 left-2 flex items-center gap-1">
        <span className="text-[8px] font-bold uppercase text-amber-200 bg-amber-500/25 px-1.5 py-0.5 rounded-full">
          {badgeLabel}
        </span>
        {name.trim() && (
          <span className="text-[8px] text-white/70 truncate max-w-[4rem]">{name.trim()}</span>
        )}
      </div>
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[10px] font-bold text-white truncate">{title.trim() || 'Titre'}</p>
        <p className="text-[8px] text-white/80 line-clamp-2 mt-0.5">{subtitle.trim() || 'Sous-titre'}</p>
        <span className="inline-block mt-1.5 text-[8px] font-bold text-white bg-white/15 px-2 py-0.5 rounded-lg">
          {cta.trim() || 'CTA'}
        </span>
      </div>
    </div>
  );
}

export function SponsorAdPreview({
  placement,
  name,
  title,
  subtitle,
  cta,
  accent,
  kind,
  logoUrl,
  videoUrl,
  posterUrl,
  displayDurationSec = DEFAULT_DISPLAY_DURATION_SEC,
  className = '',
}: SponsorPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      {placement === 'map_banner' && (
        <MapBannerPreview
          name={name}
          title={title}
          subtitle={subtitle}
          cta={cta}
          accent={accent}
          kind={kind}
        />
      )}
      {placement === 'feed_inline' && (
        <FeedInlinePreview
          name={name}
          title={title}
          subtitle={subtitle}
          cta={cta}
          accent={accent}
          kind={kind}
          logoUrl={logoUrl}
        />
      )}
      {placement === 'stories_banner' && (
        <StoriesBannerPreview
          name={name}
          title={title}
          cta={cta}
          accent={accent}
          kind={kind}
          logoUrl={logoUrl}
        />
      )}
      {placement === 'reels_sponsored' && (
        <ReelsSponsoredPreview
          name={name}
          title={title}
          subtitle={subtitle}
          cta={cta}
          accent={accent}
          kind={kind}
          logoUrl={logoUrl}
          posterUrl={posterUrl || videoUrl}
        />
      )}
      <p className="text-[10px] text-gray-500 mt-2 text-center">
        {t('admin.sponsors.previewDurationNote', {
          sec: displayDurationSec,
          context:
            placement === 'map_banner'
              ? t('admin.sponsors.previewDurationMap')
              : placement === 'feed_inline'
                ? t('admin.sponsors.previewDurationFeed')
                : placement === 'stories_banner'
                  ? t('admin.sponsors.previewDurationStories')
                  : t('admin.sponsors.previewDurationReels'),
        })}
      </p>
    </div>
  );
}
