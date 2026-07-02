import dns from 'node:dns';

/**
 * Force la résolution DNS IPv4-first pour tout le process.
 *
 * Sur le VPS, Node résout googleapis.com (et d'autres hôtes) en IPv6 par défaut.
 * La clé API YouTube (YOUTUBE_API_KEY) est restreinte par IP dans Google Cloud
 * Console sur l'IPv4 sortante du serveur — un appel en IPv6 est donc rejeté avec
 * une erreur 403 "API_KEY_IP_ADDRESS_BLOCKED", silencieuse pour les utilisateurs
 * sans token OAuth YouTube (fallback impossible), typiquement les participants
 * d'un salon qui proposent un morceau sans avoir lié leur propre compte.
 */
dns.setDefaultResultOrder('ipv4first');
