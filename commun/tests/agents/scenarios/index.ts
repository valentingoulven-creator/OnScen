/**
 * scenarios/index.ts — Point d'entrée centralisé de tous les scénarios
 */

import { BaseAgent, AgentPersona } from '../agent';

import { NEW_USER_PERSONAS, createNewUserAgent } from './newUser.scenario';
import { LISTENER_PERSONAS, createListenerAgent } from './listener.scenario';
import { YOUTUBE_HOST_PERSONAS, createYouTubeHostAgent } from './youtubeHost.scenario';
import { LIVE_STREAMER_PERSONAS, createLiveStreamerAgent } from './liveStreamer.scenario';
import { DONOR_PERSONAS, createDonorAgent } from './donor.scenario';
import { POWER_USER_PERSONAS, createPowerUserAgent } from './powerUser.scenario';
import { MODERATOR_PERSONAS, createModeratorAgent } from './moderator.scenario';
import { ADMIN_PERSONAS, createAdminAgent } from './admin.scenario';

export const ALL_PERSONAS: AgentPersona[] = [
  ...NEW_USER_PERSONAS,
  ...LISTENER_PERSONAS,
  ...YOUTUBE_HOST_PERSONAS,
  ...LIVE_STREAMER_PERSONAS,
  ...DONOR_PERSONAS,
  ...POWER_USER_PERSONAS,
  ...MODERATOR_PERSONAS,
  ...ADMIN_PERSONAS,
];

export function createAgent(persona: AgentPersona): BaseAgent {
  switch (persona.role) {
    case 'new_user':
      return createNewUserAgent(persona);
    case 'listener':
      return createListenerAgent(persona);
    case 'youtube_host':
      return createYouTubeHostAgent(persona);
    case 'live_streamer':
      return createLiveStreamerAgent(persona);
    case 'donor':
      return createDonorAgent(persona);
    case 'power_user':
      return createPowerUserAgent(persona);
    case 'moderator':
      return createModeratorAgent(persona);
    case 'admin':
      return createAdminAgent(persona);
    default:
      throw new Error(`Rôle inconnu: ${persona.role}`);
  }
}

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  new_user:      'Agents 1–5  : Nouveaux utilisateurs — inscription, onboarding, exploration',
  listener:      'Agents 6–10 : Auditeurs — salons, chat, reels, feed',
  youtube_host:  'Agents 11–15: Hôtes YouTube — créer salons, playlists, gérer queue',
  live_streamer: 'Agents 16–18: Streamers — démarrer live, chat, fin de session',
  donor:         'Agents 19–21: Donateurs — dons, cadeaux, abonnements créateurs',
  power_user:    'Agents 22–24: Power users — reels, posts, DMs, concurrence',
  moderator:     'Agents 25–26: Modérateurs — signalements, support, conformité',
  admin:         'Agent 27    : Admin — analytics, modération, accès panel',
};

export {
  NEW_USER_PERSONAS,
  LISTENER_PERSONAS,
  YOUTUBE_HOST_PERSONAS,
  LIVE_STREAMER_PERSONAS,
  DONOR_PERSONAS,
  POWER_USER_PERSONAS,
  MODERATOR_PERSONAS,
  ADMIN_PERSONAS,
};
