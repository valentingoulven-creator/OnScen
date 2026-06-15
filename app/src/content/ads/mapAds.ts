export interface MapAd {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href?: string;
  accent: 'purple' | 'pink' | 'amber' | 'cyan' | 'rose';
  /** Nom affiché à côté du badge Sponsorisé (démo) */
  sponsor?: string;
  /** Promo interne Soundy vs partenaire fictif */
  kind?: 'promo' | 'sponsored';
  logoUrl?: string;
  /** Action interne (salon, live) si pas de lien externe */
  actionId?: 'salon' | 'live';
  /** Durée d'affichage dans le carrousel (secondes). */
  displayDurationSec?: number;
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
  },
  {
    id: 'salon',
    title: 'Lance ton salon',
    subtitle: 'Partage Spotify ou YouTube avec les auditeurs autour de toi',
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
