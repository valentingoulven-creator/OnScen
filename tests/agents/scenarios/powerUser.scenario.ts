/**
 * powerUser.scenario.ts — Agents 25–27 : Power Users
 *
 * Simule des utilisateurs très actifs : création de reels, posts feed,
 * DMs intensifs, interactions sociales et test des edge cases.
 */

import { BaseAgent, AgentPersona, buildPersona } from '../agent';
import { CONFIG, randomItem, randomInt } from '../agents.config';

export class PowerUserAgent extends BaseAgent {
  private conversationIds: string[] = [];
  private postedReels: string[] = [];
  private postedFeedPosts: string[] = [];
  private stepIndex = 0;

  protected async authenticate(): Promise<boolean> {
    return this.registerOrLogin();
  }

  protected async runScenarioStep(): Promise<void> {
    // Power users enchaînent les actions rapidement (moins de délai)
    const actions = [
      this.createFeedPost.bind(this),
      this.createReel.bind(this),
      this.sendDM.bind(this),
      this.startGroupConversation.bind(this),
      this.commentFeedPost.bind(this),
      this.resharePost.bind(this),
      this.viewOwnReels.bind(this),
      this.manageProfilePhotos.bind(this),
      this.testConcurrentRequests.bind(this),
      this.searchUsers.bind(this),
      this.followBatch.bind(this),
      this.viewNotifications.bind(this),
      this.markNotificationsRead.bind(this),
      this.viewDMList.bind(this),
      this.publishDraftReel.bind(this),
      this.deleteOwnPost.bind(this),
      this.postWithMentions.bind(this),
      this.viewStoriesAndReact.bind(this),
      this.postStory.bind(this),
      this.testPaginatedFeed.bind(this),
    ];

    const action = actions[this.stepIndex % actions.length];
    this.stepIndex++;

    try {
      await action();
    } catch (err) {
      this.recordError(`Power action ${this.stepIndex}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Power users agissent plus vite
    await this.delay(500, 3000);
  }

  // ── Feed ────────────────────────────────────────────────────────────────────

  private async createFeedPost(): Promise<void> {
    const result = await this.post('/api/feed', {
      content: randomItem(CONFIG.FEED_POST_CONTENTS),
      type: 'post',
      isPublic: true,
    }, 'Créer post feed');

    if (result.success && result.data) {
      const post = result.data as { id?: string; post?: { id: string } };
      const postId = post.id ?? post.post?.id;
      if (postId) this.postedFeedPosts.push(postId);
    }
  }

  private async postWithMentions(): Promise<void> {
    const targetUserId = this.pickRandomSharedUser();
    if (!targetUserId) return;

    await this.post('/api/feed', {
      content: `Hey @${targetUserId} — super session ce soir ! 🎵`,
      type: 'post',
      isPublic: true,
      mentions: [targetUserId],
    }, 'Post avec mention');
  }

  private async commentFeedPost(): Promise<void> {
    const result = await this.get('/api/feed', 'Feed pour commentaire', { limit: 10 });
    if (!result.success) return;
    const posts = (result.data as { posts?: Array<{ id: string }> })?.posts ?? [];
    if (!posts.length) return;
    const post = randomItem(posts);
    await this.post(`/api/feed/${post.id}/comments`, {
      content: randomItem([
        'Super post !',
        '100% d\'accord 🔥',
        'Merci pour le partage',
        `Ça me rappelle quelque chose... @${this.persona.username}`,
      ]),
    }, 'Commenter post feed');
  }

  private async resharePost(): Promise<void> {
    const result = await this.get('/api/feed', 'Feed pour repartage');
    if (!result.success) return;
    const posts = (result.data as { posts?: Array<{ id: string }> })?.posts ?? [];
    if (!posts.length) return;
    const post = randomItem(posts);
    await this.post(`/api/feed/${post.id}/reshare`, {}, 'Repartager post');
  }

  private async deleteOwnPost(): Promise<void> {
    if (!this.postedFeedPosts.length) return;
    const postId = this.postedFeedPosts.pop();
    if (!postId) return;
    await this.delete(`/api/feed/${postId}`, 'Supprimer post feed');
  }

  private async testPaginatedFeed(): Promise<void> {
    let before: number | undefined;
    for (let page = 0; page < 3; page++) {
      const result = await this.get('/api/feed', `Feed page ${page + 1}`, {
        limit: 10,
        before,
      });
      if (!result.success) break;
      const posts = (result.data as { posts?: Array<{ id: string; createdAt: number }> })?.posts ?? [];
      if (!posts.length) break;
      before = posts[posts.length - 1].createdAt;
      await this.delay(500, 1500);
    }
  }

  // ── Reels ────────────────────────────────────────────────────────────────────

  private async createReel(): Promise<void> {
    // Crée un reel (draft) — sans upload vidéo réel
    const result = await this.post('/api/reels', {
      title: `Reel test ${this.persona.name} #${randomInt(1, 999)}`,
      description: 'Reel généré automatiquement — tests QA',
      tags: ['test', 'soundy', 'musique'],
      musicTrack: randomItem(CONFIG.YOUTUBE_TRACK_IDS),
      isPublic: false, // Draft
    }, 'Créer reel (draft)');

    if (result.success && result.data) {
      const reel = result.data as { id?: string; reel?: { id: string } };
      const reelId = reel.id ?? reel.reel?.id;
      if (reelId) {
        this.postedReels.push(reelId);
        if (!BaseAgent.sharedReelIds.includes(reelId)) {
          BaseAgent.sharedReelIds.push(reelId);
        }
      }
    }
  }

  private async publishDraftReel(): Promise<void> {
    if (!this.postedReels.length) return;
    const reelId = this.postedReels[this.postedReels.length - 1];
    const result = await this.post(`/api/reels/${reelId}/publish`, {
      isPublic: true,
    }, 'Publier reel draft');

    if (result.success) {
      this.log('info', `Reel publié: ${reelId}`);
    }
  }

  private async viewOwnReels(): Promise<void> {
    await this.get('/api/reels/user-created', 'Mes reels créés');
    await this.get('/api/reels/private/me', 'Mes reels privés');
  }

  // ── DMs & groupes ────────────────────────────────────────────────────────────

  private async sendDM(): Promise<void> {
    const targetId = this.pickRandomSharedUser();
    if (!targetId) return;

    const messages = [
      'Salut ! Super ta session 🎵',
      'Tu veux rejoindre mon salon ce soir ?',
      'J\'ai adoré ton dernier reel !',
      'On fait un collab bientôt ?',
      `Yo ! Agent ${this.persona.id} ici`,
    ];

    // Obtenir ou créer la conversation
    const convoResult = await this.post('/api/dm/conversations', {
      participantId: targetId,
    }, 'Créer/ouvrir conversation DM');

    let convId: string | null = null;
    if (convoResult.success && convoResult.data) {
      const data = convoResult.data as { conversation?: { id: string }; id?: string };
      convId = data.conversation?.id ?? data.id ?? null;
      if (convId && !this.conversationIds.includes(convId)) {
        this.conversationIds.push(convId);
      }
    }

    if (convId) {
      await this.post(`/api/dm/conversations/${convId}/messages`, {
        content: randomItem(messages),
      }, 'Envoyer DM');

      // Lire les messages de la conversation
      await this.get(`/api/dm/conversations/${convId}/messages`, 'Lire DM conversation');
    }
  }

  private async startGroupConversation(): Promise<void> {
    const participants = BaseAgent.sharedUserIds
      .filter((id) => id !== this.userId)
      .slice(0, randomInt(2, 4));

    if (participants.length < 2) return;

    const result = await this.post('/api/dm/groups', {
      name: `Groupe QA ${Date.now()}`,
      participantIds: participants,
    }, 'Créer groupe de chat');

    if (result.success && result.data) {
      const group = result.data as { id?: string; group?: { id: string } };
      const groupId = group.id ?? group.group?.id;
      if (groupId) {
        await this.post(`/api/dm/groups/${groupId}/messages`, {
          content: `Bienvenue dans ce groupe de test ! 🎵 — Agent ${this.persona.id}`,
        }, 'Message dans groupe');
      }
    }
  }

  private async viewDMList(): Promise<void> {
    await this.get('/api/dm/conversations', 'Liste conversations DM');
  }

  // ── Profil ────────────────────────────────────────────────────────────────────

  private async manageProfilePhotos(): Promise<void> {
    // Simule la vérification des photos de profil (sans upload réel)
    await this.get('/api/auth/profile/me', 'Mon profil complet');

    await this.patch('/api/auth/profile', {
      bio: `Power User Agent #${this.persona.id} — dernière session: ${new Date().toLocaleString()}`,
    }, 'Mise à jour bio profil');
  }

  // ── Social ────────────────────────────────────────────────────────────────────

  private async searchUsers(): Promise<void> {
    const queries = ['soundy', 'agent', 'music', 'live', 'jazz'];
    await this.get('/api/users/search', 'Recherche utilisateurs', {
      q: randomItem(queries),
      limit: 20,
    });
  }

  private async followBatch(): Promise<void> {
    const userIds = BaseAgent.sharedUserIds
      .filter((id) => id !== this.userId)
      .slice(0, 5);

    for (const userId of userIds) {
      await this.post(`/api/users/${userId}/follow`, {}, `Follow: ${userId}`);
      await this.delay(300, 1000);
    }
  }

  // ── Notifications ────────────────────────────────────────────────────────────

  private async viewNotifications(): Promise<void> {
    await this.get('/api/notifications', 'Voir notifications');
  }

  private async markNotificationsRead(): Promise<void> {
    await this.put('/api/notifications/read-all', {}, 'Marquer notifs lues');
  }

  // ── Stories ───────────────────────────────────────────────────────────────────

  private async viewStoriesAndReact(): Promise<void> {
    const result = await this.get('/api/stories', 'Voir stories');
    if (result.success) {
      const stories = (result.data as { stories?: Array<{ id: string }> })?.stories ?? [];
      if (stories.length > 0) {
        const story = randomItem(stories);
        // Voir la story
        await this.get(`/api/stories/${story.id}`, 'Voir story spécifique');
        // Réagir
        if (Math.random() > 0.5) {
          await this.post(`/api/stories/${story.id}/reaction`, {
            type: randomItem(['❤️', '🔥', '😍', '👏']),
          }, 'Réaction story');
        }
      }
    }
  }

  private async postStory(): Promise<void> {
    await this.post('/api/stories', {
      content: randomItem([
        'Ma session du soir 🎵',
        'Nouveau salon ouvert ! Rejoins-moi',
        'Écoute de la journée 🎧',
      ]),
      type: 'text',
      duration: 24,
    }, 'Publier story');
  }

  // ── Edge cases ────────────────────────────────────────────────────────────────

  private async testConcurrentRequests(): Promise<void> {
    // Envoie 5 requêtes en parallèle (teste la concurrence)
    await Promise.allSettled([
      this.get('/api/feed', 'Concurrent feed 1'),
      this.get('/api/reels', 'Concurrent reels'),
      this.get('/api/trending', 'Concurrent trending'),
      this.get('/api/notifications', 'Concurrent notifications'),
      this.get('/api/stories', 'Concurrent stories'),
    ]);
  }
}

// ── Personas Agents 25–27 ─────────────────────────────────────────────────────

export const POWER_USER_PERSONAS: AgentPersona[] = [
  buildPersona(25, 'power_user', 'Lucas Bernard', 'Power user — créateur de contenu hyperactif'),
  buildPersona(26, 'power_user', 'Jade Mercier', 'Social butterfly — DMs, follows, posts en continu'),
  buildPersona(27, 'power_user', 'Tom Garnier', 'Tech user — teste les limites de l\'app (edge cases)'),
];

export function createPowerUserAgent(persona: AgentPersona): PowerUserAgent {
  return new PowerUserAgent(persona);
}
