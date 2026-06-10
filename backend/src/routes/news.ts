import { Router, Request, Response } from 'express';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.data;
      return null;
    },
    set(data: T) {
      entry = { data, expiresAt: Date.now() + ttlMs };
    },
  };
}

const newsCache = makeCache<{ news: MusicNewsItem[] }>(60_000);

export const newsRouter = Router();

export interface MusicNewsItem {
  id: string;
  type: 'news' | 'promo' | 'trending';
  category: 'une' | 'musique' | 'promo' | 'tendance';
  title: string;
  source?: string;
  excerpt: string;
  imageUrl?: string;
  artist?: string;
  publishedAt: number;
  url?: string;
  badge?: string;
  isPromo?: boolean;
  trending?: boolean;
  trendingRank?: number;
  genres?: string[];
}

function buildItems(): MusicNewsItem[] {
  const now = Date.now();
  const h = 3_600_000;
  const d = 86_400_000;

  return [
    // ── À la une : fournie côté client (featuredHeadlines.ts, MODIF 329) ───
    // ── Musique ─────────────────────────────────────────────────────────────
    {
      id: 'news-1',
      type: 'news',
      category: 'musique',
      title: 'Daft Punk : des inédits retrouvés dans les archives de Thomas Bangalter',
      source: 'Les Inrocks',
      excerpt:
        "L'ancien moitié du duo confirme l'existence de nombreux titres enregistrés entre 1997 et 2013, encore jamais publiés.",
      imageUrl: 'https://picsum.photos/seed/daftpunk2026/400/225',
      artist: 'Daft Punk',
      publishedAt: now - 6 * h,
      url: '#',
      genres: ['Electronic', 'French House'],
    },
    {
      id: 'news-2',
      type: 'news',
      category: 'musique',
      title: 'Rihanna de retour en studio : son 9ᵉ album en préparation à Los Angeles',
      source: 'Billboard FR',
      excerpt:
        "Après plusieurs années d'absence dans l'industrie musicale, la superstar aurait passé plusieurs semaines en studio en collaboration avec des producteurs de premier plan.",
      imageUrl: 'https://picsum.photos/seed/rihannanew/400/225',
      artist: 'Rihanna',
      publishedAt: now - 12 * h,
      url: '#',
      genres: ['R&B', 'Pop'],
    },
    {
      id: 'news-3',
      type: 'news',
      category: 'musique',
      title: "Stromae prépare une collaboration surprise pour l'été avec des artistes francophones",
      source: 'Libération Culture',
      excerpt:
        "Le chanteur belge serait à l'origine d'un projet collectif inédit. Une annonce officielle est attendue d'ici la fin du mois.",
      imageUrl: 'https://picsum.photos/seed/stromae2026/400/225',
      artist: 'Stromae',
      publishedAt: now - 1 * d,
      url: '#',
      genres: ['Électro', 'Pop'],
    },
    {
      id: 'news-4',
      type: 'news',
      category: 'musique',
      title: 'Beyoncé établit un record historique avec 32 Grammy Awards',
      source: 'Rolling Stone FR',
      excerpt:
        "La chanteuse est désormais l'artiste la plus récompensée de l'histoire des Grammy. Sa dernière cérémonie lui a valu cinq nouveaux trophées.",
      imageUrl: 'https://picsum.photos/seed/beyonce2026/400/225',
      artist: 'Beyoncé',
      publishedAt: now - 2 * d,
      url: '#',
      genres: ['R&B', 'Pop'],
    },
    {
      id: 'news-5',
      type: 'news',
      category: 'musique',
      title: 'Le rap français domine les charts européens pour la 4ᵉ semaine consécutive',
      source: 'Télérama',
      excerpt:
        'Avec Hamza, SCH et Ninho en tête des classements pan-européens, le rap francophone confirme son rayonnement bien au-delà des frontières.',
      imageUrl: 'https://picsum.photos/seed/rapfrancais2026/400/225',
      publishedAt: now - 3 * d,
      url: '#',
      genres: ['Rap', 'Hip-Hop'],
    },
    // ── Promotions ──────────────────────────────────────────────────────────
    {
      id: 'promo-1',
      type: 'promo',
      category: 'promo',
      title: 'Rock en Seine 2026 — Programmation dévoilée : Radiohead, Arctic Monkeys, Arcade Fire',
      source: 'Rock en Seine Officiel',
      excerpt:
        "L'édition 2026 du festival parisien accueille trois têtes d'affiche iconiques pour un week-end exceptionnel les 28-30 août au Domaine de Saint-Cloud.",
      imageUrl: 'https://picsum.photos/seed/festival2026/400/225',
      publishedAt: now - 5 * h,
      url: '#',
      badge: 'Festival',
      isPromo: true,
      genres: ['Rock', 'Indie'],
    },
    {
      id: 'promo-2',
      type: 'promo',
      category: 'promo',
      title: 'Kendrick Lamar — "Euphoria Sessions" disponible ce vendredi',
      source: 'Pitchfork FR',
      excerpt:
        'Le nouveau projet de Kendrick Lamar arrive avec 16 titres inédits et des collaborations avec SZA, Future et Pharrell Williams.',
      imageUrl: 'https://picsum.photos/seed/kendrick2026/400/225',
      artist: 'Kendrick Lamar',
      publishedAt: now - 8 * h,
      url: '#',
      badge: 'Nouvel Album',
      isPromo: true,
      genres: ['Hip-Hop', 'Rap'],
    },
    {
      id: 'promo-3',
      type: 'promo',
      category: 'promo',
      title: 'Coldplay — Music of the Spheres Tour : dates françaises confirmées',
      source: 'Live Nation',
      excerpt:
        'Coldplay jouera à Paris La Défense Arena les 15 et 16 juillet 2026. La mise en vente des billets aura lieu ce lundi à 9h.',
      imageUrl: 'https://picsum.photos/seed/coldplay2026/400/225',
      artist: 'Coldplay',
      publishedAt: now - 1 * d,
      url: '#',
      badge: 'Concert',
      isPromo: true,
      genres: ['Rock', 'Pop'],
    },
    {
      id: 'promo-4',
      type: 'promo',
      category: 'promo',
      title: 'Spotify lance « MoodMatch » : la playlist IA adaptée à votre humeur en temps réel',
      source: 'Spotify Blog',
      excerpt:
        "La nouvelle fonctionnalité utilise l'intelligence artificielle et votre activité pour créer une playlist personnalisée qui évolue tout au long de la journée.",
      imageUrl: 'https://picsum.photos/seed/spotify2026/400/225',
      publishedAt: now - 2 * d,
      url: '#',
      badge: 'Nouveau',
      isPromo: true,
      genres: ['Streaming', 'Tech'],
    },
    // ── Tendances ────────────────────────────────────────────────────────────
    {
      id: 'trend-1',
      type: 'trending',
      category: 'tendance',
      title: 'The Weeknd',
      excerpt: '12 M écoutes / semaine',
      artist: 'The Weeknd',
      imageUrl: 'https://picsum.photos/seed/weeknd2026/200/200',
      publishedAt: now,
      trendingRank: 1,
      trending: true,
      genres: ['R&B', 'Pop', 'Synth-pop'],
    },
    {
      id: 'trend-2',
      type: 'trending',
      category: 'tendance',
      title: 'Billie Eilish',
      excerpt: '9,2 M écoutes / semaine',
      artist: 'Billie Eilish',
      imageUrl: 'https://picsum.photos/seed/billieeilish2026/200/200',
      publishedAt: now,
      trendingRank: 2,
      trending: true,
      genres: ['Pop', 'Indie'],
    },
    {
      id: 'trend-3',
      type: 'trending',
      category: 'tendance',
      title: 'Dua Lipa',
      excerpt: '8,5 M écoutes / semaine',
      artist: 'Dua Lipa',
      imageUrl: 'https://picsum.photos/seed/dualipa2026/200/200',
      publishedAt: now,
      trendingRank: 3,
      trending: true,
      genres: ['Pop', 'Dance'],
    },
    {
      id: 'trend-4',
      type: 'trending',
      category: 'tendance',
      title: 'Kendrick Lamar',
      excerpt: '8,1 M écoutes / semaine',
      artist: 'Kendrick Lamar',
      imageUrl: 'https://picsum.photos/seed/kendricklamar2026/200/200',
      publishedAt: now,
      trendingRank: 4,
      trending: true,
      genres: ['Hip-Hop', 'Rap'],
    },
    {
      id: 'trend-5',
      type: 'trending',
      category: 'tendance',
      title: 'Hamza',
      excerpt: '5,2 M écoutes / semaine',
      artist: 'Hamza',
      imageUrl: 'https://picsum.photos/seed/hamzarap2026/200/200',
      publishedAt: now,
      trendingRank: 5,
      trending: true,
      genres: ['Rap', 'R&B'],
    },
    {
      id: 'trend-6',
      type: 'trending',
      category: 'tendance',
      title: 'Stromae',
      excerpt: '4,8 M écoutes / semaine',
      artist: 'Stromae',
      imageUrl: 'https://picsum.photos/seed/stromaeartist2026/200/200',
      publishedAt: now,
      trendingRank: 6,
      trending: true,
      genres: ['Électro', 'Pop'],
    },
  ];
}

newsRouter.get('/', (_req: Request, res: Response) => {
  const cached = newsCache.get();
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(cached);
    return;
  }
  const result = { news: buildItems() };
  newsCache.set(result);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(result);
});
