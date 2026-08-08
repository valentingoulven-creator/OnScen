/**
 * newUser.scenario.ts — Agents 1–5 : Nouveaux utilisateurs
 *
 * Simule le parcours d'un tout nouvel utilisateur :
 * inscription → onboarding → exploration de l'app → follow premiers utilisateurs
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem } from '../agents.config';

export class NewUserAgent extends BaseAgent {
  private hasCompletedOnboarding = false;
  private currentSalonId: string | null = null;
  private followedUsers: string[] = [];
  private stepIndex = 0;

  // Séquence d'actions pour un nouvel utilisateur
  private readonly STEPS = [
    'checkHealth',
    'viewProfile',
    'updateProfile',
    'registerPushNotifications',
    'browseFeed',
    'browseReels',
    'exploreSalons',
    'joinFirstSalon',
    'listenInSalon',
    'browseUsers',
    'followUsers',
    'viewTrending',
    'viewNotifications',
    'testInvalidActions',
    'browseFeedAlgo',
    'exploreGeolocation',
    'sendFirstChatMessage',
    'viewSponsor',
    'browseStories',
  ];

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    const step = this.STEPS[this.stepIndex % this.STEPS.length];
    this.stepIndex++;
    await this.executeStep(step);
  }

  private async executeStep(step: string): Promise<void> {
    switch (step) {
      case 'checkHealth':
        await this.checkHealth();
        break;
      case 'viewProfile':
        await this.viewOwnProfile();
        break;
      case 'updateProfile':
        await this.updateProfile();
        break;
      case 'registerPushNotifications':
        await this.registerPush();
        break;
      case 'browseFeed':
        await this.browseFeed();
        break;
      case 'browseReels':
        await this.browseReels();
        break;
      case 'exploreSalons':
        await this.exploreSalons();
        break;
      case 'joinFirstSalon':
        await this.joinFirstSalon();
        break;
      case 'listenInSalon':
        await this.listenInSalon();
        break;
      case 'browseUsers':
        await this.browseUsers();
        break;
      case 'followUsers':
        await this.followSomeUsers();
        break;
      case 'viewTrending':
        await this.viewTrending();
        break;
      case 'viewNotifications':
        await this.viewNotifications();
        break;
      case 'testInvalidActions':
        await this.testInvalidInputs();
        break;
      case 'browseFeedAlgo':
        await this.browseFeedWithAlgo();
        break;
      case 'exploreGeolocation':
        await this.exploreGeolocation();
        break;
      case 'sendFirstChatMessage':
        await this.sendChatIfInSalon();
        break;
      case 'viewSponsor':
        await this.viewSponsors();
        break;
      case 'browseStories':
        await this.browseStories();
        break;
    }
  }

  // ── Étapes ─────────────────────────────────────────────────────────────────

  private async checkHealth(): Promise<void> {
    await this.get('/health', 'Health check');
  }

  private async viewOwnProfile(): Promise<void> {
    if (!this.userId) return;
    await this.get(`/api/auth/profile/${this.userId}`, 'Voir son profil');
  }

  private async updateProfile(): Promise<void> {
    if (this.hasCompletedOnboarding) return;
    await this.put('/api/auth/profile', {
      bio: `Agent de test #${this.persona.id} — OnScen QA`,
      location: 'Paris, France',
      age: 20 + this.persona.id,
      profileType: 'auditeur',
    }, 'Mise à jour profil onboarding');
    this.hasCompletedOnboarding = true;
  }

  private async registerPush(): Promise<void> {
    // Simule une subscription Web Push (clé VAPID mock)
    await this.post('/api/push/subscribe', {
      endpoint: `https://fcm.googleapis.com/fcm/send/mock_${this.persona.id}_${Date.now()}`,
      keys: {
        p256dh: 'BNbxkcs9oSVuJFSvU8G3GJwMPHSV_mock_test',
        auth: 'mock_auth_test',
      },
    }, 'Inscription push notifications');
  }

  private async browseFeed(): Promise<void> {
    await this.get('/api/feed', 'Navigation feed principal', { limit: 20 });
  }

  private async browseFeedWithAlgo(): Promise<void> {
    await this.get('/api/feed', 'Feed avec algorithme', { limit: 20, algo: 'true' });
  }

  private async browseReels(): Promise<void> {
    const result = await this.get('/api/reels', 'Navigation reels');
    if (result.success && Array.isArray((result.data as Record<string, unknown>)?.reels)) {
      const reels = (result.data as { reels: Array<{ id: string }> }).reels;
      if (reels.length > 0) {
        const reel = reels[0];
        // Enregistre une vue
        await this.post(`/api/reels/${reel.id}/view`, {}, 'Vue reel');
        // Like aléatoire
        if (Math.random() > 0.5) {
          await this.post(`/api/reels/${reel.id}/heart`, {}, 'Like reel');
        }
      }
    }
  }

  private async exploreSalons(): Promise<void> {
    await this.get('/api/salons', 'Explorer salons', {
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    });
  }

  private async joinFirstSalon(): Promise<void> {
    const result = await this.get('/api/salons', 'Salons disponibles');
    if (result.success) {
      const salons = (result.data as { salons?: Array<{ id: string }> })?.salons ?? [];
      if (salons.length > 0) {
        this.currentSalonId = salons[0].id;
        this.joinSalon(this.currentSalonId);
        await this.get(`/api/salons/${this.currentSalonId}`, 'Détail salon rejoint');
        await this.get(`/api/chat/${this.currentSalonId}`, 'Historique chat salon');

        // Partage l'ID pour les autres agents
        if (!BaseAgent.sharedSalonIds.includes(this.currentSalonId)) {
          BaseAgent.sharedSalonIds.push(this.currentSalonId);
        }
      }
    }
  }

  private async listenInSalon(): Promise<void> {
    if (!this.currentSalonId) return;
    // Simule écoute passive (5-30s)
    await this.delay(5000, 30000);
    // Quitte puis rejoint un autre salon
    this.leaveSalon(this.currentSalonId);
    this.currentSalonId = null;
  }

  private async browseUsers(): Promise<void> {
    await this.get('/api/users/search', 'Recherche utilisateurs', { q: 'onscen' });
    await this.get('/api/trending', 'Utilisateurs trending');
  }

  private async followSomeUsers(): Promise<void> {
    const userIds = BaseAgent.sharedUserIds.filter((id) => id !== this.userId);
    for (const targetId of userIds.slice(0, 3)) {
      if (!this.followedUsers.includes(targetId)) {
        const result = await this.post(`/api/users/${targetId}/follow`, {}, `Follow user ${targetId}`);
        if (result.success) this.followedUsers.push(targetId);
        await this.delay(500, 2000);
      }
    }
  }

  private async viewTrending(): Promise<void> {
    await this.get('/api/trending', 'Trending utilisateurs');
  }

  private async viewNotifications(): Promise<void> {
    await this.get('/api/notifications', 'Voir notifications');
  }

  private async testInvalidInputs(): Promise<void> {
    // Register avec email invalide
    await this.testInvalidInput('/api/auth/register', {
      username: '',
      email: 'invalid-email',
      password: '123',
    }, 'Register email invalide');

    // Login avec mauvais mot de passe
    await this.testInvalidInput('/api/auth/login', {
      email: this.persona.email,
      password: 'mauvais_mdp',
    }, 'Login mot de passe incorrect');
  }

  private async exploreGeolocation(): Promise<void> {
    await this.get('/api/geo/geocode', 'Géocodage', { q: 'Paris, France' });
    await this.get('/api/salons', 'Salons proches (géo)', {
      latitude: CONFIG.DEFAULT_LAT + (Math.random() - 0.5) * 0.1,
      longitude: CONFIG.DEFAULT_LON + (Math.random() - 0.5) * 0.1,
    });
  }

  private async sendChatIfInSalon(): Promise<void> {
    const salonId = this.pickRandomSharedSalon();
    if (!salonId) return;
    this.joinSalon(salonId);
    await this.delay(1000, 3000);
    this.sendChatMessage(salonId, randomItem(CONFIG.CHAT_MESSAGES));
    await this.delay(2000, 5000);
    this.leaveSalon(salonId);
  }

  private async viewSponsors(): Promise<void> {
    await this.get('/api/sponsors', 'Voir sponsors');
  }

  private async browseStories(): Promise<void> {
    await this.get('/api/stories', 'Voir stories');
  }
}

// ── Personas Agents 1–5 ────────────────────────────────────────────────────────

export const NEW_USER_PERSONAS: AgentPersona[] = [
  buildPersona(1, 'new_user', 'Alice Dubois', 'Nouvel utilisateur curieux, découvre l\'app progressivement'),
  buildPersona(2, 'new_user', 'Théo Martin', 'Nouvel utilisateur mobile, explore sans but précis'),
  buildPersona(3, 'new_user', 'Emma Rousseau', 'Étudiante, s\'inscrit pour écouter de la musique'),
  buildPersona(4, 'new_user', 'Liam Bernard', 'Découvre via un ami, teste les fonctionnalités de base'),
  buildPersona(5, 'new_user', 'Chloé Petit', 'Power newcomer — s\'inscrit et explore tout rapidement'),
];

export function createNewUserAgent(persona: AgentPersona): NewUserAgent {
  return new NewUserAgent(persona);
}
