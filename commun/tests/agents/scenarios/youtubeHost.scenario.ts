/**
 * youtubeHost.scenario.ts — Agents 11–15 : Hôtes YouTube
 *
 * Simule des utilisateurs qui créent des salons YouTube,
 * gèrent une playlist, gèrent les propositions de pistes.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class YouTubeHostAgent extends BaseAgent {
  private salonId: string | null = null;
  private hasCreatedSalon = false;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    if (!this.hasCreatedSalon || !this.salonId) {
      await this.createYouTubeSalon();
    } else {
      await this.hostingAction();
    }
  }

  // ── Création de salon ───────────────────────────────────────────────────────

  private async createYouTubeSalon(): Promise<void> {
    const salonData = {
      name: `Salon YT ${this.persona.name} #${randomInt(1, 999)}`,
      description: 'Salon de test automatisé — YouTube playlist',
      platform: 'youtube',
      isPublic: true,
      latitude: CONFIG.DEFAULT_LAT + (Math.random() - 0.5) * 0.05,
      longitude: CONFIG.DEFAULT_LON + (Math.random() - 0.5) * 0.05,
      location: 'Paris, France',
      maxParticipants: 50,
    };

    const result = await this.post('/api/salons', salonData, 'Créer salon YouTube');

    if (result.success && result.data) {
      const salon = result.data as { id?: string; salon?: { id: string } };
      this.salonId = salon.id ?? salon.salon?.id ?? null;

      if (this.salonId) {
        this.hasCreatedSalon = true;
        this.joinSalon(this.salonId);

        // Partage le salonId pour les autres agents
        if (!BaseAgent.sharedSalonIds.includes(this.salonId)) {
          BaseAgent.sharedSalonIds.push(this.salonId);
        }

        this.log('info', `Salon YouTube créé: ${this.salonId}`);

        // Lance la première musique
        await this.delay(1000, 3000);
        await this.playInitialTrack();
      }
    }
  }

  // ── Actions d'hôte ─────────────────────────────────────────────────────────

  private async hostingAction(): Promise<void> {
    const action = Math.random();

    if (action < 0.2) {
      await this.searchYouTube();
    } else if (action < 0.35) {
      await this.addToQueue();
    } else if (action < 0.5) {
      await this.skipTrack();
    } else if (action < 0.6) {
      await this.viewQueue();
    } else if (action < 0.7) {
      await this.loadYouTubePlaylist();
    } else if (action < 0.8) {
      await this.viewProposals();
    } else if (action < 0.88) {
      await this.sendChatHostMessage();
    } else if (action < 0.93) {
      await this.updateSalonSettings();
    } else if (action < 0.96) {
      await this.viewSalonParticipants();
    } else {
      await this.reorderQueue();
    }
  }

  private async playInitialTrack(): Promise<void> {
    if (!this.salonId) return;
    const trackId = randomItem(CONFIG.YOUTUBE_TRACK_IDS);
    await this.post(`/api/salons/${this.salonId}/playback/play`, {
      trackId,
      platform: 'youtube',
      title: 'Track de test',
      artist: 'Agent YouTube',
    }, 'Lancer premier morceau');
  }

  private async searchYouTube(): Promise<void> {
    if (!this.salonId) return;
    const query = randomItem(CONFIG.YOUTUBE_SEARCH_QUERIES);
    const result = await this.get(
      `/api/salons/${this.salonId}/search/youtube`,
      'Recherche YouTube',
      { q: query }
    );

    if (result.success) {
      const tracks = (result.data as { results?: Array<{ videoId: string; title: string }> })?.results ?? [];
      if (tracks.length > 0) {
        this.log('debug', `YouTube: ${tracks.length} résultats pour "${query}"`);
      }
    }
  }

  private async addToQueue(): Promise<void> {
    if (!this.salonId) return;
    const trackId = randomItem(CONFIG.YOUTUBE_TRACK_IDS);
    await this.post(`/api/salons/${this.salonId}/queue`, {
      trackId,
      platform: 'youtube',
      title: `Test track ${trackId.slice(0, 8)}`,
      artist: 'Agent Test',
      duration: randomInt(180, 360),
    }, 'Ajouter à la file');
  }

  private async skipTrack(): Promise<void> {
    if (!this.salonId) return;
    await this.post(`/api/salons/${this.salonId}/playback/skip`, {}, 'Passer au suivant');
  }

  private async viewQueue(): Promise<void> {
    if (!this.salonId) return;
    await this.get(`/api/salons/${this.salonId}/queue`, 'Voir file de lecture');
  }

  private async loadYouTubePlaylist(): Promise<void> {
    if (!this.salonId) return;
    // Playlist publique de test
    const playlistId = 'PLfM3_4VuoC-w2C6sDAtf8bVSmhCvznnfM';
    await this.post(`/api/salons/${this.salonId}/queue/youtube-playlist`, {
      playlistId,
    }, 'Charger playlist YouTube');
  }

  private async viewProposals(): Promise<void> {
    if (!this.salonId) return;
    const result = await this.get(`/api/salons/${this.salonId}/proposals`, 'Voir propositions');
    if (result.success) {
      const proposals = (result.data as { proposals?: Array<{ id: string }> })?.proposals ?? [];
      // Accepte ou refuse aléatoirement la première proposition
      if (proposals.length > 0) {
        const action = Math.random() > 0.5 ? 'accept' : 'reject';
        await this.post(
          `/api/salons/${this.salonId}/proposals/${proposals[0].id}/${action}`,
          {},
          `${action === 'accept' ? 'Accepter' : 'Refuser'} proposition`
        );
      }
    }
  }

  private async sendChatHostMessage(): Promise<void> {
    if (!this.salonId) return;
    const hostMessages = [
      '🎵 Nouveau morceau dans 2 min !',
      'Proposez vos titres préférés !',
      'Ambiance au top ce soir 🔥',
      'Prochain genre : rock progressif',
      'Merci à tous pour votre présence !',
    ];
    this.sendChatMessage(this.salonId, randomItem(hostMessages));
  }

  private async updateSalonSettings(): Promise<void> {
    if (!this.salonId) return;
    await this.put(`/api/salons/${this.salonId}`, {
      description: `Mise à jour ${new Date().toLocaleTimeString()} — session test`,
    }, 'Mettre à jour salon');
  }

  private async viewSalonParticipants(): Promise<void> {
    if (!this.salonId) return;
    await this.get(`/api/salons/${this.salonId}/participants`, 'Voir participants');
  }

  private async reorderQueue(): Promise<void> {
    if (!this.salonId) return;
    const queueResult = await this.get(`/api/salons/${this.salonId}/queue`, 'Queue pour réordonnancement');
    if (queueResult.success) {
      const queue = (queueResult.data as { queue?: Array<{ id: string }> })?.queue ?? [];
      if (queue.length >= 2) {
        await this.put(`/api/salons/${this.salonId}/queue/reorder`, {
          itemIds: queue.map((i) => i.id).reverse(),
        }, 'Réordonner file');
      }
    }
  }
}

// ── Personas Agents 11–15 ─────────────────────────────────────────────────────

export const YOUTUBE_HOST_PERSONAS: AgentPersona[] = [
  buildPersona(11, 'youtube_host', 'Jules Fontaine', 'DJ amateur, salons lofi et jazz YouTube'),
  buildPersona(12, 'youtube_host', 'Sarah Leblanc', 'Hôte de salons pop et chanson française'),
  buildPersona(13, 'youtube_host', 'Antoine Girard', 'Curate de playlists rock et metal'),
  buildPersona(14, 'youtube_host', 'Camille Mercier', 'Salons musique classique et instrumental'),
  buildPersona(15, 'youtube_host', 'Romain Lefèvre', 'Salons éclectiques — tous genres'),
];

export function createYouTubeHostAgent(persona: AgentPersona): YouTubeHostAgent {
  return new YouTubeHostAgent(persona);
}
