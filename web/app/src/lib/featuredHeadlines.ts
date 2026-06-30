import type { MusicNewsItem } from '../types';

/** Pays supportés pour les titres « À la une » (événements musicaux 2026). */
export type FeaturedCountryCode = 'FR' | 'BE' | 'CH' | 'US' | 'GB' | 'CA' | 'DE' | 'ES';

export interface FeaturedHeadlineTemplate {
  title: string;
  excerpt: string;
  source: string;
  imageSeed: string;
  artist?: string;
  genres?: string[];
  /** Âge affiché (heures) — défaut 2 h. */
  hoursAgo?: number;
}

const DEFAULT_COUNTRY: FeaturedCountryCode = 'FR';

const COUNTRY_ALIASES: Record<string, FeaturedCountryCode> = {
  UK: 'GB',
  EN: 'GB',
  USA: 'US',
};

/** Événements majeurs 2026 par pays — top 3 pour rotation quotidienne. */
const FEATURED_BY_COUNTRY: Record<FeaturedCountryCode, FeaturedHeadlineTemplate[]> = {
  FR: [
    {
      title: 'Rock en Seine 2026 : Radiohead, Arctic Monkeys et Arcade Fire en têtes d\'affiche',
      excerpt:
        'Le festival parisien dévoile une programmation historique pour les 28-30 août au Domaine de Saint-Cloud. Plus de 120 000 billets attendus pour ce week-end rock.',
      source: 'Rock en Seine Officiel',
      imageSeed: 'rockenseine2026',
      genres: ['Rock', 'Indie'],
      hoursAgo: 3,
    },
    {
      title: 'Eurovision 2026 : la finale musicale européenne attendue par 180 millions de téléspectateurs',
      excerpt:
        'La plus grande scène télévisée du continent réunit 37 pays. La France aligne une candidate pop pour tenter de décrocher un nouveau trophée après des années de suspense.',
      source: 'Eurovision France',
      imageSeed: 'eurovision2026',
      genres: ['Pop', 'Eurovision'],
      hoursAgo: 5,
    },
    {
      title: 'Stade de France : série de concerts monumentaux annoncée pour l\'été 2026',
      excerpt:
        'Coldplay, Beyoncé et un géant du rap français confirment des dates à guichets fermés. Les organisateurs tablent sur huit soirées consécutives à forte affluence.',
      source: 'Live Nation FR',
      imageSeed: 'stadedefrance2026',
      artist: 'Coldplay',
      genres: ['Pop', 'Concert'],
      hoursAgo: 8,
    },
  ],
  BE: [
    {
      title: 'Tomorrowland 2026 : la programmation électro la plus attendue au monde dévoilée',
      excerpt:
        'Le festival de Boom accueillera plus de 400 DJ sur deux week-ends en juillet. Les premiers noms annoncent une édition record pour les 200 000 festivaliers attendus.',
      source: 'Tomorrowland',
      imageSeed: 'tomorrowland2026',
      genres: ['Electronic', 'Festival'],
      hoursAgo: 2,
    },
    {
      title: 'Rock Werchter 2026 : quatre jours de rock et pop au cœur de la Belgique',
      excerpt:
        'Le festival wallon confirme des têtes d\'affiche internationales du 2 au 5 juillet. Camping, scènes secondaires et aftershows prolongent l\'expérience jusqu\'à l\'aube.',
      source: 'Rock Werchter',
      imageSeed: 'rockwerchter2026',
      genres: ['Rock', 'Pop'],
      hoursAgo: 6,
    },
    {
      title: 'Les Ardentes 2026 : le rap et l\'urban s\'imposent à Liège pour quatre soirées',
      excerpt:
        'Le rendez-vous hip-hop belge réunit les plus grosses ventes francophones et des invités US. Les abonnements partent en quelques heures chaque année.',
      source: 'Les Ardentes',
      imageSeed: 'ardentes2026',
      genres: ['Rap', 'Hip-Hop'],
      hoursAgo: 12,
    },
  ],
  CH: [
    {
      title: 'Montreux Jazz Festival 2026 : 57ᵉ édition avec des légendes du jazz et de la soul',
      excerpt:
        'Sur les rives du lac Léman, le festival accueille des artistes iconiques du 3 au 18 juillet. Les concerts au Stravinski Hall affichent complet en quelques minutes.',
      source: 'Montreux Jazz',
      imageSeed: 'montreuxjazz2026',
      genres: ['Jazz', 'Soul'],
      hoursAgo: 4,
    },
    {
      title: 'Paléo Festival Nyon 2026 : six jours, huit scènes, 230 000 festivaliers attendus',
      excerpt:
        'Le plus grand open-air suisse dévoile une programmation éclectique du 21 au 26 juillet. Rock, électro et chanson française se partagent les affiches.',
      source: 'Paléo Festival',
      imageSeed: 'paleofestival2026',
      genres: ['Festival', 'Rock'],
      hoursAgo: 7,
    },
    {
      title: 'Openair Frauenfeld 2026 : le plus grand festival hip-hop germanophone en Suisse',
      excerpt:
        'Le rendez-vous rap de Thurgovie confirme des têtes d\'affiche US et européennes pour début juillet. Les 70 000 places s\'envolent traditionnellement en un week-end.',
      source: 'Openair Frauenfeld',
      imageSeed: 'openairfrauenfeld2026',
      genres: ['Hip-Hop', 'Rap'],
      hoursAgo: 10,
    },
  ],
  US: [
    {
      title: 'Coachella 2026 : deux week-ends de pop et hip-hop dans le désert californien',
      excerpt:
        'Indio accueille les plus grosses tournées mondiales sur deux week-ends d\'avril. Les annonces officielles font déjà exploser les recherches de vols vers Los Angeles.',
      source: 'Coachella',
      imageSeed: 'coachella2026',
      genres: ['Pop', 'Hip-Hop', 'Festival'],
      hoursAgo: 2,
    },
    {
      title: 'Super Bowl LX 2026 : un show de mi-temps musical historique annoncé',
      excerpt:
        'La NFL confirme une star planétaire pour le spectacle le plus regardé des États-Unis. Les répétitions mobilisent une équipe de 200 danseurs et un orchestre live.',
      source: 'Billboard',
      imageSeed: 'superbowl2026',
      genres: ['Pop', 'Live'],
      hoursAgo: 5,
    },
    {
      title: 'Lollapalooza Chicago 2026 : quatre jours au Grant Park avec 170 artistes',
      excerpt:
        'Le festival emblématique du Midwest dévoile une lineup multi-scènes pour août. Rock, électro et indie dominent les premières annonces.',
      source: 'Lollapalooza',
      imageSeed: 'lollapalooza2026',
      genres: ['Rock', 'Indie', 'Festival'],
      hoursAgo: 9,
    },
  ],
  GB: [
    {
      title: 'Glastonbury 2026 : Worthy Farm accueille la lineup la plus convoitée du Royaume-Uni',
      excerpt:
        'Le festival mythique de Somerset annonce des têtes d\'affiche légendaires pour fin juin. Les 140 000 places se revendent en quelques heures sur le site officiel.',
      source: 'Glastonbury Festival',
      imageSeed: 'glastonbury2026',
      genres: ['Rock', 'Pop', 'Festival'],
      hoursAgo: 3,
    },
    {
      title: 'BST Hyde Park 2026 : série de concerts en plein air au cœur de Londres',
      excerpt:
        'Le parc londonien accueille des icônes de la pop et du rock sur tout l\'été. Les premières dates affichent complet dès l\'ouverture des ventes.',
      source: 'BST Hyde Park',
      imageSeed: 'bsthydepark2026',
      genres: ['Pop', 'Rock'],
      hoursAgo: 6,
    },
    {
      title: 'Reading & Leeds 2026 : le duo de festivals rock le plus suivi du pays',
      excerpt:
        'Les deux sites simultanés réunissent punk, rock et rap pour le week-end de la fin août. Les abonnements early bird partent en moins de 24 heures.',
      source: 'Reading Festival',
      imageSeed: 'readingleeds2026',
      genres: ['Rock', 'Punk', 'Festival'],
      hoursAgo: 11,
    },
  ],
  CA: [
    {
      title: 'Osheaga 2026 : Montréal accueille le plus grand festival indie du Canada',
      excerpt:
        'Parc Jean-Drapeau, trois jours d\'août et plus de 100 artistes sur cinq scènes. La programmation mêle stars internationales et révélations québécoises.',
      source: 'Osheaga',
      imageSeed: 'osheaga2026',
      genres: ['Indie', 'Pop', 'Festival'],
      hoursAgo: 2,
    },
    {
      title: 'Festival d\'été de Québec 2026 : onze jours de concerts gratuits en plein centre-ville',
      excerpt:
        'La plus grande scène gratuite d\'Amérique du Nord confirme des soirées pop et rock sur les Plaines d\'Abraham. Plus de 1,5 million de spectateurs attendus.',
      source: 'Festival d\'été de Québec',
      imageSeed: 'feq2026',
      genres: ['Pop', 'Rock', 'Festival'],
      hoursAgo: 5,
    },
    {
      title: 'Canadian Music Week 2026 : Toronto devient la capitale de l\'industrie musicale',
      excerpt:
        'Conférences, showcases et soirées label réunissent artistes et professionnels du 5 au 9 mai. Les découvertes de l\'édition précédente ont déjà signé en major.',
      source: 'CMW Toronto',
      imageSeed: 'cmw2026',
      genres: ['Industrie', 'Pop'],
      hoursAgo: 8,
    },
  ],
  DE: [
    {
      title: 'Wacken Open Air 2026 : le temple du metal accueille 85 000 fans en Schleswig-Holstein',
      excerpt:
        'Le festival le plus mythique du heavy metal dévoile une lineup internationale pour début août. Les camping-cars réservent leurs places des mois à l\'avance.',
      source: 'Wacken Open Air',
      imageSeed: 'wacken2026',
      genres: ['Metal', 'Rock'],
      hoursAgo: 4,
    },
    {
      title: 'Lollapalooza Berlin 2026 : deux jours d\'électro et de pop à Treptower Park',
      excerpt:
        'La version allemande du festival américain confirme des DJ et groupes internationaux pour septembre. Les billets journaliers partent en quelques heures.',
      source: 'Lollapalooza Berlin',
      imageSeed: 'lollapaloozaberlin2026',
      genres: ['Electronic', 'Pop'],
      hoursAgo: 7,
    },
    {
      title: 'Rock am Ring 2026 : le Nürburgring vibre au son du rock européen',
      excerpt:
        'Le rendez-vous allemand mêle grosses cylindrées et grosses scènes pour un week-end de juin. Les premiers noms annoncés font déjà le buzz sur les réseaux.',
      source: 'Rock am Ring',
      imageSeed: 'rockamring2026',
      genres: ['Rock', 'Festival'],
      hoursAgo: 10,
    },
  ],
  ES: [
    {
      title: 'Primavera Sound 2026 : Barcelone confirme une édition pop et indie record',
      excerpt:
        'Le Parc del Fòrum accueille plus de 200 artistes sur trois jours en juin. La programmation espagnole et latino-américaine domine les premières annonces.',
      source: 'Primavera Sound',
      imageSeed: 'primaverasound2026',
      genres: ['Indie', 'Pop', 'Festival'],
      hoursAgo: 3,
    },
    {
      title: 'Mad Cool Festival 2026 : Madrid accueille des légendes du rock en plein été',
      excerpt:
        'Le festival madrilène s\'étale sur quatre soirées en juillet avec des têtes d\'affiche internationales. Les transports en commun sont renforcés pour l\'affluence.',
      source: 'Mad Cool',
      imageSeed: 'madcool2026',
      genres: ['Rock', 'Pop'],
      hoursAgo: 6,
    },
    {
      title: 'FIB Benicàssim 2026 : six jours face à la Méditerranée avec 150 concerts',
      excerpt:
        'Le rendez-vous estival espagnol mêle électro, rock et pop du 16 au 21 juillet. Le camping sur la plage affiche complet des mois avant l\'ouverture.',
      source: 'FIB Festival',
      imageSeed: 'fib2026',
      genres: ['Festival', 'Electronic'],
      hoursAgo: 9,
    },
  ],
};

export function normalizeFeaturedCountryCode(code: string | null | undefined): FeaturedCountryCode {
  if (!code?.trim()) return DEFAULT_COUNTRY;
  const upper = code.trim().toUpperCase();
  const mapped = COUNTRY_ALIASES[upper] ?? upper;
  if (mapped in FEATURED_BY_COUNTRY) return mapped as FeaturedCountryCode;
  return DEFAULT_COUNTRY;
}

/** Index de rotation parmi le top 3 — change chaque jour (UTC). */
export function pickFeaturedRotationIndex(count: number, now = Date.now()): number {
  if (count <= 1) return 0;
  const year = new Date(now).getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / 86_400_000);
  return dayOfYear % count;
}

export function buildFeaturedNewsItem(
  template: FeaturedHeadlineTemplate,
  countryCode: FeaturedCountryCode,
  index: number,
  now = Date.now()
): MusicNewsItem {
  const h = 3_600_000;
  return {
    id: `une-${countryCode.toLowerCase()}-${index}`,
    type: 'news',
    category: 'une',
    title: template.title,
    source: template.source,
    excerpt: template.excerpt,
    imageUrl: `https://picsum.photos/seed/${template.imageSeed}/600/300`,
    artist: template.artist,
    publishedAt: now - (template.hoursAgo ?? 2) * h,
    url: '#',
    badge: 'À la une',
    genres: template.genres,
  };
}

/** Retourne le titre « À la une » du jour pour le pays (rotation sur le top 3). */
export function getFeaturedHeadlineForCountry(
  countryCode: string | null | undefined,
  now = Date.now()
): MusicNewsItem {
  const code = normalizeFeaturedCountryCode(countryCode);
  const templates = FEATURED_BY_COUNTRY[code];
  const idx = pickFeaturedRotationIndex(templates.length, now);
  return buildFeaturedNewsItem(templates[idx], code, idx, now);
}

/** Remplace les entrées API « une » par le titre localisé selon le pays. */
export function mergeNewsWithCountryFeatured(
  newsItems: MusicNewsItem[],
  countryCode: string | null | undefined,
  now = Date.now()
): MusicNewsItem[] {
  const withoutUne = newsItems.filter((n) => n.category !== 'une');
  return [getFeaturedHeadlineForCountry(countryCode, now), ...withoutUne];
}
