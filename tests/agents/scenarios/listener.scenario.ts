/**
 * listener.scenario.ts — Agents 6–10 : Auditeurs passifs
 *
 * Simule des utilisateurs qui rejoignent des salons, écoutent,
 * participent au chat, likent des reels, browsent le feed.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class ListenerAgent extends BaseAgent {
  private currentSalonId: string | null = null;
  private timeInSalon = 0;
  private maxTimeInSalon = randomInt(3, 20) * 60 * 1000; // 3–20 min par salon

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    // Comportement principal : passer du temps dans des salons
    if (this.currentSalonId && this.timeInSalon < this.maxTimeInSalon) {
      await this.actInSalon();
    } else {
      // Quitter le salon courant et en chercher un nouveau
      if (this.currentSalonId) {
        await this.leaveCurrentSalon();
      }
      await this.findAndJoinSalon();
    }
  }

  // ── Actions dans un salon ───────────────────────────────────────────────────

  private async actInSalon(): Promise<void> {
    const action = Math.random();
    if (action < 0.3) {
      await this.sendMessage();
    } else if (action < 0.5) {
      await this.viewChatHistory();
    } else if (action < 0.7) {
      await this.viewSalonDetails();
    } else if (action < 0.85) {
      await this.likeReel();
    } else {
      await this.browseFeed();
    }
    this.timeInSalon += randomInt(5, 15) * 1000;
  }

  private async sendMessage(): Promise<void> {
    if (!this.currentSalonId) return;
    const msg = randomItem(CONFIG.CHAT_MESSAGES);
    this.sendChatMessage(this.currentSalonId, msg);
    this.log('debug', `Message envoyé dans salon ${this.currentSalonId}`);
  }

  private async viewChatHistory(): Promise<void> {
    if (!this.currentSalonId) return;
    await this.get(`/api/chat/${this.currentSalonId}`, 'Historique chat');
  }

  private async viewSalonDetails(): Promise<void> {
    if (!this.currentSalonId) return;
    await this.get(`/api/salons/${this.currentSalonId}`, 'Détail salon courant');
  }

  private async likeReel(): Promise<void> {
    const reelId = this.pickRandom(BaseAgent.sharedReelIds);
    if (!reelId) {
      // Pas encore de reels partagés, browse le feed reels
      const result = await this.get('/api/reels', 'Feed reels');
      if (result.success) {
        const reels = (result.data as { reels?: Array<{ id: string }> })?.reels ?? [];
        if (reels.length > 0) {
          BaseAgent.sharedReelIds.push(...reels.slice(0, 5).map((r) => r.id));
        }
      }
      return;
    }
    await this.post(`/api/reels/${reelId}/heart`, {}, 'Like reel');

    // Parfois, commenter aussi
    if (Math.random() > 0.7) {
      await this.post(`/api/reels/${reelId}/comments`, {
        content: randomItem(CONFIG.CHAT_MESSAGES),
      }, 'Commenter reel');
    }
  }

  private async browseFeed(): Promise<void> {
    const result = await this.get('/api/feed', 'Feed principal');
    if (result.success) {
      const posts = (result.data as { posts?: Array<{ id: string }> })?.posts ?? [];
      if (posts.length > 0) {
        // Like un post aléatoire
        const post = randomItem(posts);
        if (Math.random() > 0.5) {
          await this.post(`/api/feed/${post.id}/like`, {}, 'Like post feed');
        }
      }
    }
  }

  // ── Navigation entre salons ─────────────────────────────────────────────────

  private async leaveCurrentSalon(): Promise<void> {
    if (!this.currentSalonId) return;
    this.leaveSalon(this.currentSalonId);
    this.log('info', `Quitté salon: ${this.currentSalonId}`);
    this.currentSalonId = null;
    this.timeInSalon = 0;
    this.maxTimeInSalon = randomInt(3, 20) * 60 * 1000;
  }

  private async findAndJoinSalon(): Promise<void> {
    // Priorité : salons connus des autres agents
    let targetSalonId = this.pickRandomSharedSalon();

    if (!targetSalonId) {
      // Sinon, cherche sur l'API
      const result = await this.get('/api/salons', 'Chercher salon', {
        latitude: CONFIG.DEFAULT_LAT + (Math.random() - 0.5) * 0.05,
        longitude: CONFIG.DEFAULT_LON + (Math.random() - 0.5) * 0.05,
      });

      if (result.success) {
        const salons = (result.data as { salons?: Array<{ id: string }> })?.salons ?? [];
        if (salons.length > 0) {
          targetSalonId = randomItem(salons).id;
          if (!BaseAgent.sharedSalonIds.includes(targetSalonId)) {
            BaseAgent.sharedSalonIds.push(targetSalonId);
          }
        }
      }
    }

    if (targetSalonId) {
      this.currentSalonId = targetSalonId;
      this.joinSalon(targetSalonId);

      // Vérification qu'on peut rejoindre (accès)
      await this.get(`/api/salons/${targetSalonId}`, 'Rejoindre salon');
      await this.delay(1000, 3000);
      await this.viewChatHistory();
      this.log('info', `Rejoint salon: ${targetSalonId}`);
    } else {
      // Pas de salon, explorer le feed en attendant
      await this.browseFeed();
      await this.exploreLives();
      await this.delay(5000, 15000);
    }
  }

  private async exploreLives(): Promise<void> {
    const result = await this.get('/api/lives', 'Explorer lives', {
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    });
    if (result.success) {
      const lives = (result.data as { lives?: Array<{ id: string }> })?.lives ?? [];
      if (lives.length > 0 && !BaseAgent.sharedLiveIds.includes(lives[0].id)) {
        BaseAgent.sharedLiveIds.push(lives[0].id);
      }
    }
  }
}

// ── Personas Agents 6–10 ──────────────────────────────────────────────────────

export const LISTENER_PERSONAS: AgentPersona[] = [
  buildPersona(6, 'listener', 'Hugo Lefebvre', 'Auditeur passionné de jazz, reste longtemps dans les salons'),
  buildPersona(7, 'listener', 'Manon Dupont', 'Écoute en fond sonore pendant le travail, peu active'),
  buildPersona(8, 'listener', 'Nathan Moreau', 'Sauteur de salons — essaie plusieurs en peu de temps'),
  buildPersona(9, 'listener', 'Léa Fournier', 'Très active en chat, commente tout ce qu\'elle écoute'),
  buildPersona(10, 'listener', 'Maxime Simon', 'Auditeur nocturne — sessions longues et silencieuses'),
];

export function createListenerAgent(persona: AgentPersona): ListenerAgent {
  return new ListenerAgent(persona);
}
