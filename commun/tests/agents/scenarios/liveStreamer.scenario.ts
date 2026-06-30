/**
 * liveStreamer.scenario.ts — Agents 19–21 : Streamers Live
 *
 * Simule des utilisateurs qui démarrent un live (WebRTC/LiveKit/Cloudflare),
 * animent le chat pendant la session, et terminent le live.
 * Note : la vidéo réelle n'est pas transmise (mock), on teste uniquement l'API.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class LiveStreamerAgent extends BaseAgent {
  private liveId: string | null = null;
  private liveStartTime: number | null = null;
  private maxLiveDurationMs = randomInt(5, 20) * 60 * 1000; // 5–20 min
  private isLive = false;
  private cycleCount = 0;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    if (!this.isLive) {
      await this.startLiveCycle();
    } else if (this.liveStartTime && Date.now() - this.liveStartTime > this.maxLiveDurationMs) {
      await this.endLive();
    } else {
      await this.liveHostAction();
    }
  }

  // ── Cycle Live ──────────────────────────────────────────────────────────────

  private async startLiveCycle(): Promise<void> {
    // Vérification des prérequis
    await this.checkLiveEligibility();
    await this.delay(2000, 5000);

    // Tentative de démarrage live
    const started = await this.startLive();
    if (!started) {
      // En cas d'échec, attendre et réessayer plus tard
      await this.exploreLivesFeed();
      await this.delay(30000, 60000);
    }
  }

  private async checkLiveEligibility(): Promise<void> {
    // Vérifie les ICE servers (sans liveId d'abord — attendu: 400)
    await this.get('/api/lives/ice-servers', 'ICE servers (sans liveId)');

    // Vérifie le profil pour les conditions d'éligibilité
    await this.get('/api/auth/profile/me', 'Profil pour éligibilité live');

    // Check LiveKit disponibilité
    await this.get('/api/lives', 'Lives actifs (pré-check)', {
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    });
  }

  private async startLive(): Promise<boolean> {
    const liveData = {
      title: `Live Test ${this.persona.name} — ${new Date().toLocaleTimeString()}`,
      description: 'Session live automatisée — tests QA Soundy',
      isPublic: true,
      latitude: CONFIG.DEFAULT_LAT + (Math.random() - 0.5) * 0.02,
      longitude: CONFIG.DEFAULT_LON + (Math.random() - 0.5) * 0.02,
      location: 'Paris, France',
      streamMode: 'livekit',
    };

    const result = await this.post('/api/lives', liveData, 'Démarrer un live');

    if (result.success && result.data) {
      const live = result.data as { id?: string; live?: { id: string }; liveKitToken?: string };
      this.liveId = live.id ?? live.live?.id ?? null;

      if (this.liveId) {
        this.isLive = true;
        this.liveStartTime = Date.now();
        this.joinLive(this.liveId);

        // Partage le liveId
        if (!BaseAgent.sharedLiveIds.includes(this.liveId)) {
          BaseAgent.sharedLiveIds.push(this.liveId);
        }

        this.log('info', `Live démarré: ${this.liveId} (durée max: ${Math.round(this.maxLiveDurationMs / 60000)} min)`);

        // Note: le token LiveKit est reçu mais on ne l'utilise pas (pas de vrai WebRTC)
        if (live.liveKitToken) {
          this.log('debug', 'Token LiveKit reçu (non utilisé en mode mock)');
        }

        return true;
      }
    }

    this.log('warn', `Impossible de démarrer le live (status: ${result.status})`);
    return false;
  }

  // ── Actions pendant le live ─────────────────────────────────────────────────

  private async liveHostAction(): Promise<void> {
    const action = Math.random();

    if (action < 0.3) {
      await this.sendLiveChat();
    } else if (action < 0.5) {
      await this.viewLiveChat();
    } else if (action < 0.65) {
      await this.viewLiveDetails();
    } else if (action < 0.75) {
      await this.viewLiveViewers();
    } else if (action < 0.82) {
      await this.checkLiveStats();
    } else if (action < 0.89) {
      await this.getIceServers();
    } else if (action < 0.95) {
      await this.viewGiftsReceived();
    } else {
      await this.testRapidChat();
    }
  }

  private async sendLiveChat(): Promise<void> {
    if (!this.liveId) return;
    const msgs = [
      '🎙️ Bienvenue sur mon live !',
      'Merci d\'être là !',
      'Questions ? Je réponds !',
      'Live de test — tout va bien',
      '🎵 On continue !',
      `Viewers présents — ${randomInt(1, 50)} personnes 🔥`,
    ];
    this.sendChatMessage(this.liveId, randomItem(msgs));
    await this.delay(1000, 5000);
  }

  private async viewLiveChat(): Promise<void> {
    if (!this.liveId) return;
    await this.get(`/api/chat/live/${this.liveId}`, 'Chat live (historique)');
  }

  private async viewLiveDetails(): Promise<void> {
    if (!this.liveId) return;
    await this.get(`/api/lives/${this.liveId}`, 'Détail live courant');
  }

  private async viewLiveViewers(): Promise<void> {
    if (!this.liveId) return;
    await this.get(`/api/lives/${this.liveId}/participants`, 'Viewers du live');
  }

  private async checkLiveStats(): Promise<void> {
    if (!this.liveId) return;
    await this.get('/api/analytics', 'Analytics live', { context: 'live', id: this.liveId });
  }

  private async getIceServers(): Promise<void> {
    if (!this.liveId) return;
    await this.get('/api/lives/ice-servers', 'ICE servers WebRTC', { liveId: this.liveId });
  }

  private async viewGiftsReceived(): Promise<void> {
    if (!this.liveId) return;
    await this.get(`/api/gifts/live/${this.liveId}`, 'Cadeaux reçus');
  }

  private async testRapidChat(): Promise<void> {
    if (!this.liveId) return;
    // Simule un burst de messages (doit être rate-limité côté serveur)
    for (let i = 0; i < 3; i++) {
      this.sendChatMessage(this.liveId, `Burst test message ${i + 1} 🚀`);
      await this.delay(200, 500);
    }
  }

  // ── Fin du live ─────────────────────────────────────────────────────────────

  private async endLive(): Promise<void> {
    if (!this.liveId) return;

    this.log('info', `Fin du live: ${this.liveId}`);
    this.leaveLive(this.liveId);

    await this.delete(`/api/lives/${this.liveId}`, 'Terminer le live');

    // Nouveau cycle après pause
    this.isLive = false;
    this.liveId = null;
    this.liveStartTime = null;
    this.cycleCount++;
    this.maxLiveDurationMs = randomInt(5, 20) * 60 * 1000;

    // Pause entre deux lives
    await this.delay(2 * 60 * 1000, 10 * 60 * 1000);
  }

  // ── Exploration (hors live) ─────────────────────────────────────────────────

  private async exploreLivesFeed(): Promise<void> {
    const result = await this.get('/api/lives', 'Explorer les lives', {
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    });

    if (result.success) {
      const lives = (result.data as { lives?: Array<{ id: string }> })?.lives ?? [];

      // Regarder un live existant si disponible
      if (lives.length > 0) {
        const targetLive = randomItem(lives);
        this.joinLive(targetLive.id);
        await this.get(`/api/lives/${targetLive.id}`, 'Voir live en tant que viewer');
        await this.delay(10000, 30000);
        this.leaveLive(targetLive.id);
      }
    }
  }
}

// ── Personas Agents 19–21 ─────────────────────────────────────────────────────

export const LIVE_STREAMER_PERSONAS: AgentPersona[] = [
  buildPersona(19, 'live_streamer', 'Tristan Faure', 'Streamer gaming/musique — sessions longues'),
  buildPersona(20, 'live_streamer', 'Eva Chevalier', 'Streameuse talk/réactions — très actif en chat'),
  buildPersona(21, 'live_streamer', 'Clément Aubert', 'Live DJ — mixe et interagit avec les viewers'),
];

export function createLiveStreamerAgent(persona: AgentPersona): LiveStreamerAgent {
  return new LiveStreamerAgent(persona);
}
