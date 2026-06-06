import { REEL_CATALOG_ENTRIES } from './reelsDemoCatalog';

export interface MusicReel {
  id: string;
  title: string;
  artist: string;
  genre: string;
  /** Affichage principal : vidéo si présente, sinon image poster */
  mediaType?: 'video' | 'image';
  /** Optionnel — absent ou mediaType "image" = reel statique */
  videoUrl?: string;
  posterUrl: string;
  /** Durée en secondes (démo ou API) ; affinée côté client via loadedmetadata si absent */
  durationSec?: number;
  /** Piste audio séparée (MP3 Mixkit) quand la vidéo b-roll est muette */
  audioUrl?: string;
  /** Flux public avec son jouable (audioUrl ou piste intégrée / enregistrement) */
  hasAudio?: boolean;
  /** Propriétaire pour les reels ajoutés par l'utilisateur */
  authorId?: string;
  /** public = flux Reels ; private = profil uniquement */
  visibility?: 'public' | 'private';
  isPrivate?: boolean;
  /** Vues uniques (API profil / stats) */
  viewCount?: number;
}

/** Durées approximatives des clips Mixkit du catalogue (affinées au chargement vidéo). */
const MIXKIT_DURATION_SEC: Record<number, number> = {
  483: 16,
  830: 11,
  427: 36,
  44147: 21,
  5035: 19,
  4188: 23,
  42824: 19,
  33936: 15,
  425: 30,
  4344: 13,
  344: 14,
};

/** URLs Mixkit stables : assets.mixkit.co/videos/{id}/{id}-720.mp4 (b-roll sans piste audio) */
export function mixkit(id: number): Pick<MusicReel, 'videoUrl' | 'posterUrl' | 'durationSec'> {
  const base = `https://assets.mixkit.co/videos/${id}`;
  const durationSec = MIXKIT_DURATION_SEC[id];
  return {
    videoUrl: `${base}/${id}-720.mp4`,
    posterUrl: `${base}/${id}-thumb-720-0.jpg`,
    ...(durationSec != null ? { durationSec } : {}),
  };
}

/** Musique libre Mixkit (MP3) — assets.mixkit.co/free-stock-music */
export function mixkitMusic(id: number): Pick<MusicReel, 'audioUrl' | 'hasAudio'> {
  return {
    audioUrl: `https://assets.mixkit.co/music/${id}/${id}.mp3`,
    hasAudio: true,
  };
}

/**
 * Reels démo publics : visuels Mixkit + pistes Mixkit Music (vidéo toujours muette côté client).
 * Sources : mixkit.co/free-stock-video + mixkit.co/free-stock-music
 *
 * Note : vidéo et musique proviennent d'enregistrements distincts — le rythme visuel ne
 * coïncide pas forcément avec la musique ; seule l'alignement temporel (démarrage à 0, correction
 * de dérive) est garanti côté lecteur.
 */
/** Nombre de reels vidéo du catalogue démo (Mixkit). */
export const REELS_DEMO_VIDEO_COUNT = REEL_CATALOG_ENTRIES.length;

export const MUSIC_REELS: MusicReel[] = REEL_CATALOG_ENTRIES.map((entry) => ({
  id: entry.id,
  title: entry.title,
  artist: entry.artist,
  genre: entry.genre,
  mediaType: 'video' as const,
  ...mixkit(entry.videoId),
  ...mixkitMusic(entry.musicId),
}));
