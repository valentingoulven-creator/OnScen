import type { User } from '../types';

export const OFFLINE_DEMO_TOKEN = 'offline-demo-token';

export function isOfflineDemo(): boolean {
  return import.meta.env.VITE_OFFLINE_DEMO === '1' || import.meta.env.VITE_OFFLINE_DEMO === 'true';
}

export const OFFLINE_DEMO_USER: User = {
  id: 'user_listener',
  username: 'Auditeur',
  email: 'listener@msdev.local',
  avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
  profilePhotos: [
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
  ],
  isGhostMode: false,
  bio: 'Mode démo hors-ligne — explorez MeloSong sans serveur.',
  interests: ['Sessions live', 'Carte géoloc', 'Spotify Jam', 'Rencontres musicales'],
  favoriteGenres: ['Électro', 'Indie', 'Lo-fi', 'French touch'],
  favoriteArtists: ['M83', 'Daft Punk', 'Lomepal'],
  connectedPlatforms: ['spotify', 'youtube'],
  city: 'Paris',
  listeningRole: 'les_deux',
  memberSince: Date.now() - 86400000 * 30,
  stats: { salonsHosted: 0, livesHosted: 0 },
  shareDistance: true,
  locationPrecision: 'precise',
};
