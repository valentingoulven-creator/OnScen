import { handleSponsorCta } from '../lib/sponsorAds';
import { useSponsorAdsRotation } from '../lib/useSponsorAdsRotation';
import { sponsorKindBadgeLabel } from '../lib/sponsorDisplaySpec';

interface SalonAdBannerProps {
  onCtaSalon?: () => void;
  onCtaLive?: () => void;
}

function SponsorLogo({ logoUrl }: { logoUrl?: string }) {
  if (logoUrl?.trim()) {
    return (
      <img
        src={logoUrl.trim()}
        alt=""
        className="w-9 h-9 rounded-lg object-cover bg-[#1a1a26] shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-[#1a1a26] shrink-0 flex items-center justify-center text-[9px] text-gray-600 font-bold">
      AD
    </div>
  );
}

export function SalonAdBanner({ onCtaSalon, onCtaLive }: SalonAdBannerProps) {
  const { ads, ad, index, fading, goTo, hasAds } = useSponsorAdsRotation('salon');

  if (!hasAds || !ad) return null;

  const badgeLabel = sponsorKindBadgeLabel(ad.kind ?? 'promo');

  return (
    <div
      className="shrink-0 border-t border-[#1e1e2f] bg-[#12121a]"
      role="region"
      aria-label="Bandeau sponsorisé"
    >
      <div
        className={`flex items-center gap-2.5 px-3 min-h-[3.75rem] transition-opacity duration-200 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <SponsorLogo logoUrl={ad.logoUrl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
              {badgeLabel}
            </span>
            {ad.sponsor && (
              <span className="text-[10px] text-gray-500 truncate max-w-[6rem]">
                {ad.sponsor}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-white/90 truncate leading-tight">
            {ad.title}
          </p>
          {ad.subtitle && (
            <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">
              {ad.subtitle}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleSponsorCta(ad, { onCtaSalon, onCtaLive })}
          className="shrink-0 min-h-[2.75rem] px-3 py-1.5 rounded-lg border border-[#2a2a3d] bg-[#1a1a2a] hover:bg-[#22223a] text-[11px] font-semibold text-gray-300 hover:text-white transition whitespace-nowrap"
        >
          {ad.cta}
        </button>
      </div>

      {ads.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-1.5">
          {ads.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${
                i === index % ads.length
                  ? 'w-4 bg-white/50'
                  : 'w-1.5 bg-white/20 hover:bg-white/35'
              }`}
              aria-label={`Publicité ${i + 1} sur ${ads.length}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
