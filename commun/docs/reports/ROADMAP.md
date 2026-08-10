# ROADMAP PRODUIT — OnScen / OnScen
**Date :** 2026-06-22  
**Version de référence :** MODIF 590  
**Contexte :** Roadmap basée sur l'audit complet du 2026-06-22  
**Horizon :** 18 mois

---

## POSITIONNEMENT

OnScen est un **hybride unique** : salons d'écoute YouTube géolocalisés + plateforme de live streaming musicale. Ce positionnement n'existe nulle part ailleurs. La roadmap doit :

1. **Résoudre les blocages actuels** (légal, scalabilité, bugs critiques)
2. **Consolider l'USP** (salons + géo + live = trio différenciateur)
3. **Rattraper les standards** (TikTok Live, Instagram Live, Twitch sur les fonctionnalités core)
4. **Innover** sur le terrain musical (personne d'autre ne le fait aussi bien)

---

## RÉSUMÉ EXÉCUTIF

| Phase | Nom | Durée | Priorité principale |
|-------|-----|-------|-------------------|
| **Pré-MVP** | Stabilisation & Conformité | M0-M1 | Blocker légaux + bugs critiques |
| **MVP** | Fondations solides | M1-M3 | Scalabilité + navigation + live stable |
| **V1** | Expérience live complète | M3-M6 | Live premium + engagement + VOD |
| **V2** | Croissance & monétisation | M6-M12 | Salons next-gen + découverte + revenus |
| **V3** | Innovation & leadership | M12-M18 | IA musicale + co-host + expansion |

---

## PRÉ-MVP — Stabilisation & Conformité (Mois 0-1)

> **Objectif :** Éteindre les incendies légaux et techniques bloquants avant tout.  
> **Condition de sortie :** 0 bloqueur critique en audit, live stable à 100 viewers.

### Fonctionnalités

| ID | Fonctionnalité | Priorité | Difficulté | Impact utilisateur | Impact business |
|----|---------------|----------|----------|------------------|----------------|
| PM-01 | Retirer pubs sponsor dans salons YouTube | 🔴 Critique | Facile (1j) | Aucun | Évite suspension API |
| PM-02 | Protéger `ALLOW_YOUTUBE_REMOTE_FALLBACK` en dur | 🔴 Critique | Trivial (1h) | Aucun | Évite violation TOS |
| PM-03 | Routes `/api/msdev/*` hard-blocked en production | 🔴 Critique | Facile (2h) | Aucun | Sécurité critique |
| PM-04 | Fix: WebRTC viewer > 30 → fallback LiveKit auto | 🔴 Critique | Moyen (3j) | Élevé | Live fiable |
| PM-05 | Fix: Message d'erreur explicite si pas de flux vidéo | 🔴 Critique | Facile (1j) | Élevé | UX live |
| PM-06 | Bannière cookies / CMP (Stripe, YouTube iframes) | 🔴 Critique | Moyen (3j) | Faible | RGPD conforme |
| PM-07 | Fix: `AbortController` dans `api.ts` | 🟠 Majeur | Moyen (2j) | Moyen | Stabilité |
| PM-08 | Labelliser "Sponsorisé" sur toutes les pubs | 🟠 Majeur | Facile (1j) | Faible | DSA conforme |
| PM-09 | Point de contact DSA dans les mentions légales | 🟠 Majeur | Trivial | Aucun | DSA conforme |
| PM-10 | Demander augmentation quota YouTube API | 🟠 Majeur | Admin (1j) | Élevé | Quota suffisant |

### Quick Wins (< 1 jour chacun)

- [ ] Fix BUG-012 : désactiver bouton login pendant chargement
- [ ] Supprimer `react-router-dom` des dépendances si non utilisé
- [ ] Vérifier `MSDEV_DEMO_PASSWORD` ne fuite pas en logs prod
- [ ] Ajouter `rel="noopener noreferrer"` sur tous les liens externes
- [ ] Vérifier `href` dans `LinkifiedText` n'autorise que `http://` et `https://`

---

## MVP — Fondations solides (Mois 1-3)

> **Objectif :** Application utilisable et scalable. Navigation par URL, live stable, base de tests.  
> **KPI cible :** 1 000 users actifs, 0 crash critique, live à 500 viewers.

### Pilier 1 : Navigation & Routing

| ID | Fonctionnalité | Difficulté | Impact |
|----|---------------|----------|--------|
| MVP-NAV-01 | **Migration React Router** — URLs canoniques pour live/salon/profile/reels | Élevée (5j) | Critique |
| MVP-NAV-02 | Deep links fonctionnels (`/live/:id`, `/salon/:id`, `/u/:username`) | Moyen (2j) | Élevé |
| MVP-NAV-03 | Bouton Retour navigateur natif fonctionnel | Moyen (2j) | Élevé |
| MVP-NAV-04 | Partage d'URL directe vers un live/salon en cours | Facile (1j) | Élevé |

### Pilier 2 : Live Streaming Stable

| ID | Fonctionnalité | Difficulté | Impact |
|----|---------------|----------|--------|
| MVP-LIVE-01 | **Auto-switch LiveKit SFU** dès > 10 viewers (supprime limite 30) | Élevée (4j) | Critique |
| MVP-LIVE-02 | **VOD automatique** via Cloudflare Stream + page replay | Élevée (5j) | Élevé |
| MVP-LIVE-03 | Reconnexion socket live gracieuse (backfill derniers messages) | Moyen (3j) | Élevé |
| MVP-LIVE-04 | Démarrage live en 1 tap (préfs mémorisées, skip si déjà accepté) | Moyen (2j) | Élevé |
| MVP-LIVE-05 | Chat live persisté en BDD (historique accessible après arrêt) | Moyen (3j) | Moyen |
| MVP-LIVE-06 | Notifications push "Host a démarré un live" aux followers | Facile (2j) | Élevé |

### Pilier 3 : Scalabilité Backend

| ID | Fonctionnalité | Difficulté | Impact |
|----|---------------|----------|--------|
| MVP-SCALE-01 | **Socket.io Redis adapter** (multi-instance) | Élevée (3j) | Critique |
| MVP-SCALE-02 | **Cache Redis** pour YouTube API, sessions, présence | Élevée (4j) | Élevé |
| MVP-SCALE-03 | Logging structuré Pino + intégration Sentry | Moyen (2j) | Élevé |
| MVP-SCALE-04 | Purge automatique données expirées (RGPD) | Moyen (3j) | Moyen |

### Pilier 4 : Qualité & Tests

| ID | Fonctionnalité | Difficulté | Impact |
|----|---------------|----------|--------|
| MVP-TEST-01 | Pipeline CI (GitHub Actions) — lint + tests sur PR | Moyen (2j) | Élevé |
| MVP-TEST-02 | Tests Vitest : coverage 40% sur lib/hooks critiques | Moyen (5j) | Élevé |
| MVP-TEST-03 | Tests Playwright E2E : auth, salon, live start/stop | Élevée (5j) | Élevé |
| MVP-TEST-04 | Skeleton loaders sur toutes les pages principales | Facile (3j) | Moyen |

### Pilier 5 : Performance

| ID | Fonctionnalité | Difficulté | Impact |
|----|---------------|----------|--------|
| MVP-PERF-01 | **Virtualisation listes** (TanStack Virtual) : reels, chat, DM | Moyen (4j) | Élevé |
| MVP-PERF-02 | Upload multipart/form-data (remplace base64 JSON) | Élevée (4j) | Moyen |
| MVP-PERF-03 | `heic2any` chargé à la demande uniquement (lazy) | Facile (1j) | Moyen |

### Pilier 6 : Conformité App Store

| ID | Action | Difficulté | Impact |
|----|--------|----------|--------|
| MVP-STORE-01 | Apple IAP pour abonnements iOS **OU** désactivation sur iOS | Très élevée (7j) | Critique |
| MVP-STORE-02 | Google Play Billing pour abonnements Android **OU** désactivation | Très élevée (7j) | Critique |
| MVP-STORE-03 | App Privacy Labels Apple remplis | Admin (1j) | Élevé |
| MVP-STORE-04 | Data Safety Section Google Play remplie | Admin (1j) | Élevé |

---

## V1 — Expérience Live Complète (Mois 3-6)

> **Objectif :** Rattraper TikTok Live / Instagram Live sur les fonctionnalités d'engagement.  
> **KPI cible :** 5 000 users actifs, live à 1 000 viewers, 3 créateurs monétisés.

### Live — Engagement & Interactions

| ID | Fonctionnalité | Priorité | Difficulté | Concurrent |
|----|---------------|----------|----------|-----------|
| V1-LIVE-01 | **Réactions flottantes** en overlay (emoji fly-up) | 🔥 | Facile (2j) | TikTok ✅ |
| V1-LIVE-02 | **Sondages / Polls** temps réel pendant un live | 🔥 | Moyen (4j) | TikTok/Twitch ✅ |
| V1-LIVE-03 | **Épinglage de message** dans le chat live | 📌 | Facile (2j) | Twitch ✅ |
| V1-LIVE-04 | **Paliers de dons suggérés** (1€, 5€, 10€, 20€) | 📌 | Facile (1j) | TikTok ✅ |
| V1-LIVE-05 | **Mode questions/réponses** (les viewers soumettent des Qs) | 📌 | Moyen (4j) | TikTok/Instagram ✅ |
| V1-LIVE-06 | **Co-host** — inviter un viewer sur scène (vidéo split) | 🌟 | Très élevée (10j) | TikTok/Instagram ✅ |
| V1-LIVE-07 | **Clips** — le host peut cliper les 60 dernières secondes | 🌟 | Élevée (5j) | Twitch ✅ |
| V1-LIVE-08 | VOD replay avec timeline (moments clés = dons, réactions) | 🌟 | Élevée (7j) | Twitch ✅ |

### Live — Host Dashboard

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V1-DASH-01 | Stats temps réel améliorées (revenus en direct, top donateurs) | 📌 | Moyen (3j) |
| V1-DASH-02 | Alerte "gros don" animée sur l'écran host | 📌 | Facile (2j) |
| V1-DASH-03 | Modération IA basique (filtre mots interdits auto) | 📌 | Moyen (4j) |
| V1-DASH-04 | Catégorisation du live (Musique, Gaming, Talk, etc.) | 📌 | Facile (1j) |
| V1-DASH-05 | Titre et thumbnail du live éditables en cours | 📌 | Facile (2j) |

### Salons — Améliorations

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V1-SAL-01 | Salon collaboratif — plusieurs hosts peuvent gérer la queue | 🔥 | Moyen (4j) |
| V1-SAL-02 | Historique d'écoute du salon (quelles chansons ont été jouées) | 📌 | Facile (2j) |
| V1-SAL-03 | Suggestions IA dans la queue (basé sur ce qui a été joué) | 🌟 | Élevée (7j) |
| V1-SAL-04 | Réactions en temps réel sur les chansons (likes en overlay) | 📌 | Facile (2j) |
| V1-SAL-05 | Salon éphémère (auto-fermé après X heures) | 💡 | Facile (1j) |

### Discovery & Social

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V1-SOC-01 | **Page Explore** — lives en cours recommandés | 🔥 | Moyen (4j) |
| V1-SOC-02 | Profil public optimisé (mini-player compositions, stats) | 📌 | Moyen (3j) |
| V1-SOC-03 | Notifications améliorées (résumé quotidien, digest) | 📌 | Moyen (3j) |
| V1-SOC-04 | Share live vers Instagram/TikTok (preview video 15s) | 🌟 | Élevée (5j) |

---

## V2 — Croissance & Monétisation (Mois 6-12)

> **Objectif :** Moteur de croissance autonome. La plateforme attire et retient sans acquisition payante.  
> **KPI cible :** 25 000 users actifs, 50 créateurs monétisés, MRR positif.

### Monétisation créateurs

| ID | Fonctionnalité | Priorité | Difficulté | Impact business |
|----|---------------|----------|----------|----------------|
| V2-MON-01 | **Programme créateurs certifiés** (badge, visibilité boostée) | 🔥 | Moyen (5j) | Élevé |
| V2-MON-02 | **Partage des revenus publicitaires** (créateurs > X followers) | 🌟 | Très élevée (15j) | Très élevé |
| V2-MON-03 | **Boutique virtuelle** — merch numérique du créateur (wallpapers, samples) | 🌟 | Élevée (10j) | Élevé |
| V2-MON-04 | **Live exclusif payant** (accès salon/live premium) | 🌟 | Élevée (10j) | Élevé |
| V2-MON-05 | Analytics créateurs avancées (rétention, pic d'engagement) | 📌 | Moyen (5j) | Moyen |

### Découverte & Algorithme

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V2-DISC-01 | **Feed personnalisé** basé sur genres, artistes, historique | 🔥 | Élevée (10j) |
| V2-DISC-02 | **Trending lives** global + par genre + par pays | 🔥 | Moyen (4j) |
| V2-DISC-03 | **Carte globale animée** — lives en cours sur le globe 3D | 💡 | Moyen (4j) |
| V2-DISC-04 | **Recherche unifiée** (users, salons, lives, reels, artistes) | 📌 | Élevée (7j) |
| V2-DISC-05 | **Page artiste** — tous les salons/lives autour d'un artiste | 💡 | Moyen (5j) |

### Salons Next-Gen

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V2-SAL-01 | **Salon musical live** — host diffuse en live ET joue YouTube en sync | 🌟 | Très élevée (15j) |
| V2-SAL-02 | **Apple Music integration** (si accès API) | 💡 | Élevée (7j) |
| V2-SAL-03 | Playlist collaborative (tous les membres proposent en temps réel) | 🔥 | Moyen (5j) |
| V2-SAL-04 | Salon géolocalisé sur carte en temps réel (position du salon sur la carte) | 📌 | Facile (2j) |
| V2-SAL-05 | Replays de salons (ce qui a été joué, dans quel ordre) | 💡 | Moyen (4j) |

### Infrastructure

| ID | Fonctionnalité | Priorité | Difficulté |
|----|---------------|----------|----------|
| V2-INF-01 | CDN pour uploads (compositions, photos) | 🔥 | Moyen (3j) |
| V2-INF-02 | Transcoding audio compositions (MP3 → HQ + preview) | 📌 | Élevée (7j) |
| V2-INF-03 | Multi-région (EU + US) | 🌟 | Très élevée (20j) |
| V2-INF-04 | Audit de sécurité par un pentest externe | 🔥 | Externe | Moyen |

---

## V3 — Innovation & Leadership (Mois 12-18)

> **Objectif :** Devenir LA référence du live musical en ligne. Fonctionnalités qui n'existent pas encore.  
> **KPI cible :** 100 000 users actifs, 200 créateurs monétisés.

### IA Musicale

| ID | Fonctionnalité | Type | Impact |
|----|---------------|------|--------|
| V3-AI-01 | **DJ IA** — génère une playlist cohérente pour un salon selon le mood | Innovation | Très élevé |
| V3-AI-02 | **Clips automatiques** — IA détecte les moments forts du live (pic dons, réactions) | Innovation | Élevé |
| V3-AI-03 | **Transcription live** en temps réel (sous-titres accessibilité) | Recommandé | Moyen |
| V3-AI-04 | **Modération IA** des contenus live (vision artificielle) | Recommandé | Élevé |
| V3-AI-05 | **Recommandation IA** d'artistes à écouter dans le salon | Innovation | Élevé |

### Live Premium

| ID | Fonctionnalité | Type | Impact |
|----|---------------|------|--------|
| V3-LIVE-01 | **Multi-cam** — host peut switcher entre plusieurs caméras | Recommandé | Élevé |
| V3-LIVE-02 | **Screen share** — partage d'écran pendant un live | Recommandé | Moyen |
| V3-LIVE-03 | **Karaoké live** — paroles synchronisées sur le live | Innovation | Élevé |
| V3-LIVE-04 | **Spatial audio** — son 3D pour les salons multi-participants | Innovation | Élevé |
| V3-LIVE-05 | **Studio virtuel** — arrière-plans AR pendant un live | Recommandé | Élevé |

### Expansion Plateforme

| ID | Fonctionnalité | Type | Impact |
|----|---------------|------|--------|
| V3-EXP-01 | **API publique** — les créateurs peuvent intégrer OnScen | Innovation | Très élevé |
| V3-EXP-02 | **SDK embed** — un salon OnScen embarquable sur un site tiers | Innovation | Élevé |
| V3-EXP-03 | **Programme partenaires label** — accès catalogue | Innovation | Très élevé |
| V3-EXP-04 | **Desktop app** (Electron ou PWA Desktop améliorée) | Recommandé | Moyen |
| V3-EXP-05 | **TV / Cast** — projeter un salon sur une TV | Innovation | Moyen |

---

## BACKLOG FONCTIONNEL COMPLET

### Indispensable (pour rivaliser avec TikTok Live)

- [ ] VOD replay des lives
- [ ] Réactions flottantes en live
- [ ] Sondages/polls en live
- [ ] Co-host / invité sur scène
- [ ] URLs directes partageables
- [ ] Clips de moments forts
- [ ] Filtres/effets caméra basiques
- [ ] QR Code d'invitation au live
- [ ] Partage sur réseaux sociaux depuis le live

### Recommandé (pour rivaliser avec Instagram Live)

- [ ] Lives programmés (annonce + rappel push)
- [ ] Mode "Question à l'host" (viewers soumettent questions)
- [ ] Statistiques détaillées post-live
- [ ] Bouton de follow depuis le live
- [ ] Titre du live modifiable en cours
- [ ] Timer/compte à rebours dans le live
- [ ] Mode portrait/paysage adaptatif

### Recommandé (pour rivaliser avec Twitch)

- [ ] Panneaux hôte personnalisables
- [ ] Emotes / badges d'abonnés personnalisés
- [ ] Hype Train (compteur d'engagement collectif)
- [ ] Raid (envoyer ses viewers vers un autre live)
- [ ] Catégorisation live (Musique > Genre > Artiste)
- [ ] Dashboard analytics temps réel avancé
- [ ] Extensions/widgets OBS avancés

### Innovation (unique à OnScen)

- [ ] Salon planétaire — voir en temps réel les salons qui écoutent le même artiste
- [ ] Mode "Disco géo" — salons autour de soi sur la carte, rejoindre en 1 tap
- [ ] Battle musical — deux DJs s'affrontent, le chat vote
- [ ] Midnight Radio — live automatisé non-stop par IA selon le genre préféré
- [ ] Collaboration studio live — host et invité jouent de la musique ensemble

---

## MÉTRIQUES DE SUCCÈS PAR PHASE

| Phase | DAU Cible | Lives/jour | Rétention J7 | MRR |
|-------|-----------|-----------|--------------|-----|
| Pré-MVP | Interne | 5 | — | 0 |
| MVP | 1 000 | 20 | 20% | 0 |
| V1 | 5 000 | 100 | 30% | 500€ |
| V2 | 25 000 | 500 | 40% | 5 000€ |
| V3 | 100 000 | 2 000 | 50% | 25 000€ |

---

## POSITIONNEMENT FACE AUX CONCURRENTS

| Dimension | TikTok Live | Instagram Live | Twitch | **OnScen** |
|-----------|-------------|----------------|--------|-----------|
| Audience musicale | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Salons YouTube | ❌ | ❌ | ❌ | ⭐⭐⭐⭐⭐ |
| Géolocalisation | ⭐ | ⭐ | ❌ | ⭐⭐⭐⭐⭐ |
| Outils live | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ (actuel) → ⭐⭐⭐⭐ (V1) |
| Monétisation créateurs | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ (actuel) → ⭐⭐⭐⭐ (V2) |
| Découverte | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ (actuel) → ⭐⭐⭐⭐ (V2) |
| Communauté musicale niche | ⭐⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

**Verdict :** OnScen est actuellement à ~25% du niveau des leaders sur les fonctionnalités live core, mais possède un USP incomparable sur les salons géolocalisés. La roadmap V1 permet d'atteindre 70% de parité fonctionnelle tout en conservant et amplifiant cet avantage différentiel.

---

## RÉSUMÉ DES QUICK WINS (< 3 jours chacun, impact immédiat)

| Quick Win | Effort | Impact |
|-----------|--------|--------|
| 1. URL partageable live/salon | 1j | ★★★★★ |
| 2. Réactions flottantes live | 2j | ★★★★★ |
| 3. Démarrage live en 1 tap (prefs mémorisées) | 2j | ★★★★ |
| 4. Désactiver pubs sponsor dans salons YouTube | 1j | ★★★★ (légal) |
| 5. Message viewer > 30 → "Passe en LiveKit" | 1j | ★★★★ |
| 6. Skeleton loaders pages principales | 3j | ★★★ |
| 7. Paliers de dons suggérés pendant live | 1j | ★★★★ |
| 8. Épinglage message chat live | 2j | ★★★ |
| 9. Notif push "Live démarré" aux followers | 2j | ★★★★ |
| 10. Logs structurés + Sentry | 2j | ★★★ (ops) |

---

*Roadmap vivante — à réviser à chaque sprint. Prochaine révision recommandée : fin du Pré-MVP (M+1).*  
*Générée le 2026-06-22.*
