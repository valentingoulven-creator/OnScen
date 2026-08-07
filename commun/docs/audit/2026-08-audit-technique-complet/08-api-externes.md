# Audit technique Soundy — Phase 8 : API externes

**Date :** 2026-08-07
**Méthode :** inventaire exhaustif via `commun/backend/.env.production.example`, `package.json`, croisement avec `API-1` à `API-10` de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22), vérification du monitoring de quota existant.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

---

## 8.1 Inventaire des API/services tiers utilisés

| Service | Usage | Obligatoire en prod ? |
|---|---|---|
| **Stripe** (+ Stripe Connect) | Paiements, pourboires live, abonnements créateurs | Optionnel (feature flag `DONATIONS_ENABLED`/`SUBSCRIPTIONS_ENABLED`) |
| **Google OAuth / YouTube Data API v3** | Connexion sociale, recherche/import playlists YouTube dans les salons | Optionnel |
| **Facebook Login / Instagram Graph API** | Connexion sociale, liaison compte Instagram | Optionnel |
| **Sign in with Apple** | Connexion sociale (obligatoire côté store iOS si autres SSO proposés) | Optionnel côté backend, requis côté conformité stores |
| **Cloudflare Stream** | Ingest RTMP → HLS/CDN pour les lives à forte audience | Optionnel (fallback WebRTC mesh sinon) |
| **LiveKit Cloud** | Diffusion live WebRTC navigateur (prioritaire sur Cloudflare si les deux configurés) | Optionnel (fallback mesh sinon) |
| **Resend** (+ SMTP fallback) | Envoi d'emails transactionnels (vérification, notifications, alertes admin) | Recommandé prod (port SMTP bloqué par Scaleway) |
| **Web Push (VAPID)** | Notifications navigateur | Optionnel |
| **Firebase Cloud Messaging** | Notifications push natives iOS/Android (Capacitor) | Optionnel mais nécessaire pour push mobile |
| **Sightengine** | Modération NSFW/offensive des uploads UGC | **Recommandé fortement** — sans clé, uploads UGC refusés (fail-closed) |
| **ACRCloud** | Empreinte audio anti-upload de musique commerciale (compositions/reels) | Optionnel — sans clé, scan ignoré (warning au boot) |
| **AWS S3 / Scaleway Object Storage** (S3-compatible) | Stockage objet (sponsors, médias) | Optionnel (fallback disque local) |
| **TURN (coturn self-hosté)** | Relais WebRTC pour le mesh P2P fallback | Auto-hébergé sur le VPS, pas un tiers SaaS |
| **Anthropic / OpenAI** | Agents IA du panneau admin (chat CEO IA + Dev Agent) | Optionnel, admin uniquement |
| **Sentry** | Monitoring d'erreurs (voir Phase 4) | **Obligatoire en prod** (boot bloqué si absent) |

---

## 8.2 Conformité aux conditions d'utilisation

**Constat (hérité, reconfirmé) :**
- **YouTube** : traité en détail en Phase 10 dédiée — synthèse ici : pas de téléchargement/extraction audio, code mort de fallback Piped/Invidious supprimé physiquement du build (`LEG-7 ✅`), attribution/quotas respectés au niveau architecture. App OAuth Google toujours en mode **Testing** non vérifié (`LEG-6`, 🟠 élevé, bloquant pour tout utilisateur non whitelisté).
- **Stripe** : usage conforme (Connect destination charges, webhooks signés, idempotence). Point opérationnel critique distinct : clé de test active en configuration production locale (voir Phase 11 §11.5 et `STR-11`).
- **Sightengine/ACRCloud** : usage conforme à leur documentation d'API (endpoints REST standards), pas de contournement de quota identifié.
- **Cloudflare Stream/LiveKit** : usage standard SDK, pas de reverse engineering identifié.
- **Firebase/Resend/S3** : usage SDK standard.

**Risque global : 🟢 Faible** sur la conformité technique d'usage, à l'exception du point YouTube (traité Phase 10) et Stripe (traité Phase 11).

---

## 8.3 Gestion des clés API (rotation, scoping)

**Constat :**
- Toutes les clés sont injectées via variables d'environnement (`.env`), jamais commitées en clair dans le code applicatif actuel (`HEAD` propre — voir Phase 5 §5.5 pour la nuance sur l'historique Git).
- Recommandation explicite dans les commentaires du fichier d'exemple pour restreindre la clé YouTube Data API à l'IP serveur + au scope YouTube Data API v3 uniquement (`.env.production.example:137`) — bonne pratique documentée, application effective non vérifiable depuis le code (dépend de la config console Google Cloud).
- **Pas de politique de rotation périodique documentée** pour aucune des clés API tierces (Stripe, Sightengine, ACRCloud, LiveKit, Cloudflare) — la rotation ne semble se produire qu'en cas d'incident (ex. fuite suspectée), pas de façon planifiée.
- Identifiants de compte Connect Stripe en clair dans un script versionné (`commun/scripts/stripe-connect-setup.sh`) — reconfirmé (`STR-10`, 🟢 faible, information opérationnelle non-secrète au sens strict).

**Risque : 🟡 Moyen** — l'absence de politique de rotation planifiée est une dette de posture de sécurité classique, à corriger progressivement, pas une vulnérabilité active.

**Recommandation :** définir une politique de rotation (ex. annuelle, ou immédiate en cas de départ d'un collaborateur ayant eu accès) pour l'ensemble des clés API tierces, documentée dans `commun/docs/INFRA-SOUNDY.md`.

---

## 8.4 Gestion des pannes/quotas dépassés

**Constat (hérité, reconfirmé — `API-3`) :**
- **Suivi de quota implémenté** pour ACRCloud/Sightengine : `lib/apiQuotaMonitor.ts` + route admin `/api-quota` — compteur et alerte fonctionnels **au niveau code**.
- **Comportement différencié en cas de panne** selon le service :
  - Sightengine : **fail-closed en production** (upload refusé si API indisponible) — choix cohérent avec un objectif de sécurité de contenu par défaut.
  - ACRCloud : **fail-open par défaut en msdev**, configurable en prod (`ACRCLOUD_FAIL_OPEN`).
  - YouTube Data API : dégradation gracieuse documentée — sans clé, la recherche/import playlist renvoie une erreur explicite mais les hôtes peuvent coller des liens YouTube manuellement (pas de blocage total de la fonctionnalité salon).
- **Point ouvert (`API-3b`, reconfirmé) :** le monitoring de quota ACRCloud est opérationnel côté code, mais `TODO-MANUAL.md` indique que le **compte ACRCloud et les clés en production restent à créer/configurer** — la fonctionnalité de reconnaissance audio pourrait donc être **totalement inactive en production**, indépendamment de la qualité du monitoring.

**Risque : 🟡 Moyen** — bonne architecture de résilience au niveau code, mais un écart config/réalité potentiel sur ACRCloud qui rendrait une fonctionnalité de protection anti-copyright inactive sans que cela soit visible autrement que par une vérification manuelle du panneau admin.

**Recommandation :** clarifier si la reconnaissance audio ACRCloud est un besoin produit actif ; si oui, finaliser l'inscription et la configuration des clés en production (effort faible une fois le compte créé).

---

## 8.5 Coûts à l'échelle

**Constat :**

| Service | Modèle de coût | Risque de dérive à l'échelle |
|---|---|---|
| Sightengine | Facturation au volume de scans (image/vidéo) | 🟡 Moyen — chaque upload UGC déclenche un scan, coût linéaire avec la croissance du volume de contenu |
| ACRCloud | Facturation au volume de scans audio | 🟢 Faible actuellement (fonctionnalité potentiellement inactive, voir §8.4) |
| LiveKit Cloud | Plan Build : 100 participants simultanés max, 5000 min/mois gratuit, au-delà facturation à l'usage | 🟠 Élevé si l'audience live croît significativement — plafond de plan gratuit à surveiller de près, migration vers un plan payant ou self-hosted à anticiper |
| Cloudflare Stream | Facturation au stockage + à la diffusion (minutes) | 🟡 Moyen — linéaire avec le volume de live/VOD |
| Stripe | Frais standards par transaction (% + fixe) | 🟢 Faible (modèle de coût prévisible, proportionnel au volume de paiements) |
| Sentry | Facturation par événement/transaction au-delà du plan gratuit | 🟢 Faible — sampling à 5 % déjà en place pour maîtriser ce risque (Phase 4) |
| Anthropic/OpenAI (agents IA admin) | Facturation au token, usage admin limité | 🟢 Faible (usage interne restreint) |

**Risque global : 🟡 Moyen** — le point de vigilance principal est **LiveKit Cloud** : le plan gratuit actuel (100 participants simultanés) devient rapidement un facteur limitant/coûteux dès qu'un ou plusieurs lives dépassent cette audience simultanée, ce qui est un objectif produit plausible pour une app de live streaming social.

**Recommandation :** modéliser le coût LiveKit/Cloudflare Stream à différents paliers de croissance (ex. 500, 5000, 50000 utilisateurs actifs) avant une campagne d'acquisition significative, pour éviter une surprise budgétaire lors d'un pic viral.

---

## Synthèse des risques — Phase 8

| # | Sujet | Risque | Effort |
|---|---|---|---|
| API-A | Pas de politique de rotation planifiée des clés API tierces | 🟡 Moyen | S (doc + process) |
| API-B | Compte ACRCloud potentiellement non configuré en prod malgré le monitoring prêt | 🟡 Moyen | S (une fois décidé) |
| API-C | Plan gratuit LiveKit Cloud (100 participants) — risque de coût/limite à la croissance | 🟠 Élevé (si succès produit) | M (anticipation budgétaire) |
| API-D | App OAuth Google toujours en mode Testing (bloque YouTube pour utilisateurs non whitelistés) | 🟠 Élevé | L (délai de vérification Google, hors contrôle) |
| API-E | Absence de CDN/WAF devant l'app principale (traité Phase 6) | 🟠 Élevé | M |

*Findings API-1 à API-10 hérités de `commun/docs/audit/AUDIT-CONSOLIDE.md` (2026-07-22), reconfirmés inchangés sauf mention contraire.*
