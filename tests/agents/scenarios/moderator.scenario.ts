/**
 * moderator.scenario.ts — Agents 28–29 : Modérateurs
 *
 * Simule des modérateurs qui signalent du contenu, utilisent le support,
 * et vérifient les fonctionnalités de conformité légale.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem } from '../agents.config';

export class ModeratorAgent extends BaseAgent {
  private reportedItems: string[] = [];
  private supportTicketIds: string[] = [];
  private stepIndex = 0;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    const actions = [
      this.reportContent.bind(this),
      this.viewReportedContent.bind(this),
      this.createSupportTicket.bind(this),
      this.viewSupportHistory.bind(this),
      this.viewLegalPages.bind(this),
      this.checkUserReports.bind(this),
      this.viewContentPolicy.bind(this),
      this.testBlockUser.bind(this),
      this.viewNewsAndAnnouncements.bind(this),
      this.checkAccessibilityEndpoints.bind(this),
    ];

    const action = actions[this.stepIndex % actions.length];
    this.stepIndex++;
    await action();
  }

  // ── Signalement de contenu ──────────────────────────────────────────────────

  private async reportContent(): Promise<void> {
    const reportTypes: Array<{ type: string; category: string; reason: string }> = [
      { type: 'reel', category: 'spam', reason: 'Contenu spam répété' },
      { type: 'user', category: 'harassment', reason: 'Comportement abusif en chat' },
      { type: 'salon', category: 'inappropriate', reason: 'Contenu inapproprié dans le salon' },
      { type: 'post', category: 'misinformation', reason: 'Information trompeuse' },
      { type: 'live', category: 'copyright', reason: 'Contenu protégé par droits d\'auteur' },
    ];

    const report = randomItem(reportTypes);
    let targetId: string | undefined;

    switch (report.type) {
      case 'reel':
        targetId = this.pickRandom(BaseAgent.sharedReelIds);
        break;
      case 'user':
        targetId = this.pickRandomSharedUser();
        break;
      case 'salon':
        targetId = this.pickRandomSharedSalon();
        break;
      case 'live':
        targetId = this.pickRandom(BaseAgent.sharedLiveIds);
        break;
      default:
        targetId = this.pickRandomSharedUser();
    }

    if (!targetId) {
      this.log('debug', `Pas de ${report.type} disponible pour signalement`);
      return;
    }

    if (this.reportedItems.includes(targetId)) return;

    const result = await this.post('/api/legal/report', {
      targetType: report.type,
      targetId,
      category: report.category,
      reason: report.reason,
      description: `Signalement automatique — test QA agent ${this.persona.id}`,
    }, `Signalement ${report.type}: ${report.category}`);

    if (result.success) {
      this.reportedItems.push(targetId);
      this.log('info', `Signalement ${report.type} créé pour: ${targetId}`);
    }
  }

  private async viewReportedContent(): Promise<void> {
    // Voir ses propres signalements
    await this.get('/api/legal/my-reports', 'Mes signalements');
  }

  private async checkUserReports(): Promise<void> {
    // Test de l'endpoint admin reports (attendu: 403 si non admin)
    const result = await this.get('/api/admin/reports', 'Admin: rapports (403 attendu)');
    if (result.status === 403) {
      this.log('debug', 'Accès admin refusé — comportement correct (non-admin)');
    } else if (result.status === 200) {
      this.log('warn', '⚠️ Accès admin accordé à un non-admin !');
    }
  }

  // ── Support ───────────────────────────────────────────────────────────────────

  private async createSupportTicket(): Promise<void> {
    const subjects = [
      'Impossible de rejoindre un salon',
      'Problème avec la lecture Spotify',
      'Notification reçue en double',
      'Profil qui ne se met pas à jour',
      'Bug sur le feed — posts dupliqués',
      'Demande de suppression de compte',
    ];

    const result = await this.post('/api/support/tickets', {
      subject: randomItem(subjects),
      message: `Agent #${this.persona.id} — ticket de test automatisé. Description détaillée du problème rencontré lors des tests.`,
      priority: randomItem(['low', 'medium', 'high']),
      category: randomItem(['bug', 'account', 'content', 'feature', 'billing']),
    }, 'Créer ticket support');

    if (result.success && result.data) {
      const ticket = result.data as { id?: string; ticket?: { id: string } };
      const ticketId = ticket.id ?? ticket.ticket?.id;
      if (ticketId) {
        this.supportTicketIds.push(ticketId);
        this.log('info', `Ticket support créé: ${ticketId}`);
      }
    }
  }

  private async viewSupportHistory(): Promise<void> {
    await this.get('/api/support/tickets', 'Mes tickets support');

    if (this.supportTicketIds.length > 0) {
      const ticketId = randomItem(this.supportTicketIds);
      await this.get(`/api/support/tickets/${ticketId}`, `Détail ticket: ${ticketId}`);

      // Ajouter un message à un ticket existant
      if (Math.random() > 0.6) {
        await this.post(`/api/support/tickets/${ticketId}/messages`, {
          message: 'Complément d\'information : le problème persiste après reconnexion.',
        }, 'Message suivi ticket');
      }
    }
  }

  // ── Légal & conformité ─────────────────────────────────────────────────────

  private async viewLegalPages(): Promise<void> {
    await this.get('/api/legal/terms', 'CGU');
    await this.get('/api/legal/privacy', 'Politique de confidentialité');
    await this.get('/api/legal/mentions', 'Mentions légales');
  }

  private async viewContentPolicy(): Promise<void> {
    await this.get('/api/legal/content-policy', 'Politique de contenu');
    // Vérifie les catégories de signalement disponibles
    await this.get('/api/legal/report/categories', 'Catégories de signalement');
  }

  // ── Modération utilisateurs ────────────────────────────────────────────────

  private async testBlockUser(): Promise<void> {
    const targetId = this.pickRandomSharedUser();
    if (!targetId) return;

    // Bloquer un utilisateur
    const result = await this.post(`/api/users/${targetId}/block`, {}, `Bloquer user: ${targetId}`);
    if (result.success) {
      this.log('debug', `Utilisateur ${targetId} bloqué`);

      // Débloquer immédiatement (on est modérateur de test)
      await this.delay(1000, 3000);
      await this.delete(`/api/users/${targetId}/block`, `Débloquer user: ${targetId}`);
    }
  }

  // ── Monitoring ────────────────────────────────────────────────────────────────

  private async viewNewsAndAnnouncements(): Promise<void> {
    await this.get('/api/news', 'Actualités Soundy');
  }

  private async checkAccessibilityEndpoints(): Promise<void> {
    // Vérifie les endpoints publics qui ne nécessitent pas d'auth
    await this.get('/health', 'Health check serveur');
    await this.get('/api/config', 'Config publique');

    // Test 404 sur ressource inexistante
    await this.test404('/api/salons');
    await this.test404('/api/lives');
    await this.test404('/api/users');

    // Test requête sans auth (attendu: 401)
    const savedToken = this.authToken;
    this.authToken = null;
    this.http.defaults.headers['X-Auth-Token'] = '';

    await this.get('/api/feed', 'Feed sans auth (401 attendu)');
    await this.get('/api/notifications', 'Notifications sans auth (401 attendu)');

    // Restaurer le token
    this.authToken = savedToken;
    this.http.defaults.headers['X-Auth-Token'] = savedToken ?? '';
  }
}

// ── Personas Agents 28–29 ─────────────────────────────────────────────────────

export const MODERATOR_PERSONAS: AgentPersona[] = [
  buildPersona(28, 'moderator', 'Audrey Perrin', 'Modératrice communauté — signale et gère le contenu'),
  buildPersona(29, 'moderator', 'Fabien Morin', 'Modérateur technique — vérifie la conformité des endpoints'),
];

export function createModeratorAgent(persona: AgentPersona): ModeratorAgent {
  return new ModeratorAgent(persona);
}
