import { handleSponsorCta } from '../lib/sponsorAds';
import { useSponsorAdsRotation } from '../lib/useSponsorAdsRotation';
import { SPONSOR_ACCENT_GRADIENTS, sponsorKindBadgeLabel } from '../lib/sponsorDisplaySpec';

interface FeedInlineAdBannerProps {
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

export function FeedInlineAdBanner({ onCtaSalon, onCtaLive }: FeedInlineAdBannerProps) {
  const { ads, ad, index, fading, goTo, hasAds } = useSponsorAdsRotation('feed');

  if (!hasAds || !ad) return null;

  const badgeLabel = sponsorKindBadgeLabel(ad.kind ?? 'promo');

  return (
    <div
      className="min-w-0"
      role="region"
      aria-label="Publicité sponsorisée dans le fil"
    >
      <div className="rounded-2xl border border-[#2d2d3d] bg-[#12121a] overflow-hidden">
        <div className={`h-1 bg-gradient-to-r ${SPONSOR_ACCENT_GRADIENTS[ad.accent]}`} aria-hidden />
        <div
          key={ad.id}
          className={`flex items-start gap-3 p-3 min-h-[7.5rem] transition-opacity duration-200 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <SponsorLogo logoUrl={ad.logoUrl} className="w-12 h-12 rounded-xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/25">
                {badgeLabel}
              </span>
              {ad.sponsor && <span className="text-xs text-gray-400 truncate">{ad.sponsor}</span>}
            </div>
            <p className="text-sm font-semibold text-white truncate">{ad.title}</p>
            <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{ad.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => handleSponsorCta(ad, { onCtaSalon, onCtaLive })}
            className="shrink-0 self-center px-3 py-1.5 rounded-lg text-xs font-bold text-purple-200 border border-purple-500/40 bg-purple-600/20 hover:bg-purple-600/35 transition"
          >
            {ad.cta}
          </button>
        </div>
        {ads.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-2">
            {ads.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index % ads.length ? 'w-5 bg-purple-400/90' : 'w-2 bg-white/25 hover:bg-white/45'
                }`}
                aria-label={`Publicité ${i + 1} sur ${ads.length}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
