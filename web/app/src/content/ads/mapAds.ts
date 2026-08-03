export type MapAdVisibilityScope = 'france' | 'region';
export type MapBannerDisplayMode = 'full' | 'image_only';

export interface MapAd {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent?: 'purple' | 'pink' | 'amber' | 'cyan' | 'rose';
  bannerDisplayMode?: MapBannerDisplayMode;
  /** Nom affiché à côté du badge Sponsorisé (démo) */
  sponsor?: string;
  /** Promo interne Soundy vs partenaire fictif */
  kind?: 'promo' | 'sponsored';
  logoUrl?: string;
  /** Image de fond du bandeau carte (optionnel). */
  bannerImageUrl?: string;
  /** Action interne (salon, live) si pas de lien externe */
  actionId?: 'salon' | 'live';
  /** Durée d'affichage dans le carrousel (secondes). */
  displayDurationSec?: number;
  /** Ciblage carte (repli statique msdev). */
  mapVisibilityScope?: MapAdVisibilityScope;
  mapTargetLat?: number;
  mapTargetLng?: number;
}

export const MAP_ADS: MapAd[] = [
  {
    id: 'premium',
    title: 'Soundy Premium',
    subtitle: 'Sans pub sur la carte et badge exclusif pour ton profil',
    cta: 'Découvrir',
    accent: 'purple',
    sponsor: 'Soundy',
    kind: 'promo',
    displayDurationSec: 15,
  },
  {
    id: 'solar-festival-cres',
    title: 'Solar Festival au Crès',
    subtitle: '5e édition · 4 juillet 2026 · Lac du Crès, Montpellier · Petit Biscuit, KAS:ST & plus',
    cta: 'Billetterie →',
    href: 'https://solarfestival.fr/billetterie',
    accent: 'cyan',
    sponsor: 'Solar Festival',
    kind: 'sponsored',
    bannerImageUrl:
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1280&h=192&fit=crop&q=80',
    logoUrl:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=80&h=80&fit=crop',
    displayDurationSec: 10,
    mapVisibilityScope: 'region',
    mapTargetLat: 43.6405,
    mapTargetLng: 3.9395,
  },
  {
    id: 'les-deferlantes-2026',
    title: 'Les Déferlantes 2026',
    subtitle: 'Rock & chanson française à Argelès-sur-Mer — 3 au 7 juillet 2026 · scène méditerranéenne',
    cta: 'Billetterie',
    href: 'https://www.lesdeferlantes.com',
    accent: 'rose',
    sponsor: 'Les Déferlantes',
    kind: 'promo',
    logoUrl:
      'https://images.unsplash.com/photo-1459749411176-827ae46c79ea?w=80&h=80&fit=crop',
    displayDurationSec: 10,
    mapVisibilityScope: 'region',
    mapTargetLat: 42.5467,
    mapTargetLng: 3.0222,
  },
  {
    id: 'salon',
    title: 'Lance ton salon',
    subtitle: 'Partage YouTube avec les auditeurs autour de toi',
    cta: 'Créer un salon',
    accent: 'pink',
    sponsor: 'Soundy',
    kind: 'promo',
  },
  {
    id: 'live',
    title: 'Passe en live',
    subtitle: 'Réactions, chat public et messages privés depuis la carte',
    cta: 'Voir les lives',
    accent: 'amber',
    sponsor: 'Soundy',
    kind: 'promo',
  },
  {
    id: 'deezer-demo',
    title: 'Deezer — essai gratuit',
    subtitle: 'HiFi, paroles synchronisées et playlists sans pub pendant 3 mois',
    cta: 'En savoir plus',
    href: 'https://www.deezer.com/fr/offers',
    accent: 'cyan',
    sponsor: 'Deezer',
    kind: 'sponsored',
  },
  {
    id: 'fnac-demo',
    title: 'Fnac Musique',
    subtitle: '−20 % sur les vinyles et CD près de chez toi — offre démo msdev',
    cta: 'Voir l’offre',
    accent: 'rose',
    sponsor: 'Fnac',
    kind: 'sponsored',
  },
  {
    id: 'discover',
    title: 'Explore la carte Soundy',
    subtitle: 'Salons, lives et créateurs musicaux à proximité — rejoins la communauté',
    cta: 'Explorer',
    accent: 'purple',
    sponsor: 'Soundy',
    kind: 'promo',
  },
];
