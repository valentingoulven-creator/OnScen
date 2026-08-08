/**
 * agent.ts — Classe de base pour tous les agents de test OnScen
 *
 * Chaque agent simule un utilisateur réel :
 * - Inscription / connexion via JWT (X-Auth-Token)
 * - Connexion Socket.io pour les événements temps réel
 * - Enregistrement de chaque action (méthode, endpoint, statut, latence, erreur)
 * - Délai aléatoire entre actions pour simuler un comportement humain
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { io, Socket } from 'socket.io-client';
import { CONFIG, randomDelay, randomInt } from './agents.config';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AgentRole =
  | 'new_user'
  | 'listener'
  | 'youtube_host'
  | 'live_streamer'
  | 'donor'
  | 'power_user'
  | 'moderator'
  | 'admin';

export interface AgentPersona {
  id: number;
  name: string;
  role: AgentRole;
  email: string;
  username: string;
  password: string;
  description: string;
}

export interface ActionRecord {
  timestamp: number;
  action: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'SOCKET';
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SocketEventRecord {
  timestamp: number;
  event: string;
  direction: 'emit' | 'receive';
  data?: unknown;
}

export interface AgentResult {
  persona: AgentPersona;
  actions: ActionRecord[];
  socketEvents: SocketEventRecord[];
  startTime: number;
  endTime: number;
  totalActions: number;
  successActions: number;
  failedActions: number;
  errors: string[];
  authToken?: string;
  userId?: string;
}

// ── Classe BaseAgent ───────────────────────────────────────────────────────────

export abstract class BaseAgent {
  protected persona: AgentPersona;
  protected http: AxiosInstance;
  protected socket: Socket | null = null;
  protected authToken: string | null = null;
  protected userId: string | null = null;
  protected isRunning = false;

  private actions: ActionRecord[] = [];
  private socketEvents: SocketEventRecord[] = [];
  private errors: string[] = [];
  private startTime = 0;

  // Partage entre agents (set par l'orchestrateur)
  static sharedUserIds: string[] = [];
  static sharedSalonIds: string[] = [];
  static sharedLiveIds: string[] = [];
  static sharedReelIds: string[] = [];

  constructor(persona: AgentPersona) {
    this.persona = persona;
    this.http = axios.create({
      baseURL: CONFIG.BASE_URL,
      timeout: CONFIG.REQUEST_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Cycle de vie ────────────────────────────────────────────────────────────

  async run(durationMs: number): Promise<AgentResult> {
    this.startTime = Date.now();
    this.isRunning = true;
    this.log('info', `Démarrage — durée: ${Math.round(durationMs / 1000 / 60)} min`);

    // Délai de démarrage échelonné (évite le thundering herd)
    await randomDelay(0, CONFIG.MAX_AGENT_STAGGER_MS);

    try {
      // 1. Authentification
      const authenticated = await this.authenticate();
      if (!authenticated) {
        this.recordError('Échec authentification initiale');
        this.isRunning = false;
        return this.buildResult();
      }

      // 2. Connexion Socket.io
      await this.connectSocket();

      // 3. Boucle principale — exécution du scénario jusqu'à la fin du temps imparti
      const deadline = this.startTime + durationMs;
      while (this.isRunning && Date.now() < deadline) {
        try {
          await this.runScenarioStep();
        } catch (err) {
          this.recordError(`Erreur scénario: ${err instanceof Error ? err.message : String(err)}`);
        }
        await randomDelay();
      }
    } catch (err) {
      this.recordError(`Erreur fatale: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await this.cleanup();
    }

    this.isRunning = false;
    this.log('info', `Terminé — ${this.actions.length} actions`);
    return this.buildResult();
  }

  stop(): void {
    this.isRunning = false;
  }

  // ── Méthodes abstraites — implémentées par chaque scénario ──────────────────

  /** Authentifie l'agent (register si nouveau, login sinon) */
  protected abstract authenticate(): Promise<boolean>;

  /** Exécute une étape du scénario (appelée en boucle pendant toute la durée) */
  protected abstract runScenarioStep(): Promise<void>;

  // ── Auth helpers ────────────────────────────────────────────────────────────

  /** Tente de s'inscrire, puis de se connecter si le compte existe déjà */
  protected async registerOrLogin(): Promise<boolean> {
    const registered = await this.tryRegister();
    if (registered) return true;
    return this.tryLogin();
  }

  protected async tryRegister(): Promise<boolean> {
    const result = await this.post('/api/auth/register', {
      username: this.persona.username,
      email: this.persona.email,
      password: this.persona.password,
      acceptTerms: true,
      termsVersion: '2024-01',
    }, 'Inscription');

    if (result.success && result.data) {
      const authData = result.data as { token?: string; user?: { id: string } };
      if (authData.token) {
        this.authToken = authData.token;
        this.userId = authData.user?.id ?? null;
        this.http.defaults.headers['X-Auth-Token'] = this.authToken;
        if (this.userId) BaseAgent.sharedUserIds.push(this.userId);
        this.log('info', `Inscrit — userId: ${this.userId}`);
        return true;
      }
    }
    return false;
  }

  protected async tryLogin(): Promise<boolean> {
    const result = await this.post('/api/auth/login', {
      email: this.persona.email,
      password: this.persona.password,
    }, 'Connexion');

    if (result.success && result.data) {
      const authData = result.data as { token?: string; user?: { id: string } };
      if (authData.token) {
        this.authToken = authData.token;
        this.userId = authData.user?.id ?? null;
        this.http.defaults.headers['X-Auth-Token'] = this.authToken;
        if (this.userId && !BaseAgent.sharedUserIds.includes(this.userId)) {
          BaseAgent.sharedUserIds.push(this.userId);
        }
        this.log('info', `Connecté — userId: ${this.userId}`);
        return true;
      }
    }
    return false;
  }

  // ── Socket.io ───────────────────────────────────────────────────────────────

  protected async connectSocket(): Promise<void> {
    return new Promise((resolve) => {
      this.socket = io(CONFIG.BASE_URL, {
        auth: { token: this.authToken },
        extraHeaders: { 'X-Auth-Token': this.authToken ?? '' },
        reconnectionAttempts: CONFIG.SOCKET_RECONNECT_ATTEMPTS,
        timeout: CONFIG.SOCKET_TIMEOUT_MS,
        transports: ['websocket', 'polling'],
      });

      const timeout = setTimeout(() => {
        this.log('warn', 'Timeout connexion socket');
        resolve();
      }, CONFIG.SOCKET_TIMEOUT_MS);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.recordSocketEvent('receive', 'connect');
        this.log('debug', `Socket connecté: ${this.socket?.id}`);
        // Enregistrement de présence
        this.emitSocket('register', { userId: this.userId });
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.recordSocketEvent('receive', 'disconnect', { reason });
        this.log('debug', `Socket déconnecté: ${reason}`);
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.log('warn', `Erreur socket: ${err.message}`);
        resolve();
      });

      // Écoute des événements salon
      this.socket.on('salon_playback', (data) => {
        this.recordSocketEvent('receive', 'salon_playback', data);
      });
      this.socket.on('salon_queue_updated', (data) => {
        this.recordSocketEvent('receive', 'salon_queue_updated', data);
      });
      this.socket.on('chat_message', (data) => {
        this.recordSocketEvent('receive', 'chat_message', data);
      });
    });
  }

  protected emitSocket(event: string, data?: unknown): void {
    if (!this.socket?.connected) return;
    this.socket.emit(event, data);
    this.recordSocketEvent('emit', event, data);
  }

  protected joinSalon(salonId: string): void {
    this.emitSocket('join_salon', { salonId, userId: this.userId });
    this.log('debug', `Rejoint salon: ${salonId}`);
  }

  protected leaveSalon(salonId: string): void {
    this.emitSocket('leave_salon', { salonId, userId: this.userId });
  }

  protected joinLive(liveId: string): void {
    this.emitSocket('join_live', { liveId, userId: this.userId });
  }

  protected leaveLive(liveId: string): void {
    this.emitSocket('leave_live', { liveId, userId: this.userId });
  }

  protected sendChatMessage(salonId: string, message: string): void {
    this.emitSocket('send_message', { salonId, message, userId: this.userId });
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────────

  protected async get(
    endpoint: string,
    actionName: string,
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    return this.request('GET', endpoint, actionName, undefined, params);
  }

  protected async post(
    endpoint: string,
    body: unknown,
    actionName: string
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    return this.request('POST', endpoint, actionName, body);
  }

  protected async put(
    endpoint: string,
    body: unknown,
    actionName: string
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    return this.request('PUT', endpoint, actionName, body);
  }

  protected async patch(
    endpoint: string,
    body: unknown,
    actionName: string
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    return this.request('PATCH', endpoint, actionName, body);
  }

  protected async delete(
    endpoint: string,
    actionName: string
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    return this.request('DELETE', endpoint, actionName);
  }

  private async request(
    method: ActionRecord['method'],
    endpoint: string,
    actionName: string,
    body?: unknown,
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; status: number }> {
    const t0 = Date.now();
    let statusCode = 0;
    let success = false;
    let errorMsg: string | undefined;
    let data: unknown;

    try {
      const response = await this.http.request({
        method,
        url: endpoint,
        data: body,
        params,
      });
      statusCode = response.status;
      data = response.data;
      success = statusCode < 400;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axErr = err as AxiosError;
        statusCode = axErr.response?.status ?? 0;
        errorMsg = axErr.response
          ? `HTTP ${statusCode}: ${JSON.stringify(axErr.response.data).slice(0, 200)}`
          : `Network: ${axErr.message}`;
      } else {
        errorMsg = String(err);
      }
    }

    const latencyMs = Date.now() - t0;
    this.actions.push({
      timestamp: t0,
      action: actionName,
      method,
      endpoint,
      statusCode,
      latencyMs,
      success,
      error: errorMsg,
    });

    if (!success && errorMsg) {
      this.log('warn', `${actionName} [${method} ${endpoint}] ${statusCode} — ${errorMsg.slice(0, 100)}`);
    } else {
      this.log('debug', `${actionName} [${method} ${endpoint}] ${statusCode} (${latencyMs}ms)`);
    }

    return { success, data, status: statusCode };
  }

  // ── Tests de cas limites ────────────────────────────────────────────────────

  /** Teste les inputs invalides — doit retourner 400/422 */
  protected async testInvalidInput(
    endpoint: string,
    body: unknown,
    actionName: string
  ): Promise<boolean> {
    const result = await this.post(endpoint, body, `${actionName} (input invalide)`);
    // On veut un 400, 422 ou 401 (pas un 500)
    const isExpected = result.status >= 400 && result.status < 500;
    if (!isExpected && result.status === 500) {
      this.recordError(`⚠️ Erreur 500 sur input invalide: ${endpoint}`);
    }
    return isExpected;
  }

  /** Teste les requêtes rapides successives (rate limiting) */
  protected async testRapidRequests(
    endpoint: string,
    count = 5
  ): Promise<void> {
    const promises = Array.from({ length: count }, (_, i) =>
      this.get(endpoint, `Rapid request #${i + 1}`)
    );
    await Promise.allSettled(promises);
  }

  /** Teste un endpoint 404 */
  protected async test404(basePath: string): Promise<void> {
    await this.get(
      `${basePath}/id_inexistant_${Date.now()}`,
      `Test 404 (${basePath})`
    );
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────────

  protected async delay(min?: number, max?: number): Promise<void> {
    return randomDelay(min, max);
  }

  protected pickRandom<T>(arr: T[]): T | undefined {
    if (!arr.length) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  protected pickRandomSharedSalon(): string | undefined {
    return this.pickRandom(BaseAgent.sharedSalonIds);
  }

  protected pickRandomSharedUser(): string | undefined {
    const others = BaseAgent.sharedUserIds.filter((id) => id !== this.userId);
    return this.pickRandom(others);
  }

  protected recordError(msg: string): void {
    this.errors.push(`[${new Date().toISOString()}] Agent ${this.persona.id} (${this.persona.role}): ${msg}`);
    this.log('error', msg);
  }

  protected log(level: 'debug' | 'info' | 'warn' | 'error', msg: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[CONFIG.LOG_LEVEL]) return;

    const colors: Record<string, string> = {
      debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset} Agent#${String(this.persona.id).padStart(2, '0')} (${this.persona.role.padEnd(15)})`;
    console.log(`${prefix} ${msg}`);
  }

  private recordSocketEvent(
    direction: 'emit' | 'receive',
    event: string,
    data?: unknown
  ): void {
    this.socketEvents.push({ timestamp: Date.now(), event, direction, data });
  }

  private async cleanup(): Promise<void> {
    if (this.socket?.connected) {
      this.socket.disconnect();
    }
  }

  private buildResult(): AgentResult {
    const successActions = this.actions.filter((a) => a.success).length;
    return {
      persona: this.persona,
      actions: this.actions,
      socketEvents: this.socketEvents,
      startTime: this.startTime,
      endTime: Date.now(),
      totalActions: this.actions.length,
      successActions,
      failedActions: this.actions.length - successActions,
      errors: this.errors,
      authToken: this.authToken ?? undefined,
      userId: this.userId ?? undefined,
    };
  }

  // ── Getters publics ─────────────────────────────────────────────────────────

  get id(): number {
    return this.persona.id;
  }

  get role(): AgentRole {
    return this.persona.role;
  }

  get actionCount(): number {
    return this.actions.length;
  }

  get errorCount(): number {
    return this.errors.length;
  }
}

// ── Fabrique de persona ────────────────────────────────────────────────────────

export function buildPersona(
  id: number,
  role: AgentRole,
  name: string,
  description: string
): AgentPersona {
  const paddedId = String(id).padStart(2, '0');
  return {
    id,
    name,
    role,
    email: `${CONFIG.AGENT_EMAIL_PREFIX}${paddedId}${CONFIG.AGENT_EMAIL_DOMAIN}`,
    username: `onscen_agent_${paddedId}`,
    password: CONFIG.AGENT_PASSWORD,
    description,
  };
}
