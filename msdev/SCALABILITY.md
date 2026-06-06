# Soundly — Scalabilité vers 500 000 utilisateurs simultanés

> **Document de référence** — juin 2026  
> Ce document distingue ce qui est **implémenté** (améliorations frontend/backend compatibles msdev)
> de ce qui nécessite une **infrastructure de production** pour atteindre 500 000 utilisateurs simultanés.

---

## 1. Optimisations déjà implémentées (juin 2026)

### Frontend

| Amélioration | Description | Impact |
|---|---|---|
| **Code splitting** (React.lazy) | `ActualiteTabPage`, `DmPage`, `LivePage`, `SalonPage`, `UserProfilePage` chargés à la demande | Bundle initial réduit ; pages lourdes chargées uniquement quand visitées |
| **Chunks Vite manuels** | `vendor-react`, `vendor-socketio`, `vendor-map`, `vendor-three`, `vendor-misc` | Cache navigateur durable ; rechargement partiel entre versions |
| **React.memo sur NearbyPersonRow** | Chaque ligne de la liste de proximité ne se re-rend que si ses props changent | Évite des re-renders inutiles avec 300 entrées affichées |
| **React.memo sur PostCard** | Chaque carte de post mémorisée | Évite le re-render de toute la liste lors d'un like ou d'un commentaire |
| **loading="lazy" sur les images** | Avatars, images de posts, visuels d'actualités | Images hors viewport non chargées immédiatement |
| **MAX_LIST_ITEMS = 300** | NearbyPeoplePanel plafonne le rendu DOM | Empêche le gel du navigateur avec 10 000+ bots msdev |

### Backend

| Amélioration | Description | Impact |
|---|---|---|
| **Socket.IO perMessageDeflate** | Compression WebSocket activée (seuil 1 Ko) | Réduit la bande passante des messages Socket.IO |
| **Socket.IO httpCompression** | Compression HTTP des réponses long-polling | Réduit la bande passante en polling |
| **Cache `/api/news`** | TTL 60 s en mémoire + header `Cache-Control: public, max-age=60` | Supprime N requêtes identiques par minute ; réduit le CPU |
| **Cache `/api/auth/profile/:id`** | TTL 30 s par paire `(cible, viewer)` + header `Cache-Control: private, max-age=30` | Réduit les lectures DB répétées sur les profils populaires |
| **Invalidation du cache profil** | `PATCH /api/auth/profile` vide le cache du userId modifié | Données toujours fraîches après une mise à jour |
| **Debounce geo/update** | Limite les mises à jour GPS à 1 tous les 4 s par utilisateur | Évite la saturation DB avec des clients très actifs |

---

## 2. Infrastructure nécessaire pour 500 000 utilisateurs simultanés

> Ces changements **ne sont pas implémentés** dans msdev — ils casseraient le mode développement local.
> Ils sont documentés ici pour guider la migration vers la production.

### 2.1 Base de données — remplacer la mémoire vive

L'état actuel (`persist.ts` + JSON) est un magasin **mono-processus en mémoire**.

| Besoin | Solution recommandée | Pourquoi |
|---|---|---|
| Données persistantes et partagées | **PostgreSQL 16+** (RDS Aurora Serverless) | ACID, requêtes relationnelles, scale horizontal en lecture |
| Sessions utilisateurs + tokens JWT | **Redis 7** (ElastiCache) | Sub-milliseconde, TTL natif, pub/sub |
| Cache API distribué | **Redis** (même cluster) | Partagé entre tous les workers Node.js |
| Files d'attente (notifications, emails) | **Redis Streams** ou **BullMQ** | Délestage asynchrone |

Migration clé : remplacer `db.users`, `db.salons`, `db.lives`... par des requêtes PostgreSQL + ORM (Prisma ou Drizzle).

### 2.2 Socket.IO — adapter multi-processus

Un seul processus Node.js ne peut pas tenir 500 000 connexions WebSocket.

```
Architecture cible :
  Load Balancer (sticky sessions)
       ↓
  [Node Worker 1] [Node Worker 2] ... [Node Worker N]
          \              |              /
           ──── Redis Pub/Sub Adapter ────
```

Implémentation :
```ts
// server.ts (production)
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

Paquets : `@socket.io/redis-adapter`, `redis`

### 2.3 Scaling horizontal

| Technologie | Rôle | Capacité cible |
|---|---|---|
| **PM2 cluster** (court terme) | N workers = N CPU cores sur un serveur | ~5 000–20 000 utilisateurs/serveur |
| **Kubernetes** (production) | Autoscaling horizontal (HPA) | Illimité en théorie ; scale-out automatique |
| **NGINX / Caddy** devant Node | Proxy inverse, SSL termination, gzip | Absorbe les pics de trafic |

### 2.4 CDN pour les assets statiques

Le frontend compilé (`/assets/*.js`, images, fonts) doit être servi par un CDN :

- **Cloudflare CDN** ou **AWS CloudFront**
- `Cache-Control: public, max-age=31536000, immutable` sur les chunks hashés
- `Cache-Control: no-store` uniquement sur `index.html`

Impact : 0 requête serveur Node.js pour les assets statiques.

### 2.5 Rate limiting renforcé

| Endpoint | Limite actuelle (msdev) | Limite production recommandée |
|---|---|---|
| `POST /api/auth/login` | 30 req/15 min | 10 req/15 min par IP |
| `POST /api/auth/register` | 30 req/15 min | 5 req/15 min par IP |
| `POST /api/geo/update` | Debounce 4 s/user | 15 req/min/user (via Redis) |
| `GET /api/geo/nearby` | Illimité | 20 req/min/user |
| `POST /api/feed` | Illimité | 60 req/min/user |
| Socket.IO connexions | Illimité | 100 000/worker max |

Outil : `express-rate-limit` + store Redis (`rate-limit-redis`).

### 2.6 Connection pooling (PostgreSQL)

```ts
// Production DB pool
import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,           // max 20 connexions par worker
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});
```

Sans pooling, chaque requête ouvre une connexion PostgreSQL → saturation à ~200 connexions.

### 2.7 Réduction des payloads Socket.IO

Actuellement `sync_playback` envoie l'objet `playbackState` complet. En production :

- Envoyer uniquement le **delta** (champs modifiés) via un diff shallow
- Utiliser `MessagePack` à la place de JSON : `socket.io-msgpack-parser`
- Segmenter les rooms par région géographique pour éviter les broadcasts globaux

### 2.8 Monitoring & observabilité

| Outil | Rôle |
|---|---|
| **Prometheus + Grafana** | Métriques serveur (CPU, RAM, latence, connexions Socket.IO) |
| **Sentry** | Erreurs backend et frontend en temps réel |
| **Datadog APM** | Traces distribuées entre microservices |
| **pg_stat_statements** | Requêtes PostgreSQL lentes |

---

## 3. Checklist de migration production

```
[ ] Migrer persist.ts → PostgreSQL + Prisma/Drizzle
[ ] Ajouter Redis (sessions JWT, cache, pub/sub)
[ ] Configurer @socket.io/redis-adapter
[ ] Déployer derrière NGINX avec sticky sessions
[ ] Activer PM2 cluster (puis Kubernetes à scale)
[ ] Mettre le frontend derrière un CDN (Cloudflare / CloudFront)
[ ] Renforcer rate-limiting via Redis store
[ ] Activer connection pooling PostgreSQL (PgBouncer ou pg.Pool)
[ ] Passer les payloads Socket.IO en delta / MessagePack
[ ] Configurer monitoring (Prometheus, Sentry, Datadog)
[ ] Ajouter health checks + circuit breakers
[ ] Tester en charge (k6, Artillery) jusqu'à 500 000 connexions simultanées
```

---

## 4. Estimation de capacité

| Architecture | Utilisateurs simultanés | Coût mensuel estimé (AWS) |
|---|---|---|
| 1 Node.js + SQLite (actuel msdev) | ~100–500 | — (local) |
| 4 workers PM2 + PostgreSQL RDS | ~10 000–50 000 | ~200–500 €/mois |
| Kubernetes (10 pods) + Redis + Aurora | ~100 000–500 000 | ~2 000–8 000 €/mois |
| Kubernetes (50 pods) + Redis Cluster + Aurora Global | 500 000+ | ~15 000–40 000 €/mois |

---

*Ce document est une référence de planification. L'implémentation effective dépend du volume de trafic réel mesuré en production.*
