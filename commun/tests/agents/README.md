# OnScen — Infrastructure de Tests Agents IA

Simule **27 utilisateurs IA** qui testent OnScen pendant **24 heures** en parallèle.

---

## Structure

```
tests/agents/
├── run.ts                      # Point d'entrée (à lancer manuellement)
├── orchestrator.ts             # Gère les agents, collecte résultats
├── agent.ts                    # Classe de base (HTTP, Socket.io, métriques)
├── report.ts                   # Génère rapports HTML + JSON
├── agents.config.ts            # Configuration (URL, durée, délais)
├── package.json                # Dépendances npm
├── tsconfig.json               # Config TypeScript
├── reports/                    # Rapports générés (créé automatiquement)
└── scenarios/
    ├── index.ts                # Point d'entrée scénarios + fabrique
    ├── newUser.scenario.ts     # Agents 1–5  : Nouveaux utilisateurs
    ├── listener.scenario.ts    # Agents 6–10 : Auditeurs
    ├── youtubeHost.scenario.ts # Agents 11–15: Hôtes YouTube
    ├── liveStreamer.scenario.ts # Agents 16–18: Streamers live
    ├── donor.scenario.ts       # Agents 19–21: Donateurs
    ├── powerUser.scenario.ts   # Agents 22–24: Power users
    ├── moderator.scenario.ts   # Agents 25–26: Modérateurs
    └── admin.scenario.ts       # Agent 27    : Admin
```

---

## Installation

```bash
cd tests/agents
npm install
```

---

## Lancement

> ⚠️ **Les tests ne s'exécutent PAS automatiquement.** Ils doivent être lancés explicitement.

### Mode développement (localhost:3000) — recommandé pour débuter

```bash
npm run test:agents:dev
```

### Mode production (getsoundy.com)

```bash
npm run test:agents:prod
```

> Une confirmation sera demandée avant de cibler la production.

### Mode rapide (5 minutes — pour valider l'infrastructure)

```bash
npm run test:agents:quick
```

### Options avancées (variables d'environnement)

```bash
# URL cible personnalisée
TARGET_URL=http://localhost:4080 npm run test:agents

# Durée personnalisée (en millisecondes)
DURATION_MS=3600000 npm run test:agents      # 1 heure
DURATION_MS=86400000 npm run test:agents     # 24 heures (défaut)

# Agents spécifiques seulement (IDs 1 à 27)
AGENT_IDS=1,2,3,6,7 npm run test:agents

# Niveau de log
LOG_LEVEL=debug npm run test:agents          # Très verbeux
LOG_LEVEL=warn npm run test:agents           # Silencieux (erreurs seules)

# Compte admin personnalisé (pour l'agent 27)
PROD_ADMIN_EMAIL=admin@example.com PROD_ADMIN_PASSWORD=xxx npm run test:agents

# Dossier de sortie des rapports
REPORT_DIR=./custom-reports npm run test:agents
```

---

## Arrêt gracieux

Appuyer sur **CTRL+C** en cours d'exécution :
- Tous les agents s'arrêtent proprement
- Le rapport partiel est sauvegardé dans `tests/agents/reports/`
- Le résumé est affiché dans le terminal

---

## Rapports générés

Après chaque run (ou CTRL+C), deux fichiers sont créés dans `tests/agents/reports/` :

### `onscen-agents-report-YYYYMMDD-final.html`
Rapport HTML interactif avec :
- Stats globales (taux de succès, latences P50/P95/P99)
- **Bugs détectés** (erreurs 500, timeouts, taux d'erreur élevé, Socket.io)
- Performance par endpoint (méthode, latence, codes HTTP)
- Résultats par agent (actions, succès, erreurs)
- Stats par groupe de rôles

### `onscen-agents-report-YYYYMMDD-final.json`
Rapport JSON pour intégration CI/CD :
```json
{
  "summary": {
    "successRate": 94.3,
    "criticalBugs": 0,
    "p99LatencyMs": 1250
  },
  "bugs": [],
  "endpointStats": [...],
  "agentResults": [...]
}
```

**Seuils CI recommandés :**
- `summary.successRate` ≥ 80%
- `summary.criticalBugs` = 0
- `summary.p99LatencyMs` ≤ 5000ms

---

## Les 27 agents

| ID | Nom | Rôle | Ce qu'il teste |
|---|---|---|---|
| 1–5 | Alice, Théo, Emma… | Nouveaux utilisateurs | Inscription, onboarding, exploration, follow |
| 6–10 | Hugo, Manon, Nathan… | Auditeurs | Salons, chat, reels, feed, likes |
| 11–15 | Jules, Sarah, Antoine… | Hôtes YouTube | Création salon, recherche YouTube, playlists, queue |
| 16–18 | Tristan, Eva, Clément | Streamers live | Démarrer live (mock), chat, WebRTC, cadeaux |
| 19–21 | Sophie, Pierre, Marie | Donateurs | Dons Stripe, cadeaux live, abonnements créateurs |
| 22–24 | Lucas, Jade, Tom | Power users | Reels, posts, DMs, groupes, mentions, edge cases |
| 25–26 | Audrey, Fabien | Modérateurs | Signalements, support tickets, conformité légale |
| 27 | Admin OnScen | Admin | Panel admin, analytics, gestion users, modération |

---

## Ce que chaque groupe teste

### Agents 1–5 : Nouveaux utilisateurs
- Inscription avec validation CGU
- Mise à jour profil (onboarding)
- Inscription push notifications (VAPID)
- Exploration feed, reels, salons, trending
- Follow premiers utilisateurs
- Tests inputs invalides (email incorrect, mot de passe vide)

### Agents 6–10 : Auditeurs
- Rejoindre/quitter des salons (via API + Socket.io `join_salon`)
- Envoyer des messages chat
- Historique chat salon
- Liker des reels, commenter
- Navigation feed avec interactions
- Détection de salons par géolocalisation

### Agents 11–15 : Hôtes YouTube
- Créer un salon YouTube
- Recherche YouTube (via l'API backend avec cache)
- Ajouter des morceaux à la file
- Charger une playlist YouTube complète
- Gérer les propositions de pistes (accepter/refuser)
- Skip, réordonnancement de la queue
- Mise à jour des paramètres du salon

### Agents 16–18 : Streamers live
- Créer un live WebRTC/LiveKit (mock — pas de vrai stream)
- Obtenir les ICE servers TURN
- Chat en live
- Voir les viewers et stats
- Terminer le live proprement
- Cycle lives multiples (5–20 min par session)

### Agents 19–21 : Donateurs
- Initier des dons Stripe (sans paiement réel)
- Envoyer des cadeaux en live (heart, star, fire…)
- Initier un checkout abonnement créateur
- Voir les profils créateurs
- Regarder les lives en tant que viewer
- Tester les inputs invalides (montant 0, négatif, ID inexistant)

### Agents 22–24 : Power users
- Créer et publier des reels (draft → publié)
- Poster sur le feed (avec mentions)
- Envoyer des DMs et créer des groupes de chat
- Pagination du feed (3 pages)
- 5 requêtes concurrentes (test de concurrence)
- Supprimer ses propres posts
- Gérer profil, stories, notifications

### Agents 25–26 : Modérateurs
- Signaler du contenu (reels, users, salons, lives)
- Créer des tickets de support
- Vérifier les pages légales (CGU, confidentialité)
- Tester les accès sans auth (attendu: 401)
- Tester les accès admin sans droits (attendu: 403)
- Bloquer/débloquer des utilisateurs
- Test des endpoints 404

### Agent 27 : Admin
- Connexion avec les credentials admin (env vars)
- Parcourir les analytics par contexte
- Gestion des utilisateurs (liste, approbation)
- Traitement des rapports de contenu
- Gestion des codes d'invitation
- Monitoring serveur, Cloudflare, syslog
- Vérification des tickets support
- Publication d'actualités

---

## Architecture technique

```
┌─────────────────────────────────────────────────────────┐
│                     run.ts (entry)                       │
│                         │                               │
│               Orchestrator (orchestrator.ts)             │
│   ┌─────────────────────┼──────────────────────────┐    │
│   │                     │                          │    │
│ Agent#1             Agent#15               Agent#27 │   │
│ (NewUser)        (YouTubeHost)              (Admin)  │   │
│   │                     │                          │    │
│ BaseAgent            BaseAgent             BaseAgent │   │
│  • HTTP (axios)      • Socket.io           • Métriques│  │
│  • socket.io-client  • ActionRecord        • Personas  │  │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
          report.ts                 agents.config.ts
      HTML + JSON                  CONFIG + helpers
```

**Flux de données :**
1. `Orchestrator` instancie les agents via `createAgent(persona)`
2. Chaque agent tourne en parallèle dans sa propre `Promise`
3. Les `sharedUserIds`, `sharedSalonIds`, `sharedLiveIds` permettent aux agents d'interagir entre eux
4. Chaque action est enregistrée : méthode, endpoint, statut HTTP, latence, erreur
5. À la fin (ou CTRL+C), `generateReport()` analyse les données et produit les rapports

---

## Dépendances

| Package | Rôle |
|---|---|
| `axios` | Requêtes HTTP vers l'API OnScen |
| `socket.io-client` | Connexion Socket.io (salons, lives, chat) |
| `faker` | Données de test réalistes |
| `uuid` | Génération d'IDs uniques |
| `cli-progress` | Barre de progression terminal |
| `chalk` | Couleurs terminal |
| `ts-node` | Exécution TypeScript directe |
| `typescript` | Compilation TypeScript |

---

## Notes importantes

1. **Pas de paiements réels** : les agents initient des checkouts Stripe mais n'entrent pas de carte. Les tests Stripe nécessitent un compte Stripe configuré en mode test.

2. **Pas de vrais streams** : les agents streamers créent des sessions LiveKit/Cloudflare mais n'envoient pas de flux vidéo réel. Uniquement l'API est testée.

3. **Pas de vrais OAuth** : les agents ne peuvent pas lier YouTube via OAuth (nécessite un vrai navigateur). Les erreurs 403 sur ces endpoints sont attendues et documentées.

4. **Comptes de test** : les agents créent de vrais comptes avec des emails `onscen.agent01@test.onscen.local`. En production, utiliser un domaine de test isolé.

5. **Rate limiting** : certains agents testent intentionnellement les limites de débit. Des erreurs 429 sont attendues et comptées comme "comportement correct".
