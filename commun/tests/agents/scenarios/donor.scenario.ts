/**
 * donor.scenario.ts — Agents 22–24 : Donateurs
 *
 * Simule des utilisateurs qui envoient des dons/pourboires aux créateurs,
 * consultent les profils des créateurs, envoient des cadeaux en live.
 * Les paiements Stripe sont testés en mode mock (pas de vrai paiement).
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class DonorAgent extends BaseAgent {
  private viewedCreators: string[] = [];
  private donationAttempts = 0;
  private giftAttempts = 0;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    const action = Math.random();

    if (action < 0.2) {
      await this.browseCreatorProfiles();
    } else if (action < 0.35) {
      await this.viewCreatorProfile();
    } else if (action < 0.5) {
      await this.attemptDonation();
    } else if (action < 0.62) {
      await this.sendGiftInLive();
    } else if (action < 0.72) {
      await this.viewSubscriptionTiers();
    } else if (action < 0.80) {
      await this.attemptSubscription();
    } else if (action < 0.88) {
      await this.viewDonationHistory();
    } else if (action < 0.94) {
      await this.watchLiveAsViewer();
    } else {
      await this.testInvalidDonation();
    }
  }

  // ── Profils créateurs ───────────────────────────────────────────────────────

  private async browseCreatorProfiles(): Promise<void> {
    // Trending = liste des meilleurs créateurs
    const result = await this.get('/api/trending', 'Trending créateurs');

    if (result.success) {
      const users = (result.data as { users?: Array<{ id: string; username: string }> })?.users ?? [];
      for (const user of users.slice(0, 3)) {
        if (!BaseAgent.sharedUserIds.includes(user.id)) {
          BaseAgent.sharedUserIds.push(user.id);
        }
      }
    }
  }

  private async viewCreatorProfile(): Promise<void> {
    const creatorId = this.pickRandomSharedUser();
    if (!creatorId || this.viewedCreators.includes(creatorId)) {
      await this.browseCreatorProfiles();
      return;
    }

    await this.get(`/api/auth/profile/${creatorId}`, 'Voir profil créateur');
    await this.get(`/api/reels/user/${creatorId}`, 'Reels du créateur');
    await this.get(`/api/feed`, 'Feed du créateur', { userId: creatorId });
    await this.get(`/api/ratings/${creatorId}`, 'Avis sur le créateur');

    this.viewedCreators.push(creatorId);
    await this.delay(3000, 10000);
  }

  // ── Dons ────────────────────────────────────────────────────────────────────

  private async attemptDonation(): Promise<void> {
    const creatorId = this.pickRandomSharedUser();
    if (!creatorId) return;

    const amounts = [1, 2, 5, 10, 20];
    const amount = randomItem(amounts);

    const result = await this.post('/api/donations', {
      recipientId: creatorId,
      amount,
      currency: 'eur',
      message: randomItem([
        'Super live, merci !',
        'Continue comme ça 🎵',
        'Petit soutien !',
        'Excellent salon !',
        '',
      ]),
    }, `Tentative de don ${amount}€`);

    this.donationAttempts++;

    if (result.success) {
      this.log('info', `Don de ${amount}€ initié (Stripe checkout)`);
    } else if (result.status === 402 || result.status === 403) {
      // Attendu si Stripe pas configuré en mode test ou feature disabled
      this.log('debug', `Don refusé (${result.status}) — Stripe non configuré`);
    }
  }

  private async viewDonationHistory(): Promise<void> {
    await this.get('/api/donations/history', 'Historique mes dons');
    await this.get('/api/donations/received', 'Dons reçus');
  }

  private async testInvalidDonation(): Promise<void> {
    // Montant 0
    await this.testInvalidInput('/api/donations', {
      recipientId: 'user_fake_id',
      amount: 0,
      currency: 'eur',
    }, 'Don montant zéro');

    // Montant négatif
    await this.testInvalidInput('/api/donations', {
      recipientId: this.userId,
      amount: -10,
      currency: 'eur',
    }, 'Don auto (négatif)');

    // Destinataire inexistant
    await this.testInvalidInput('/api/donations', {
      recipientId: `user_inexistant_${Date.now()}`,
      amount: 5,
      currency: 'eur',
    }, 'Don destinataire inexistant');
  }

  // ── Cadeaux Live ─────────────────────────────────────────────────────────────

  private async sendGiftInLive(): Promise<void> {
    const liveId = this.pickRandom(BaseAgent.sharedLiveIds);
    if (!liveId) {
      this.log('debug', 'Aucun live actif — navigation vers feed');
      await this.get('/api/lives', 'Lives disponibles');
      return;
    }

    const gifts = ['heart', 'star', 'fire', 'music_note', 'crown'];
    const gift = randomItem(gifts);
    const quantity = randomInt(1, 5);

    const result = await this.post('/api/gifts', {
      liveId,
      giftType: gift,
      quantity,
    }, `Cadeau live: ${quantity}x ${gift}`);

    this.giftAttempts++;

    if (result.success) {
      this.log('info', `Cadeau envoyé: ${quantity}x ${gift} dans live ${liveId}`);
    }
  }

  // ── Abonnements créateurs ─────────────────────────────────────────────────

  private async viewSubscriptionTiers(): Promise<void> {
    const creatorId = this.pickRandomSharedUser();
    if (!creatorId) return;
    await this.get(`/api/subscriptions/creator/${creatorId}`, 'Tiers abonnement créateur');
  }

  private async attemptSubscription(): Promise<void> {
    const creatorId = this.pickRandomSharedUser();
    if (!creatorId) return;

    const result = await this.post('/api/subscriptions/checkout', {
      creatorId,
      tierId: 'tier_basic',
    }, 'Checkout abonnement créateur');

    if (result.success) {
      this.log('info', `Checkout abonnement initié pour: ${creatorId}`);
    } else if (result.status === 402 || result.status === 403) {
      this.log('debug', `Abonnement refusé (${result.status}) — non configuré`);
    }
  }

  // ── Viewer live ──────────────────────────────────────────────────────────────

  private async watchLiveAsViewer(): Promise<void> {
    const liveId = this.pickRandom(BaseAgent.sharedLiveIds);
    if (!liveId) return;

    this.joinLive(liveId);
    await this.get(`/api/lives/${liveId}`, 'Rejoindre live en viewer');
    await this.get(`/api/lives/ice-servers`, 'ICE servers viewer', { liveId });

    // Regarde pendant 1–5 min
    const watchDuration = randomInt(1, 5) * 60 * 1000;
    await this.delay(Math.min(watchDuration, 30000), Math.min(watchDuration + 10000, 40000));

    // Envoie des réactions
    const reactions = ['❤️', '🔥', '👏', '🎵', '😍'];
    for (let i = 0; i < randomInt(1, 4); i++) {
      this.sendChatMessage(liveId, randomItem(reactions));
      await this.delay(500, 2000);
    }

    this.leaveLive(liveId);
  }
}

// ── Personas Agents 22–24 ─────────────────────────────────────────────────────

export const DONOR_PERSONAS: AgentPersona[] = [
  buildPersona(22, 'donor', 'Sophie Arnaud', 'Fan généreuse — donne régulièrement à ses créateurs préférés'),
  buildPersona(23, 'donor', 'Pierre Renard', 'Testeur de cadeaux — explore tous les types de gifts'),
  buildPersona(24, 'donor', 'Marie-Line Caron', 'Viewer premium — abonnements et donations fréquentes'),
];

export function createDonorAgent(persona: AgentPersona): DonorAgent {
  return new DonorAgent(persona);
}
