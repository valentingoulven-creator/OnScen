import type { ChatMessage, Live, User } from '../models/schema';
import { db } from '../models/schema';
import { dicebearAdventurerAvatar } from './avatarUrl';
import { getIo } from './ioInstance';
import { schedulePersist } from './persist';
import type { LiveConnectedParticipant } from './liveParticipants';

/** Live BeatCastel — Castelnau-le-Lez (seed France + démo présentation). */
export const PRESENTATION_LIVE_ID = 'prod-seed-salon-beat-castel';

/** Flux vidéo public fiable pour simuler une diffusion en msdev (Mixkit — chanteur·se). */
export const PRESENTATION_DEMO_HLS =
  'https://assets.mixkit.co/videos/42825/42825-720.mp4';

/** Piste YouTube alignée sur le live démo (lecture salon + métadonnées spectateur). */
export const PRESENTATION_DEMO_PLAYBACK = {
  title: 'bad guy',
  artist: 'Billie Eilish',
  trackId: 'DyDfgMOUOjCI',
} as const;

export const PRESENTATION_DEMO_VIEWERS = 40;

const AUDIENCE_PREFIX = 'pres_demo_castel_';

const AUDIENCE_USERNAMES = [
  'Nina_MTP',
  'RapFan34',
  'LeoCastel',
  'Sonia_H',
  'MaxBeat',
  'InesLive',
  'Khalid_34',
  'JulieSound',
  'TomRim',
  'MaevaB',
  'YassLive',
  'CamilleR',
  'HugoTrap',
  'LinaM',
  'SamirBeat',
  'ClaraHipHop',
  'NoahCastel',
  'EmmaLive',
  'RayanM',
  'ChloeSound',
  'LucasRap',
  'Manon34',
  'AdamLive',
  'ZoeBeat',
  'Mehdi_H',
  'LouRap',
  'PaulMTP',
  'SarahCastel',
  'NicoTrap',
  'LeaLive',
  'KarimB',
  'AnaisSound',
  'TheoRim',
  'JadeH',
  'BilalLive',
  'EvaBeat',
  'Quentin34',
  'MayaCastel',
  'OmarRap',
  'LolaLive',
] as const;

const CHAT_LINES: readonly string[] = [
  'Incroyable ce set à Castelnau ! 🔥',
  'Le flow est monstrueux ce soir',
  'Qui est là depuis le début ? 👋',
  'Castelnau-le-Lez représente 💜',
  'Ce morceau passe en boucle chez moi',
  'Le chat est hyper actif, love',
  'BeatCastel ne déçoit jamais',
  'On sent l’énergie du live 🔥🔥',
  'Montpellier agglo au top',
  'Prochain morceau = ?',
  'Qualité de son au top',
  'Hello la commu Soundy !',
  'Je partage le live à mes potes',
  'L’ambiance est folle',
  'Encore !!!',
  'Merci pour ce live gratuit 🙏',
  'Hip-hop session parfaite',
  'Quelqu’un connaît la setlist ?',
  'Les vibes sont là ce soir',
  'On reste jusqu’à la fin 💪',
  'Salut depuis Castelnau 👋',
  'Ce beat est insane',
  'Qui rappe sur le prochain ?',
  'Soundy live c’est autre chose',
  'J’adore cette commu',
  'Le micro est chaud ce soir 🎤',
  'On est bien là',
  'Respect au host BeatCastel',
  'Trap session de ouf',
  'Première fois sur ce live, top',
  'Le chat bouge bien 🔥',
  'GG pour la qualité vidéo',
  'On envoie des cœurs ❤️',
  'Castelnau en force',
  'Ce refrain me tue',
  'Quelqu’un a le titre ?',
  'Session rap du vendredi parfaite',
  'On lâche rien 💪',
];

/** Messages seedés au boot — historique ~45 min, un message par spectateur au minimum. */
export const PRESENTATION_DEMO_CHAT_SEED_COUNT = 60;

const MAX_PERSISTED_DEMO_CHAT = 200;

export function isPresentationDemoLive(live: Live | undefined): boolean {
  return !!live?.presentationDemoStream;
}

function audienceUserId(index: number): string {
  return `${AUDIENCE_PREFIX}${String(index + 1).padStart(2, '0')}`;
}

export function ensurePresentationDemoAudienceUsers(): number {
  let created = 0;
  const now = Date.now();
  for (let i = 0; i < PRESENTATION_DEMO_VIEWERS; i++) {
    const id = audienceUserId(i);
    if (db.users.has(id)) continue;
    const username = AUDIENCE_USERNAMES[i] ?? `FanCastel${i + 1}`;
    const user: User = {
      id,
      username,
      email: `${id}@bot.melosong.local`,
      passwordHash: 'bot',
      meloCoins: 0,
      isGhostMode: false,
      accountStatus: 'active',
      avatarUrl: dicebearAdventurerAvatar(username),
      latitude: 43.6347 + (i % 5) * 0.0012,
      longitude: 3.8979 + (i % 7) * 0.0011,
      city: 'Castelnau-le-Lez',
      listeningRole: 'auditeur',
      connectedPlatforms: ['youtube'],
      lastSeenAt: now - i * 4_000,
      memberSince: now - 30 * 86_400_000,
    };
    db.users.set(id, user);
    created++;
  }
  return created;
}

export function getPresentationDemoParticipants(
  liveId: string,
  hostId: string,
  vipIds: string[] = []
): LiveConnectedParticipant[] {
  if (liveId !== PRESENTATION_LIVE_ID) return [];
  const vipSet = new Set(vipIds);
  return AUDIENCE_USERNAMES.slice(0, PRESENTATION_DEMO_VIEWERS).map((username, i) => {
    const id = audienceUserId(i);
    const user = db.users.get(id);
    return {
      id,
      username: user?.username ?? username,
      usernameColor: user?.usernameColor,
      isVip: vipSet.has(id),
      isDev: false,
    };
  }).filter((p) => p.id !== hostId);
}

export function buildPresentationDemoChat(liveId: string, messageCount = PRESENTATION_DEMO_CHAT_SEED_COUNT) {
  const now = Date.now();
  const count = Math.max(PRESENTATION_DEMO_VIEWERS, messageCount);
  const messages: ChatMessage[] = [];
  for (let i = 0; i < count; i++) {
    const userIndex = i % PRESENTATION_DEMO_VIEWERS;
    const lineIndex = (i * 7 + userIndex * 3) % CHAT_LINES.length;
    const userId = audienceUserId(userIndex);
    const user = db.users.get(userId);
    const username = user?.username ?? AUDIENCE_USERNAMES[userIndex] ?? `Fan${userIndex + 1}`;
    messages.push({
      id: `pres_chat_${liveId}_${i + 1}`,
      roomId: liveId,
      roomType: 'live',
      senderId: userId,
      senderName: username,
      content: CHAT_LINES[lineIndex] ?? CHAT_LINES[0]!,
      timestamp: now - (count - i) * 28_000 - (i % 4) * 5_500,
    });
  }
  return messages;
}

let demoChatTicker: ReturnType<typeof setInterval> | null = null;
let demoChatLineCursor = PRESENTATION_DEMO_CHAT_SEED_COUNT;

function pickDemoChatLine(): string {
  const line = CHAT_LINES[demoChatLineCursor % CHAT_LINES.length] ?? CHAT_LINES[0]!;
  demoChatLineCursor += 1;
  return line;
}

/** Ajoute un message chat simulé depuis un spectateur présent (bots audience). */
export function pushPresentationDemoChatMessage(
  liveId: string = PRESENTATION_LIVE_ID
): ChatMessage | null {
  const live = db.lives.get(liveId);
  if (!live?.isActive || !live.presentationDemoStream) return null;

  ensurePresentationDemoAudienceUsers();

  const userIndex = Math.floor(Math.random() * PRESENTATION_DEMO_VIEWERS);
  const userId = audienceUserId(userIndex);
  const user = db.users.get(userId);
  const username = user?.username ?? AUDIENCE_USERNAMES[userIndex] ?? `Fan${userIndex + 1}`;

  const msg: ChatMessage = {
    id: `pres_chat_${liveId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    roomId: liveId,
    roomType: 'live',
    senderId: userId,
    senderName: username,
    content: pickDemoChatLine(),
    timestamp: Date.now(),
  };

  const list = db.liveChats.get(liveId) ?? [];
  list.push(msg);
  if (list.length > MAX_PERSISTED_DEMO_CHAT) {
    list.splice(0, list.length - MAX_PERSISTED_DEMO_CHAT);
  }
  db.liveChats.set(liveId, list);
  schedulePersist();
  return msg;
}

/** Émet périodiquement des messages chat depuis les spectateurs simulés (msdev). */
export function startPresentationDemoChatTicker(intervalMs = 10_000): void {
  if (demoChatTicker) return;
  demoChatTicker = setInterval(() => {
    const live = db.lives.get(PRESENTATION_LIVE_ID);
    if (!live?.isActive || !live.presentationDemoStream) return;
    const msg = pushPresentationDemoChatMessage(PRESENTATION_LIVE_ID);
    if (!msg) return;
    getIo()?.to(`live_${PRESENTATION_LIVE_ID}`).emit('live_message', msg);
  }, intervalMs);
  demoChatTicker.unref?.();
}

export function stopPresentationDemoChatTicker(): void {
  if (!demoChatTicker) return;
  clearInterval(demoChatTicker);
  demoChatTicker = null;
}
