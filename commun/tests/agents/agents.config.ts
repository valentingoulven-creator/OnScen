/**
 * agents.config.ts — Configuration centrale de l'infrastructure de test
 *
 * Variables d'environnement supportées :
 *   TARGET_URL     URL cible (défaut: http://localhost:3000)
 *   DURATION_MS    Durée en ms (défaut: 86400000 = 24h)
 *   LOG_LEVEL      Niveau de log: debug | info | warn | error (défaut: info)
 *   REPORT_DIR     Dossier de sortie des rapports (défaut: ./reports)
 *   AGENT_PASSWORD Mot de passe commun pour tous les agents de test
 */

export const CONFIG = {
  // ── Réseau ────────────────────────────────────────────────────────────────
  BASE_URL: (process.env.TARGET_URL ?? 'http://localhost:3000').replace(/\/$/, ''),

  // ── Durée totale du test ──────────────────────────────────────────────────
  DURATION_MS: parseInt(process.env.DURATION_MS ?? '') || 24 * 60 * 60 * 1000, // 24h

  // ── Agents ────────────────────────────────────────────────────────────────
  AGENT_COUNT: 30,

  // Délai aléatoire entre chaque action d'un agent (ms)
  MIN_DELAY_MS: 1_000,
  MAX_DELAY_MS: 10_000,

  // Délai max avant qu'un agent démarre (étalement du démarrage)
  MAX_AGENT_STAGGER_MS: 30_000,

  // ── Réseau (requêtes / sockets) ────────────────────────────────────────────
  REQUEST_TIMEOUT_MS: 15_000,
  SOCKET_TIMEOUT_MS: 10_000,
  SOCKET_RECONNECT_ATTEMPTS: 3,
  MAX_RETRIES: 3,

  // ── Rapport ───────────────────────────────────────────────────────────────
  REPORT_DIR: process.env.REPORT_DIR ?? './reports',

  // Sauvegarde automatique du rapport partiel toutes les N minutes
  PARTIAL_REPORT_INTERVAL_MS: 15 * 60 * 1000, // 15 min

  // ── Logs ──────────────────────────────────────────────────────────────────
  LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  // ── Auth agents ───────────────────────────────────────────────────────────
  // Préfixe email des comptes de test — ex: soundy.agent01@test.local
  AGENT_EMAIL_PREFIX: 'soundy.agent',
  AGENT_EMAIL_DOMAIN: process.env.AGENT_EMAIL_DOMAIN ?? '@test.soundy.local',
  AGENT_PASSWORD: process.env.AGENT_PASSWORD ?? 'SoundyTest#2026!',

  // Accepter les CGU automatiquement (requis pour l'inscription)
  AGENT_ACCEPT_TERMS: true,

  // ── Géolocalisation par défaut (Paris centre) ─────────────────────────────
  DEFAULT_LAT: 48.8566,
  DEFAULT_LON: 2.3522,

  // ── Données de test Fake ──────────────────────────────────────────────────
  // Musiques de test YouTube (IDs publics)
  YOUTUBE_TRACK_IDS: [
    'dQw4w9WgXcQ',
    'kJQP7kiw5Fk',
    'JGwWNGJdvx8',
    'RgKAFK5djSk',
    'OPf0YbXqDm0',
    '9bZkp7q19f0',
    'YQHsXMglC9A',
  ],


  // Termes de recherche YouTube pour tests variés
  YOUTUBE_SEARCH_QUERIES: [
    'lofi hip hop beats',
    'jazz cafe music',
    'pop hits 2024',
    'electronic dance music',
    'french chanson',
    'acoustic guitar',
  ],

  // Messages de chat de test
  CHAT_MESSAGES: [
    '🎵 Super ambiance !',
    'J\'adore cette musique',
    'Quelqu\'un connait ce titre ?',
    '+1 pour la prochaine playlist',
    'Hôte au top 🔥',
    'On peut avoir du jazz après ?',
    'Super salon, merci !',
    'First time here, it\'s great!',
    '🎶🎶🎶',
    'Soundy c\'est vraiment top',
    'Cette chanson me rappelle des souvenirs',
    'Bonjour tout le monde !',
  ],

  // Contenus de posts feed
  FEED_POST_CONTENTS: [
    'Je viens de découvrir Soundy et c\'est incroyable ! 🎵',
    'Mon salon de jazz du dimanche est ouvert 🎷',
    'Nouvelle playlist disponible sur mon salon électro',
    'Qui veut faire un salon lofi ce soir ? 🌙',
    'Merci pour les 100 followers ! ❤️',
    'Live ce soir à 21h, rejoignez-moi !',
  ],
} as const;

/** Retourne un délai aléatoire entre MIN_DELAY_MS et MAX_DELAY_MS */
export function randomDelay(
  min: number = CONFIG.MIN_DELAY_MS,
  max: number = CONFIG.MAX_DELAY_MS
): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retourne un élément aléatoire du tableau */
export function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Retourne un entier aléatoire entre min et max (inclus) */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
