import { handleSponsorCta } from '../lib/sponsorAds';
import { useSponsorAdsRotation } from '../lib/useSponsorAdsRotation';
import { resolveAccentGradientClass, SPONSOR_NEUTRAL_BANNER_BG, sponsorKindBadgeLabel } from '../lib/sponsorDisplaySpec';

interface StoriesAdBannerProps {
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

function SponsorLogo({ logoUrl, className }: { logoUrl?: string; className: string }) {
  if (logoUrl?.trim()) {
    return (
      <img
        src={logoUrl.trim()}
        alt=""
        className={`${className} object-cover bg-[#1a1a26] shrink-0`}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div
      className={`${className} bg-[#1a1a26] shrink-0 flex items-center justify-center text-[9px] text-gray-500`}
    >
      AD
    </div>
  );
}

export function StoriesAdBanner({ onCtaSalon, onCtaLive }: StoriesAdBannerProps) {
  const { ads, ad, index, fading, goTo, hasAds } = useSponsorAdsRotation('stories');

  if (!hasAds || !ad) return null;

  const badgeLabel = sponsorKindBadgeLabel(ad.kind ?? 'promo');
  const accentGradient = resolveAccentGradientClass(ad.accent) ?? SPONSOR_NEUTRAL_BANNER_BG;

  return (
    <div className="px-2 pt-2 pb-1 min-w-0" role="region" aria-label="Bandeau sponsorisé stories">
      <button
        type="button"
        key={ad.id}
        onClick={() => handleSponsorCta(ad, { onCtaSalon, onCtaLive }, { placement: 'stories_banner' })}
        className={`w-full flex items-center gap-2 px-3 py-2 min-h-14 rounded-xl border border-white/10 bg-gradient-to-r ${accentGradient} text-left transition-opacity duration-200 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <SponsorLogo logoUrl={ad.logoUrl} className="w-8 h-8 rounded-lg" />
        <span className="text-[10px] font-bold uppercase text-amber-200 shrink-0">{badgeLabel}</span>
        {ad.sponsor && (
          <span className="text-xs font-semibold text-white/70 truncate max-w-[4.5rem] shrink-0">
            {ad.sponsor}
          </span>
        )}
        <p className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{ad.title}</p>
        <span className="text-xs font-bold text-white/90 shrink-0">{ad.cta}</span>
      </button>
      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1.5">
          {ads.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${
                i === index % ads.length ? 'w-4 bg-white/80' : 'w-1.5 bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Publicité ${i + 1} sur ${ads.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
