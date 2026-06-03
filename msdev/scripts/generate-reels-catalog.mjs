#!/usr/bin/env node
/** Génère app/src/content/reelsDemoCatalog.ts à partir de mixkit-video-ids.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const idsPath = path.join(__dirname, 'mixkit-video-ids.json');
const outPaths = [
  path.join(root, 'app/src/content/reelsDemoCatalog.ts'),
  path.join(root, 'backend/src/lib/reelsDemoCatalog.ts'),
];

/** Reels nommés d’origine (conservés en tête du flux). */
const FEATURED = [
  { id: 'reel-guitar', videoId: 483, musicId: 872, title: 'Guitare électrique', artist: 'Electric Soul', genre: 'Rock' },
  { id: 'reel-dj', videoId: 830, musicId: 989, title: 'Platines DJ', artist: 'DJ Melody', genre: 'Électro' },
  { id: 'reel-drums', videoId: 427, musicId: 1140, title: 'Groove batterie', artist: 'Rhythm Crew', genre: 'Batterie live' },
  { id: 'reel-piano', videoId: 44147, musicId: 787, title: 'Piano virtuose', artist: 'Keys & Chill', genre: 'Lo-fi' },
  { id: 'reel-vinyl', videoId: 5035, musicId: 1141, title: 'Platine vinyle', artist: 'RetroWave', genre: 'House' },
  { id: 'reel-concert', videoId: 4188, musicId: 1147, title: 'Scène électro', artist: 'Arena Pulse', genre: 'Concert' },
  { id: 'reel-guitar-studio', videoId: 42824, musicId: 868, title: 'Session studio', artist: 'MeloSession', genre: 'Acoustique' },
  { id: 'reel-piano-mood', videoId: 33936, musicId: 849, title: 'Piano nocturne', artist: 'Blue Note', genre: 'Jazz' },
  { id: 'reel-tape', videoId: 425, musicId: 858, title: 'Cassette rétro', artist: 'Crate Digger', genre: 'Soul' },
  { id: 'reel-club', videoId: 4344, musicId: 1077, title: 'Nightclub lasers', artist: 'NeonVox', genre: 'Électro' },
  { id: 'reel-dance', videoId: 344, musicId: 635, title: 'Piste de danse', artist: 'Street Flow', genre: 'House' },
];

const GENRES = [
  'Électro',
  'House',
  'Lo-fi',
  'Rock',
  'Jazz',
  'Pop',
  'Hip-hop',
  'Indie',
  'Techno',
  'Acoustique',
  'Concert',
  'Soul',
  'Funk',
  'Trap',
  'Ambient',
];

const ARTISTS = [
  'MeloVibes',
  'Neon Pulse',
  'Urban Echo',
  'Crystal Beats',
  'Night Driver',
  'Solar Drift',
  'Deep Grove',
  'Velvet Sound',
  'Pulse Unit',
  'Echo Lane',
  'Static Dream',
  'Wave Theory',
  'Chrome Hearts',
  'Basement FM',
  'Skyline Audio',
];

const TITLES = [
  'Session nocturne',
  'Groove urbain',
  'Lumières strobées',
  'Rythme live',
  'Vibes du soir',
  'Pulse électrique',
  'Ambiance club',
  'Beat libre',
  'Flow musical',
  'Instant live',
  'Scène ouverte',
  'Backstage',
  'En direct',
  'Session libre',
  'Mood track',
];

const MUSIC_POOL = [
  635, 700, 710, 720, 730, 740, 750, 760, 770, 780, 787, 800, 810, 820, 830, 840, 849, 858, 868, 872,
  880, 890, 900, 910, 920, 930, 940, 950, 960, 970, 980, 989, 1000, 1010, 1020, 1030, 1040, 1050, 1060, 1077,
  1080, 1090, 1100, 1110, 1120, 1130, 1140, 1141, 1147, 1150, 1160, 1170, 1180, 1190, 1200,
];

const scraped = JSON.parse(fs.readFileSync(idsPath, 'utf-8'));
const usedVideo = new Set(FEATURED.map((f) => f.videoId));
const entries = [...FEATURED];

let i = 0;
for (const videoId of scraped) {
  if (usedVideo.has(videoId)) continue;
  usedVideo.add(videoId);
  const genre = GENRES[i % GENRES.length];
  const artist = ARTISTS[i % ARTISTS.length];
  const title = `${TITLES[i % TITLES.length]} #${videoId}`;
  const musicId = MUSIC_POOL[i % MUSIC_POOL.length];
  entries.push({
    id: `reel-mk-${videoId}`,
    videoId,
    musicId,
    title,
    artist,
    genre,
  });
  i++;
  if (entries.length >= 110) break;
}

const header = `/**
 * Catalogue reels démo — vidéos Mixkit (licence Mixkit) + musique Mixkit Music.
 * Généré par msdev/scripts/generate-reels-catalog.mjs — ne pas éditer à la main.
 * @see https://mixkit.co/free-stock-video/
 * @see https://mixkit.co/free-stock-music/
 */
export interface ReelCatalogEntry {
  id: string;
  videoId: number;
  musicId: number;
  title: string;
  artist: string;
  genre: string;
}

export const REEL_CATALOG_ENTRIES: ReelCatalogEntry[] = `;

const body = JSON.stringify(entries, null, 2);

for (const outPath of outPaths) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${header}${body};\n`, 'utf-8');
  console.error(`Wrote ${entries.length} reels to ${outPath}`);
}
