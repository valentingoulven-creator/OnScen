/**
 * Seed données de test production (PostgreSQL).
 * Usage sur le VPS :
 *   cd /opt/soundy && APP_ENV=production node dist/scripts/seed-production-testdata.js
 *
 * Variables optionnelles :
 *   SEED_TARGET_EMAIL — email du compte cible (défaut : admin@getsoundy.com)
 *   SEED_TARGET_USERNAME — pseudo alternatif (défaut : Val)
 */
import dotenv from 'dotenv';
import path from 'path';
import { db, type FeedPost, type User } from '../models/schema';
import { loadPersistedStoreAsync, usesPostgresPersistence } from '../lib/persist';
import { savePersistedStoreToPostgres } from '../lib/pgStore';
import { followUser } from '../lib/follows';
import { recordHeart } from '../lib/matches';
import {
  notifyContentHeartReceived,
  notifyFollowReceived,
  notifyHeartReceived,
} from '../lib/notifications';
import { refreshUserPublicCoords } from '../lib/locationPrivacy';
import { closePool } from '../db/pool';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const ID_PREFIX = 'prod-seed-';

/** Le Crès (Hérault) — zone utilisateur Val. */
const LE_CRES = { lat: 43.6489, lon: 3.9394, label: 'Le Crès, France' };

const FOLLOWER_USERNAMES = [
  'soundy_user1',
  'soundy_user2',
  'soundy_user3',
  'soundy_user4',
  'soundy_user5',
] as const;

interface EventSeed {
  id: string;
  authorUsername: string;
  content: string;
  eventDate: string;
  eventLocation: string;
  eventType: 'dance' | 'chant' | 'autre';
  imageUrl?: string;
}

const EVENT_SEEDS: EventSeed[] = [
  {
    id: `${ID_PREFIX}evt-cres-open-mic`,
    authorUsername: 'soundy_user1',
    content: 'Open mic acoustique ce vendredi — bring your instrument ! 🎤',
    eventDate: '2026-06-12T19:00:00.000Z',
    eventLocation: 'Salle des fêtes, Le Crès, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
  {
    id: `${ID_PREFIX}evt-cres-dj-terrasse`,
    authorUsername: 'soundy_user2',
    content: 'Soirée DJ terrasse — house & french touch autour du Crès 🎧',
    eventDate: '2026-06-14T20:30:00.000Z',
    eventLocation: 'Bar Le Patio, Le Crès, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  },
  {
    id: `${ID_PREFIX}evt-montpellier-rockstore`,
    authorUsername: 'soundy_user3',
    content: 'Concert indie au Rockstore — entrée libre avant 21h 🎸',
    eventDate: '2026-06-15T18:00:00.000Z',
    eventLocation: 'Le Rockstore, Montpellier, France',
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  },
  {
    id: `${ID_PREFIX}evt-paris-olympia`,
    authorUsername: 'soundy_user4',
    content: 'Session live soul à l\'Olympia — places limitées 🎷',
    eventDate: '2026-06-18T20:00:00.000Z',
    eventLocation: "L'Olympia, Paris, France",
    eventType: 'chant',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
  },
  {
    id: `${ID_PREFIX}evt-lyon-nuits-sonores`,
    authorUsername: 'soundy_user5',
    content: 'Nuits sonores pop-up — techno & ambient au traboule 🌙',
    eventDate: '2026-06-20T21:00:00.000Z',
    eventLocation: 'Traboule Café, Lyon, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}evt-marseille-jam`,
    authorUsername: 'keval',
    content: 'Jam session hip-hop sur le Vieux-Port — micro ouvert 🔥',
    eventDate: '2026-06-22T17:30:00.000Z',
    eventLocation: 'Vieux-Port, Marseille, France',
    eventType: 'autre',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}evt-bordeaux-club`,
    authorUsername: 'Val',
    content: 'Club night électro — set 3h non-stop 💃',
    eventDate: '2026-06-25T23:00:00.000Z',
    eventLocation: 'Darwin, Bordeaux, France',
    eventType: 'dance',
    imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600',
  },
];

const POST_SEEDS: Array<{
  id: string;
  authorUsername: string;
  content: string;
  imageUrl?: string;
}> = [
  {
    id: `${ID_PREFIX}post-1`,
    authorUsername: 'soundy_user1',
    content: 'Qui écoute du jazz ce soir ? 🎷',
  },
  {
    id: `${ID_PREFIX}post-2`,
    authorUsername: 'soundy_user2',
    content: 'Mon salon YouTube est ouvert — venez !',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
  {
    id: `${ID_PREFIX}post-3`,
    authorUsername: 'keval',
    content: 'Découverte du jour : ce morceau est incroyable 🎶',
  },
  {
    id: `${ID_PREFIX}post-4`,
    authorUsername: 'soundy_user3',
    content: 'Ambiance lo-fi parfaite pour travailler ce matin ☕🎧',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}post-5`,
    authorUsername: 'soundy_user4',
    content: 'La carte est animée, plein de lives autour de moi 🗺️',
  },
  {
    id: `${ID_PREFIX}post-6`,
    authorUsername: 'soundy_user5',
    content: 'Soundy + weekend + bonne humeur = combo parfait ☀️🎵',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
  },
  {
    id: `${ID_PREFIX}post-val-1`,
    authorUsername: 'Val',
    content: 'Première publication depuis Le Crès — la scène locale est top ! 🎵',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
  },
];

function findUserByUsername(username: string): User | undefined {
  return [...db.users.values()].find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
}

function findTargetUser(): User {
  const email = process.env.SEED_TARGET_EMAIL?.trim().toLowerCase();
  const username = process.env.SEED_TARGET_USERNAME?.trim();

  if (email) {
    const byEmail = [...db.users.values()].find((u) => u.email.toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (username) {
    const byName = findUserByUsername(username);
    if (byName) return byName;
  }

  const val = findUserByUsername('Val');
  if (val) return val;

  const keval = findUserByUsername('keval');
  if (keval) return keval;

  throw new Error('Utilisateur cible introuvable (Val / keval)');
}

function ensureTargetProfile(target: User): void {
  let changed = false;
  if (target.city?.toLowerCase().includes('cr')) {
    target.latitude = LE_CRES.lat;
    target.longitude = LE_CRES.lon;
    refreshUserPublicCoords(target);
    changed = true;
  }
  if (target.relationshipStatus !== 'celibataire') {
    target.relationshipStatus = 'celibataire';
    changed = true;
  }
  if (typeof target.age !== 'number' || target.age < 18) {
    target.age = 28;
    changed = true;
  }
  if (changed) db.users.set(target.id, target);
}

function upsertPost(post: FeedPost): boolean {
  if (db.feedPosts.some((p) => p.id === post.id)) return false;
  db.feedPosts.push(post);
  return true;
}

async function main(): Promise<void> {
  if (!usesPostgresPersistence()) {
    throw new Error('DATABASE_URL requis — seed production PostgreSQL uniquement');
  }

  const restored = await loadPersistedStoreAsync();
  if (!restored) throw new Error('Impossible de charger le store PostgreSQL');

  const target = findTargetUser();
  ensureTargetProfile(target);

  const now = Date.now();
  const summary = {
    target: { id: target.id, username: target.username, email: target.email },
    followersAdded: [] as string[],
    eventsCreated: 0,
    postsCreated: 0,
    hearts: [] as string[],
  };

  // ── 5 abonnés (follow) ──
  for (const uname of FOLLOWER_USERNAMES) {
    const follower = findUserByUsername(uname);
    if (!follower) {
      console.warn(`[seed] Follower ${uname} introuvable — ignoré`);
      continue;
    }
    const already = db.userFollows.get(follower.id)?.has(target.id);
    if (!already) {
      followUser(follower.id, target.id);
      notifyFollowReceived({
        recipientId: target.id,
        sender: { id: follower.id, username: follower.username, avatarUrl: follower.avatarUrl },
      });
      summary.followersAdded.push(follower.username);
    }
  }

  // ── Publications + événements ──
  let ageOffset = 0;
  for (const seed of POST_SEEDS) {
    const author = findUserByUsername(seed.authorUsername);
    if (!author) continue;
    const post: FeedPost = {
      id: seed.id,
      userId: author.id,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      createdAt: now - ageOffset * 900_000,
    };
    if (upsertPost(post)) {
      summary.postsCreated++;
      ageOffset++;
    }
  }

  for (const seed of EVENT_SEEDS) {
    const author = findUserByUsername(seed.authorUsername);
    if (!author) continue;
    const post: FeedPost = {
      id: seed.id,
      userId: author.id,
      content: seed.content,
      ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
      isEvent: true,
      eventDate: seed.eventDate,
      eventLocation: seed.eventLocation,
      eventType: seed.eventType,
      createdAt: now - ageOffset * 900_000,
    };
    if (upsertPost(post)) {
      summary.eventsCreated++;
      ageOffset++;
    }
  }

  // ── 2 cœurs ──
  const valPost = db.feedPosts.find((p) => p.id === `${ID_PREFIX}post-val-1`);
  const heartSender1 = findUserByUsername('soundy_user1');
  const heartSender2 = findUserByUsername('keval');

  if (heartSender1 && !db.heartEvents.some((h) => h.fromId === heartSender1.id && h.toId === target.id)) {
    recordHeart(heartSender1.id, target.id);
    notifyHeartReceived({
      recipientId: target.id,
      sender: {
        id: heartSender1.id,
        username: heartSender1.username,
        avatarUrl: heartSender1.avatarUrl,
      },
    });
    summary.hearts.push(`cœur profil : ${heartSender1.username} → ${target.username}`);
  }

  if (heartSender2 && valPost && !db.feedPostLikes.get(valPost.id)?.has(heartSender2.id)) {
    const likers = db.feedPostLikes.get(valPost.id) ?? new Set<string>();
    likers.add(heartSender2.id);
    db.feedPostLikes.set(valPost.id, likers);
    notifyContentHeartReceived({
      recipientId: target.id,
      sender: {
        id: heartSender2.id,
        username: heartSender2.username,
        avatarUrl: heartSender2.avatarUrl,
      },
      target: { kind: 'post', id: valPost.id },
    });
    summary.hearts.push(`like publication : ${heartSender2.username} → post de ${target.username}`);
  }

  await savePersistedStoreToPostgres();

  console.log('\n=== SEED PRODUCTION TERMINÉ ===\n');
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('[seed] Échec:', err);
    process.exit(1);
  })
  .finally(() => closePool());
