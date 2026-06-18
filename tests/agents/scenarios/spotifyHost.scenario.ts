/**
 * spotifyHost.scenario.ts — Agents 16–18 : Hôtes Spotify
 *
 * Simule des hôtes qui créent des salons Spotify.
 * Note : sans token Spotify réel, la plupart des actions retourneront 403
 * (HOST_PLATFORM_NOT_LINKED). C'est intentionnel — on teste l'UX d'erreur.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class SpotifyHostAgent extends BaseAgent {
  private salonId: string | null = null;
  private hasCreatedSalon = false;
  private linkAttempts = 0;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    if (!this.hasCreatedSalon) {
      await this.setupSpotifySalon();
    } else {
      await this.spotifyHostAction();
    }
  }

  // ── Mise en place ───────────────────────────────────────────────────────────

  private async setupSpotifySalon(): Promise<void> {
    // 1. Vérifier si la plateforme Spotify est configurée
    await this.get('/api/platforms', 'Vérifier plateformes liées');

    // 2. Tenter de créer un salon Spotify (attendu: 403 si pas de compte Spotify lié)
    const salonData = {
      name: `Salon Spotify ${this.persona.name}`,
      description: 'Salon Spotify test — synchronisation lecture',
      platform: 'spotify',
      isPublic: true,
      latitude: CONFIG.DEFAULT_LAT + (Math.random() - 0.5) * 0.05,
      longitude: CONFIG.DEFAULT_LON + (Math.random() - 0.5) * 0.05,
      location: 'Paris, France',
    };

    const result = await this.post('/api/salons', salonData, 'Créer salon Spotify');

    if (result.success && result.data) {
      const salon = result.data as { id?: string; salon?: { id: string } };
      this.salonId = salon.id ?? salon.salon?.id ?? null;
      if (this.salonId) {
        this.hasCreatedSalon = true;
        this.joinSalon(this.salonId);
        if (!BaseAgent.sharedSalonIds.includes(this.salonId)) {
          BaseAgent.sharedSalonIds.push(this.salonId);
        }
        this.log('info', `Salon Spotify créé: ${this.salonId}`);
      }
    } else if (result.status === 403) {
      // Comportement attendu : Spotify pas lié
      this.log('info', 'Spotify non lié — salon YouTube de fallback créé');
      await this.createFallbackYouTubeSalon();
    }

    this.hasCreatedSalon = true; // évite boucle infinie
  }

  private async createFallbackYouTubeSalon(): Promise<void> {
    const result = await this.post('/api/salons', {
      name: `Salon Mix ${this.persona.name}`,
      description: 'Salon fallback (Spotify non configuré)',
      platform: 'youtube',
      isPublic: true,
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    }, 'Créer salon YouTube (fallback Spotify)');

    if (result.success) {
      const salon = result.data as { id?: string; salon?: { id: string } };
      this.salonId = salon.id ?? salon.salon?.id ?? null;
      if (this.salonId && !BaseAgent.sharedSalonIds.includes(this.salonId)) {
        BaseAgent.sharedSalonIds.push(this.salonId);
      }
    }
  }

  // ── Actions Spotify (avec gestion des erreurs 403) ─────────────────────────

  private async spotifyHostAction(): Promise<void> {
    const action = Math.random();

    if (action < 0.15) {
      await this.checkNowPlaying();
    } else if (action < 0.3) {
      await this.searchSpotify();
    } else if (action < 0.45) {
      await this.syncSpotifyPlayback();
    } else if (action < 0.55) {
      await this.controlPlayback();
    } else if (action < 0.65) {
      await this.viewQueue();
    } else if (action < 0.75) {
      await this.loadSpotifyPlaylist();
    } else if (action < 0.85) {
      await this.sendHostChat();
    } else if (action < 0.92) {
      await this.testSpotifyJamLink();
    } else {
      await this.checkPlatformStatus();
    }
  }

  private async checkNowPlaying(): Promise<void> {
    if (!this.salonId) return;
    await this.get(`/api/salons/${this.salonId}/spotify/now-playing`, 'Spotify: lecture en cours');
  }

  private async searchSpotify(): Promise<void> {
    if (!this.salonId) return;
    const queries = ['daft punk', 'stromae', 'angèle', 'david bowie', 'arctic monkeys'];
    await this.get(
      `/api/salons/${this.salonId}/search/spotify`,
      'Recherche Spotify',
      { q: randomItem(queries), limit: 10 }
    );
  }

  private async syncSpotifyPlayback(): Promise<void> {
    if (!this.salonId) return;
    const trackId = randomItem(CONFIG.SPOTIFY_TRACK_IDS);
    await this.post(`/api/salons/${this.salonId}/spotify/sync`, {
      trackId,
      positionMs: randomInt(0, 180000),
    }, 'Synchroniser lecture Spotify');
  }

  private async controlPlayback(): Promise<void> {
    if (!this.salonId) return;
    const controls = ['play', 'pause', 'next'];
    const ctrl = randomItem(controls);
    await this.post(`/api/salons/${this.salonId}/spotify/control`, {
      action: ctrl,
    }, `Contrôle Spotify: ${ctrl}`);
  }

  private async viewQueue(): Promise<void> {
    if (!this.salonId) return;
    await this.get(`/api/salons/${this.salonId}/queue`, 'File Spotify');
  }

  private async loadSpotifyPlaylist(): Promise<void> {
    if (!this.salonId) return;
    // Playlist publique officielle Spotify
    const playlistUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
    await this.post(`/api/salons/${this.salonId}/queue/spotify-playlist`, {
      playlistUrl,
    }, 'Charger playlist Spotify');
  }

  private async sendHostChat(): Promise<void> {
    if (!this.salonId) return;
    const msgs = [
      '🎵 Prochain : playlist Spotify officielle',
      'Linkez votre Spotify pour voter !',
      'Session Spotify — qualité premium 🎶',
      'Salon ouvert à tous !',
    ];
    this.sendChatMessage(this.salonId, randomItem(msgs));
  }

  private async testSpotifyJamLink(): Promise<void> {
    if (!this.salonId) return;
    // Test avec une URL de Spotify Jam (format attendu)
    const mockJamUrl = 'https://open.spotify.com/socialsession/mock_jam_test_session';
    await this.post(`/api/salons/${this.salonId}/spotify/jam`, {
      jamUrl: mockJamUrl,
    }, 'Test Spotify Jam link');
  }

  private async checkPlatformStatus(): Promise<void> {
    await this.get('/api/platforms', 'Statut plateformes');
    await this.get('/api/auth/profile/me', 'Profil agent (compte Spotify)');
    this.linkAttempts++;

    if (this.linkAttempts === 1) {
      // Test du flow OAuth (obtenir l'URL de redirection seulement)
      await this.get('/api/auth/providers', 'Providers OAuth disponibles');
    }
  }
}

// ── Personas Agents 16–18 ─────────────────────────────────────────────────────

export const SPOTIFY_HOST_PERSONAS: AgentPersona[] = [
  buildPersona(16, 'spotify_host', 'Inès Laroche', 'DJ Spotify — playlists électro et house'),
  buildPersona(17, 'spotify_host', 'Bastien Morel', 'Hôte Spotify — rap français et RnB'),
  buildPersona(18, 'spotify_host', 'Zoé Chevallier', 'Salons Spotify indie et alternative'),
];

export function createSpotifyHostAgent(persona: AgentPersona): SpotifyHostAgent {
  return new SpotifyHostAgent(persona);
}
