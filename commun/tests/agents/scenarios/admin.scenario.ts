/**
 * admin.scenario.ts — Agent 30 : Administrateur
 *
 * Simule un administrateur OnScen qui parcourt les panneaux admin,
 * vérifie les analytics, surveille les utilisateurs et le contenu.
 * Utilise un compte admin configuré via PROD_ADMIN_EMAIL/PASSWORD.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem } from '../agents.config';

export class AdminAgent extends BaseAgent {
  private adminLoggedIn = false;
  private stepIndex = 0;
  private readonly adminEmail = process.env.PROD_ADMIN_EMAIL ?? CONFIG.AGENT_EMAIL_PREFIX + '30' + CONFIG.AGENT_EMAIL_DOMAIN;
  private readonly adminPassword = process.env.PROD_ADMIN_PASSWORD ?? CONFIG.AGENT_PASSWORD;

  protected async authenticate(): Promise<boolean> {
    // L'admin tente de se connecter avec les credentials admin configurés
    const result = await this.post('/api/auth/login', {
      email: this.adminEmail,
      password: this.adminPassword,
    }, 'Connexion admin');

    if (result.success && result.data) {
      const data = result.data as { token?: string; user?: { id: string; role?: string } };
      if (data.token) {
        this.authToken = data.token;
        this.userId = data.user?.id ?? null;
        this.http.defaults.headers['X-Auth-Token'] = this.authToken;

        const role = data.user?.role;
        if (role === 'admin' || role === 'super_admin') {
          this.adminLoggedIn = true;
          this.log('info', `Admin connecté (role: ${role})`);
        } else {
          this.log('warn', `Connecté mais pas admin (role: ${role ?? 'unknown'}) — fallback register`);
          this.adminLoggedIn = false;
        }
        return true;
      }
    }

    // Fallback : créer un compte normal si le compte admin n'existe pas
    this.log('warn', 'Admin login failed — création compte normal de fallback');
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    const adminActions = [
      this.checkServerHealth.bind(this),
      this.viewAnalytics.bind(this),
      this.viewUserManagement.bind(this),
      this.viewContentReports.bind(this),
      this.viewSupportTickets.bind(this),
      this.viewSalonsAdmin.bind(this),
      this.viewLivesAdmin.bind(this),
      this.checkMonitor.bind(this),
      this.viewSponsorAdmin.bind(this),
      this.manageInviteCodes.bind(this),
      this.viewPendingUsers.bind(this),
      this.checkCloudflareStatus.bind(this),
      this.viewSyslog.bind(this),
      this.viewAdminReports.bind(this),
      this.testAccessControlEndpoints.bind(this),
      this.broadcastNews.bind(this),
    ];

    const action = adminActions[this.stepIndex % adminActions.length];
    this.stepIndex++;

    try {
      await action();
    } catch (err) {
      this.recordError(`Admin action ${this.stepIndex}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // L'admin est moins pressé — il analyse chaque page
    await this.delay(5000, 20000);
  }

  // ── Health & monitoring ────────────────────────────────────────────────────

  private async checkServerHealth(): Promise<void> {
    await this.get('/health', 'Health check serveur');
    await this.get('/api/config', 'Config runtime app');
  }

  private async checkMonitor(): Promise<void> {
    const result = await this.get('/api/admin/monitor', 'Monitor serveur');
    if (result.status === 403) {
      this.log('debug', 'Monitor: 403 — pas d\'accès admin (compte normal)');
    } else if (result.success) {
      this.log('info', 'Monitor: accès OK');
    }
  }

  private async checkCloudflareStatus(): Promise<void> {
    const result = await this.get('/api/admin', 'Status Cloudflare');
    if (result.status === 403) {
      this.log('debug', 'Cloudflare admin: 403 — pas admin');
    }
  }

  private async viewSyslog(): Promise<void> {
    const result = await this.get('/api/admin/vps', 'Syslog VPS');
    if (result.status === 403) {
      this.log('debug', 'Syslog: 403 — pas admin');
    }
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  private async viewAnalytics(): Promise<void> {
    await this.get('/api/analytics', 'Analytics globales');
    await this.get('/api/analytics', 'Analytics salons', { context: 'salons' });
    await this.get('/api/analytics', 'Analytics lives', { context: 'lives' });
    await this.get('/api/analytics', 'Analytics users', { context: 'users' });
  }

  // ── Gestion utilisateurs ───────────────────────────────────────────────────

  private async viewUserManagement(): Promise<void> {
    const result = await this.get('/api/access/admin/users', 'Liste utilisateurs (admin)');
    if (result.status === 403) {
      this.log('debug', 'Gestion users: 403 — accès admin requis');
      return;
    }

    if (result.success) {
      const users = (result.data as { users?: Array<{ id: string; status: string }> })?.users ?? [];
      this.log('info', `${users.length} utilisateurs visibles en admin`);
    }
  }

  private async viewPendingUsers(): Promise<void> {
    const result = await this.get('/api/access/admin/users', 'Users en attente', {
      status: 'pending',
    });
    if (result.status === 403) {
      this.log('debug', 'Users pending: 403');
      return;
    }

    if (result.success) {
      const users = (result.data as { users?: Array<{ id: string }> })?.users ?? [];
      // Simuler approbation d'un utilisateur (si accès admin)
      for (const user of users.slice(0, 2)) {
        await this.post(`/api/access/admin/users/${user.id}/approve`, {}, `Approuver user: ${user.id}`);
        await this.delay(500, 1500);
      }
    }
  }

  private async manageInviteCodes(): Promise<void> {
    // Créer des codes d'invitation
    const result = await this.post('/api/access/admin/invites', {
      count: 5,
      expiresIn: '7d',
    }, 'Créer codes invitation');

    if (result.status === 403) {
      this.log('debug', 'Invites: 403 — pas admin');
      return;
    }

    // Voir les codes existants
    await this.get('/api/access/admin/invites', 'Codes invitation actifs');
  }

  // ── Gestion du contenu ─────────────────────────────────────────────────────

  private async viewContentReports(): Promise<void> {
    const result = await this.get('/api/admin/reports', 'Rapports de contenu');
    if (result.status === 403) {
      this.log('debug', 'Reports: 403 — pas admin');
      return;
    }

    if (result.success) {
      const reports = (result.data as { reports?: Array<{ id: string; status: string }> })?.reports ?? [];
      this.log('info', `${reports.length} rapports de contenu`);

      // Traiter les premiers rapports
      for (const report of reports.filter((r) => r.status === 'pending').slice(0, 2)) {
        await this.post(`/api/admin/reports/${report.id}/resolve`, {
          action: 'dismiss',
          note: 'Contenu vérifié — aucune violation',
        }, `Traiter rapport: ${report.id}`);
      }
    }
  }

  private async viewAdminReports(): Promise<void> {
    const result = await this.get('/api/access/admin/content', 'Contenu modération admin');
    if (result.status === 403) {
      this.log('debug', 'Admin content: 403');
    }
  }

  // ── Support admin ──────────────────────────────────────────────────────────

  private async viewSupportTickets(): Promise<void> {
    const result = await this.get('/api/access/admin/support', 'Tickets support (admin)');
    if (result.status === 403) {
      this.log('debug', 'Support admin: 403');
      return;
    }

    if (result.success) {
      const tickets = (result.data as { tickets?: Array<{ id: string; status: string }> })?.tickets ?? [];
      this.log('info', `${tickets.length} tickets support ouverts`);
    }
  }

  // ── Salons & Lives admin ───────────────────────────────────────────────────

  private async viewSalonsAdmin(): Promise<void> {
    // Vérifie les salons actifs depuis la perspective admin
    await this.get('/api/salons', 'Salons actifs (vue admin)');

    const salonId = this.pickRandomSharedSalon();
    if (salonId) {
      await this.get(`/api/salons/${salonId}`, 'Détail salon (vue admin)');
    }
  }

  private async viewLivesAdmin(): Promise<void> {
    await this.get('/api/lives', 'Lives actifs (vue admin)', {
      latitude: CONFIG.DEFAULT_LAT,
      longitude: CONFIG.DEFAULT_LON,
    });

    const liveId = this.pickRandom(BaseAgent.sharedLiveIds);
    if (liveId) {
      await this.get(`/api/lives/${liveId}`, 'Détail live (vue admin)');
    }
  }

  // ── Sponsors admin ─────────────────────────────────────────────────────────

  private async viewSponsorAdmin(): Promise<void> {
    const result = await this.get('/api/access/admin/sponsors', 'Sponsors admin');
    if (result.status === 403) {
      this.log('debug', 'Sponsors admin: 403');
    } else if (result.success) {
      this.log('info', 'Accès sponsors admin OK');
    }
  }

  // ── News ──────────────────────────────────────────────────────────────────

  private async broadcastNews(): Promise<void> {
    const result = await this.post('/api/news', {
      title: `Test actualité QA — ${new Date().toLocaleString()}`,
      content: 'Ceci est une actualité de test générée automatiquement par l\'agent admin.',
      isPublic: false,
    }, 'Publier actualité (admin)');

    if (result.status === 403) {
      this.log('debug', 'News publish: 403 — pas admin');
    } else if (result.success) {
      this.log('info', 'Actualité de test publiée');
    }
  }

  // ── Access control ─────────────────────────────────────────────────────────

  private async testAccessControlEndpoints(): Promise<void> {
    await this.get('/api/access', 'Politique d\'accès');

    const adminEndpoints = [
      '/api/access/admin/users',
      '/api/access/admin/invites',
      '/api/access/admin/support',
      '/api/access/admin/content',
      '/api/admin/reports',
      '/api/admin/monitor',
    ];

    for (const endpoint of adminEndpoints) {
      const result = await this.get(endpoint, `Test endpoint admin: ${endpoint}`);
      const statusLabel = result.status === 403 ? '🔒 403' : result.status === 200 ? '✅ 200' : `⚠️ ${result.status}`;
      this.log('info', `${statusLabel} ${endpoint}`);
      await this.delay(200, 800);
    }
  }
}

// ── Persona Agent 30 ──────────────────────────────────────────────────────────

export const ADMIN_PERSONAS: AgentPersona[] = [
  buildPersona(30, 'admin', 'Admin OnScen', 'Administrateur — surveillance, analytics et modération globale'),
];

export function createAdminAgent(persona: AgentPersona): AdminAgent {
  return new AdminAgent(persona);
}
