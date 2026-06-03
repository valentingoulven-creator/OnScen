import bcrypt from 'bcryptjs';
import { db, Salon, Live, MusicPlatform, User } from './models/schema';
import { blurCoordinate } from './lib/geo';
import { refreshUserPublicCoords } from './lib/locationPrivacy';
import { ensureMapBots } from './seed-bots';
import { followUser } from './lib/follows';
import { ensureSalonQueue, ensureSalonProposals, enqueueItem } from './lib/salonPlaybackOps';

export async function seedMsdevData(): Promise<void> {
  if (db.users.size > 0) return;

  const hash = await bcrypt.hash('msdev123', 10);
  const parisLat = 48.8566;
  const parisLon = 2.3522;

  const dj: User = {
    id: 'user_dj',
    username: 'DJ Melody',
    email: 'dj@msdev.local',
    passwordHash: hash,
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DJMelody',
    meloCoins: 500,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };

  const bass: User = {
    id: 'user_bass',
    username: 'BassHunter',
    email: 'bass@msdev.local',
    passwordHash: hash,
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=BassHunter',
    meloCoins: 200,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };

  const listener: User = {
    id: 'user_listener',
    username: 'Auditeur',
    email: 'listener@msdev.local',
    passwordHash: hash,
    avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
    profilePhotos: [
      'https://api.dicebear.com/7.x/adventurer/svg?seed=Listener',
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    ],
    meloCoins: 100,
    isGhostMode: false,
    lastSeenAt: Date.now(),
    memberSince: Date.now() - 86400000 * 30,
    bio: 'Curieux·se de tout ce qui sonne autour de moi. J’explore les salons sur la carte et je partage mes découvertes — ici pour la musique, pas pour le dating.',
    interests: ['Sessions live', 'Carte géoloc', 'Spotify Jam', 'Rencontres musicales'],
    favoriteGenres: ['Électro', 'Indie', 'Lo-fi', 'French touch'],
    favoriteArtists: ['M83', 'Daft Punk', 'Lomepal'],
    connectedPlatforms: ['spotify', 'youtube'] as MusicPlatform[],
    city: 'Paris',
    listeningRole: 'les_deux' as const,
  };

  Object.assign(dj, {
    bio: 'Host deep house — je mixe en live sur MeloSong pour faire vibrer le quartier.',
    interests: ['Deep house', 'Live mixing', 'Communauté'],
    favoriteGenres: ['House', 'Techno'],
    favoriteArtists: ['M83', 'Disclosure'],
    connectedPlatforms: ['spotify'],
    city: 'Paris',
    listeningRole: 'host',
    memberSince: Date.now() - 86400000 * 120,
  });

  Object.assign(bass, {
    bio: 'YouTube & bass music — toujours un morceau à partager.',
    interests: ['YouTube', 'Bass', 'Memes musicaux'],
    favoriteGenres: ['Dubstep', 'Pop'],
    favoriteArtists: ['Rick Astley', 'Skrillex'],
    connectedPlatforms: ['youtube'],
    city: 'Paris',
    listeningRole: 'host',
    memberSince: Date.now() - 86400000 * 60,
  });

  const setUserGeo = (u: User, lat: number, lon: number) => {
    u.latitude = lat;
    u.longitude = lon;
    refreshUserPublicCoords(u);
    u.lastSeenAt = Date.now();
  };

  setUserGeo(dj, parisLat + 0.0004, parisLon + 0.0003);
  setUserGeo(bass, parisLat - 0.0005, parisLon + 0.0002);
  setUserGeo(listener, parisLat - 0.0008, parisLon - 0.0004);

  db.users.set(dj.id, dj);
  db.users.set(bass.id, bass);
  db.users.set(listener.id, listener);

  const salon1: Salon = {
    id: 'salon_dj',
    hostId: dj.id,
    hostName: dj.username,
    hostAvatarUrl: dj.avatarUrl,
    title: 'Deep House Paris',
    platform: 'spotify',
    playbackState: {
      platform: 'spotify',
      trackId: '2P91MQbaiQKBR4c9sEgqsl',
      title: 'Midnight City',
      artist: 'M83',
      albumArtUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400',
      isPlaying: true,
      progressMs: 45000,
      updatedAt: Date.now(),
      startedAt: Date.now() - 45000,
      externalUrl: 'https://open.spotify.com/track/2P91MQbaiQKBR4c9sEgqsl',
    },
    latitude: parisLat + 0.0004,
    longitude: parisLon + 0.0003,
    blurredLatitude: blurCoordinate(parisLat + 0.0004),
    blurredLongitude: blurCoordinate(parisLon + 0.0003),
    listenersCount: 8,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [dj.id],
    allowQueue: true,
    createdAt: Date.now(),
  };

  const salon2: Salon = {
    id: 'salon_bass',
    hostId: bass.id,
    hostName: bass.username,
    hostAvatarUrl: bass.avatarUrl,
    title: 'YouTube Vibes',
    platform: 'youtube',
    playbackState: {
      platform: 'youtube',
      trackId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      albumArtUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      isPlaying: true,
      progressMs: 12000,
      updatedAt: Date.now(),
      startedAt: Date.now() - 12000,
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    latitude: parisLat - 0.0005,
    longitude: parisLon - 0.0004,
    blurredLatitude: blurCoordinate(parisLat - 0.0005),
    blurredLongitude: blurCoordinate(parisLon - 0.0004),
    listenersCount: 3,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [bass.id],
    allowQueue: false,
    createdAt: Date.now(),
  };

  db.salons.set(salon1.id, salon1);
  db.salons.set(salon2.id, salon2);
  ensureSalonQueue(salon1.id);
  ensureSalonProposals(salon1.id);
  enqueueItem(salon1.id, {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    trackId: '0VjIjW4GlUZAMYd2vXMi3b',
    externalUrl: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
    addedById: bass.id,
    addedByName: bass.username,
    source: 'proposal',
  });
  db.salonChats.set(salon1.id, [
    {
      id: 'm1',
      roomId: salon1.id,
      roomType: 'salon',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Super session ! 🔥',
      timestamp: Date.now() - 60000,
    },
  ]);
  db.salonChats.set(salon2.id, []);

  const live1: Live = {
    id: salon1.id,
    salonId: salon1.id,
    hostId: dj.id,
    hostName: dj.username,
    title: 'Live DJ Melody',
    platform: 'spotify',
    playbackState: salon1.playbackState,
    latitude: salon1.latitude,
    longitude: salon1.longitude,
    blurredLatitude: salon1.blurredLatitude,
    blurredLongitude: salon1.blurredLongitude,
    viewersCount: 24,
    isActive: true,
    startedAt: Date.now() - 300000,
  };
  db.lives.set(live1.id, live1);
  db.liveChats.set(live1.id, [
    {
      id: 'lm1',
      roomId: live1.id,
      roomType: 'live',
      senderId: bass.id,
      senderName: bass.username,
      content: 'Le drop arrive ! 🔥',
      timestamp: Date.now() - 120000,
    },
    {
      id: 'lm2',
      roomId: live1.id,
      roomType: 'live',
      senderId: listener.id,
      senderName: listener.username,
      content: 'Incroyable ce morceau',
      timestamp: Date.now() - 90000,
    },
  ]);
  db.gifts.push({
    id: 'gift_seed1',
    liveId: live1.id,
    senderId: listener.id,
    senderName: listener.username,
    giftType: 'heart',
    amount: 25,
    timestamp: Date.now() - 60000,
  });

  db.hostRatings.push(
    {
      id: 'rating_seed_dj',
      hostId: dj.id,
      raterId: listener.id,
      stars: 5,
      salonId: salon1.id,
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'rating_seed_bass',
      hostId: bass.id,
      raterId: listener.id,
      stars: 4,
      salonId: salon2.id,
      timestamp: Date.now() - 172800000,
    }
  );

  ensureMapBots(parisLat, parisLon);

  followUser(listener.id, dj.id);
  followUser(listener.id, bass.id);

  // Historique messages privés de démo
  const dmSeed = [
    { from: bass.id, to: listener.id, content: 'Hey ! On écoute quoi ce soir ?', ago: 3600000 },
    { from: listener.id, to: bass.id, content: 'Je suis sur la carte, je te rejoins !', ago: 3500000 },
    { from: dj.id, to: listener.id, content: 'Bienvenue sur MeloSong 🎵', ago: 7200000 },
    { from: listener.id, to: dj.id, content: 'Merci DJ Melody, super live !', ago: 7000000 },
    { from: dj.id, to: listener.id, content: 'Merci d\'être passé, à bientôt sur la carte', ago: 6800000 },
  ];
  for (const d of dmSeed) {
    db.directMessages.push({
      id: `dm_seed_${d.from}_${d.ago}`,
      senderId: d.from,
      receiverId: d.to,
      content: d.content,
      timestamp: Date.now() - d.ago,
      accepted: true,
    });
  }

  console.log('[msdev] Données de démo chargées');
  console.log('[msdev] Connexion: listener@msdev.local / msdev123');
}
