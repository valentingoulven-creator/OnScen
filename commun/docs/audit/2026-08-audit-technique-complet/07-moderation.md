# Audit technique/légal Soundy — Phase 7 : Modération de contenu (NSFW et au-delà)

**Date :** 2026-08-07
**Méthode :** revue exhaustive de `lib/sightengineConfig.ts`, `sightengineModeration.ts`, `contentModeration.ts`, `chatModerationPolicy.ts`, `chatModerationTerms.ts`, `sanitizeUserText.ts`, `contentReports.ts`, `routes/{stories,feed,reels,auth,dm,chat,legal,adminReports,adminContent}.ts`, `socket.ts`, `commun/docs/juridique/*.md`, `legalDocumentsApp.json`.
**Convention risque :** 🔴 critique · 🟠 élevé · 🟡 moyen · 🟢 faible

> ⚠️ Ce chapitre traite du point le plus sensible juridiquement de l'audit (§7.5-7.6, CSAM). Les constats sont rapportés strictement d'après le code trouvé, sans minimisation ni dramatisation.

---

## 7.1 Modération automatisée des uploads (Sightengine)

**Constat :**

| Élément | Détail |
|---|---|
| Fournisseur | Sightengine (`SIGHTENGINE_API_USER`/`SECRET`) |
| Modèles activés | `nudity-2.1,offensive-2.0` uniquement (`sightengineConfig.ts:36-38`, confirmé par `.env.production.example:259`) |
| Modèles **non activés** | `gore`, `weapon`, `violence`, `face-attributes`/détection mineurs, `text-content` |
| Scores évalués (blocage) | `nudity.sexual_activity`/`sexual_display` ≥ 0,85 ; `nudity.erotica` ≥ 0,92 ; `offensive.prob` ≥ 0,85 |
| Nature du contrôle | **Bloquant a priori** (HTTP 422 avant publication), pas seulement a posteriori |
| Comportement en panne API | **Fail-closed en production** (upload refusé si Sightengine indisponible/non configuré), fail-open en msdev uniquement |
| Limite vidéo | Scan synchrone limité à 60 s (`SIGHTENGINE_VIDEO_SYNC_MAX_SEC`), aligné avec le plafond de durée des reels |

### Surfaces couvertes

| Surface | Scannée ? |
|---|---|
| Stories (image + vidéo) | ✅ |
| Feed (image + vidéo) | ✅ |
| Reels + poster | ✅ |
| Photo de profil/avatar | ✅ |
| Image DM | ✅ |
| Pièce jointe chat salon/live | ✅ |
| **Logos/bannières sponsors** | ❌ **Non scannés** (aucune occurrence Sightengine dans `routes/sponsors.ts`) |

**Risque : 🟠 Élevé** — le périmètre de modèles utilisés (nudité + offensive uniquement) est **plus étroit** que ce que Sightengine propose nativement (pas de détection violence/armes/gore), et les uploads sponsors (contenu géré par l'admin, donc moins prioritaire mais pas nul si un compte sponsor est compromis) échappent totalement au scan.

**Recommandation :** activer au minimum les modèles `gore`/`weapon` sur les surfaces UGC à fort volume (reels, stories) ; étendre le scan aux uploads sponsors par cohérence.

---

## 7.2 Modération en temps réel sur les lives (le point le plus critique techniquement)

**Constat factuel, sans ambiguïté : il n'existe aucune modération automatique du flux vidéo pendant un live.**

- Aucune occurrence de scan Sightengine (image/vidéo) dans `routes/lives.ts` ni dans les fichiers `lib/live*.ts`.
- `lib/liveModeration.ts` couvre uniquement les **droits de modération humaine** (ban, suppression de message par l'hôte/VIP) — pas d'analyse automatique de frames.
- LiveKit et Cloudflare Stream gèrent le **transport** et l'**enregistrement** du flux, pas d'inspection de contenu en pipeline.
- Ce qui existe réellement pendant un live :
  1. Modération du **chat texte** (filtre lexical, voir §7.3).
  2. Modération des **pièces jointes image** du chat live (Sightengine, comme les autres surfaces image).
  3. Modération **humaine** par l'hôte/les VIP (ban, suppression de message en direct).
  4. Modération **admin a posteriori** (blocage/suppression du live après coup, pas en temps réel sur le flux lui-même).
- **Aucun scan a posteriori automatique** de l'enregistrement du live n'a été identifié non plus (seulement des actions admin manuelles).

**Risque : 🔴 Critique** — pour une fonctionnalité de diffusion vidéo en direct ouverte aux utilisateurs, l'absence totale de détection automatique de contenu (nudité, violence, contenu illicite) sur le flux vidéo lui-même est le point le plus exposé de toute la plateforme : un contenu illicite diffusé en direct ne peut être stoppé qu'après signalement humain (spectateur ou hôte) ou action admin manuelle — jamais par un mécanisme technique préventif ou quasi-temps-réel.

**Recommandation :** implémenter un échantillonnage périodique de frames (ex. capture d'une image toutes les N secondes via l'API LiveKit egress ou Cloudflare Stream thumbnail, puis scan Sightengine sur l'échantillon) — solution intermédiaire standard de l'industrie en attendant une solution de scan vidéo continu. Prioriser cette action avant toute croissance significative de l'usage live public.

---

## 7.3 Modération du texte

**Constat :** mécanisme par **liste de termes** (pas d'IA/LLM, choix documenté explicitement dans `commun/docs/CHAT-MODERATION-POLICY.md`) :
- `chatModerationTerms.ts` : listes de termes à masquer, bloquer, et détection de spam.
- `chatModerationPolicy.ts` : orchestration (blocage des insultes graves/spam, masquage des grossièretés).
- `chatModerationNormalize.ts` : normalisation anti-contournement (accents, leetspeak).
- Extensible via variable d'environnement (`CHAT_BLOCKED_TERMS`).

### Couverture par surface

| Surface | Filtre lexical complet | Sanitization HTML seule | Aucun filtre |
|---|---|---|---|
| Chat salon/live (socket) | ✅ | — | — |
| DM / groupes (REST) | ✅ | — | — |
| Bio profil | — | ✅ | — |
| Description événement/feed | — | ✅ | — |
| Commentaires feed | — | ✅ | — |
| **Commentaires reels** | — | — | ❌ **Aucun** (`reels.ts:235-244`, contenu stocké brut) |

**Risque : 🟡 Moyen** — la modération texte est solide sur les canaux de communication temps réel (chat/DM, les plus sensibles pour le harcèlement direct), mais incohérente sur les contenus publics asynchrones (bio, commentaires), avec un **angle mort confirmé sur les commentaires reels** qui ne passent par aucun filtre, ni lexical ni même de sanitization de base.

**Recommandation :** aligner `addReelComment` sur le pipeline `sanitizeUserText`/`prepareChatText` utilisé ailleurs, en priorité (effort faible, risque de contournement simple sinon).

---

## 7.4 Signalement utilisateur (report)

**Constat :**
- Système fonctionnel : `POST /api/legal/reports` (`routes/legal.ts:33-70`), catégories `harassment|illegal|spam|copyright|privacy|other`, cible `salon|live|dm|reel|profile|track`.
- Persistance en fichier JSONL (`contentReports.ts`), pas de table SQL dédiée.
- Option de **blocage automatique** de la cible signalée à la création du report.
- Interface admin de traitement (`adminReports.ts`, `AdminReportsTab.tsx`) : liste, marquage `reviewed`/`dismissed`, suppression.

**Ce qui manque :**
- Pas de **notification automatique** (email/push) à l'équipe admin lors d'un nouveau signalement — dépendance à une consultation manuelle périodique du panneau admin.
- Pas de **SLA/délai de traitement instrumenté** dans le code — les mentions de délais (« 24h », « 7 jours ») sont uniquement déclaratives dans les textes légaux (`legalDocumentsApp.json`), pas appliquées/mesurées techniquement.
- Pas d'**escalade automatique** pour la catégorie `illegal` (traitée avec la même priorité par défaut que `spam`).

**Risque : 🟠 Élevé** — un signalement pour contenu illégal grave n'est techniquement pas différencié d'un signalement pour spam avant intervention humaine ; en l'absence de notification automatique, le délai réel de traitement dépend entièrement de la vigilance manuelle de l'équipe admin, sans garde-fou technique.

**Recommandation :** notification email/push immédiate à l'équipe admin pour la catégorie `illegal` (et en particulier tout signalement suggérant du contenu impliquant des mineurs, voir §7.5) ; ajouter un champ `priority`/SLA calculé automatiquement selon la catégorie.

---

## 7.5 Escalade vers modération humaine

**Constat :**
- Outils existants : `AdminReportsTab` (signalements), `AdminContentTab` (blocage/suppression salons/lives/events/reels), modération host/VIP en live.
- **Absence d'une file dédiée pour les cas ambigus détectés automatiquement** : l'évaluation Sightengine est **binaire** (`allow`/`deny`, `sightengineModeration.ts:50-89`) — il n'existe pas de statut intermédiaire `needs_review` pour les scores proches du seuil, qui seraient les cas les plus pertinents à faire trancher par un humain plutôt que par un seuil fixe.

**Risque : 🟡 Moyen** — le mécanisme actuel (tout-ou-rien) maximise soit les faux positifs (rejet de contenu légitime proche du seuil) soit les faux négatifs (contenu limite juste sous le seuil accepté sans revue), sans capitaliser sur le signal du score pour prioriser une revue humaine ciblée.

**Recommandation :** introduire une zone grise (ex. score entre 0,7 et le seuil de rejet) qui publie le contenu mais l'ajoute à une file de revue admin prioritaire, plutôt qu'un simple allow/deny.

---

## 7.6 CSAM — Point légal critique

**Constat factuel (recherche exhaustive du dépôt entier — code + documentation) :**

### Ce qui existe : uniquement déclaratif/politique produit

| Élément | Nature |
|---|---|
| Tolérance zéro CSAM affirmée dans les CGU/politique mineurs | Texte légal (`legalDocumentsApp.json`) |
| Mention de « coopération PHAROS » | Phrase générique dans les mentions légales |
| Community guidelines interdisant le CSAM | Texte déclaratif |
| Délai de traitement « 24h » pour signalement grave | Texte déclaratif, non instrumenté techniquement |

Le dossier juridique interne du projet **admet lui-même** ce trou, noir sur blanc : « Procédure autorités / PHAROS **non documentée** » et « Law enforcement guidelines : **Absent** » (`commun/docs/juridique/COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md`), avec une question ouverte à l'avocat sur ce point précis (`RENDEZ-VOUS-AVOCAT.md`).

### Ce qui n'existe PAS (vérifié, absent du code et de toute procédure opérationnelle documentée)

| Élément attendu | Présent ? |
|---|---|
| Détection technique spécifique CSAM (au-delà de la nudité générique) | **Non** |
| Hash-matching type PhotoDNA / PDQ / base de hachages CSAM connus | **Non** |
| Intégration avec NCMEC CyberTipline (API/webhook) | **Non** |
| Intégration avec la plateforme PHAROS (France) | **Non** |
| Runbook opérationnel exécutable (« si CSAM détecté → préserver les preuves → notifier les autorités ») | **Non** — seulement un texte légal destiné à l'utilisateur, pas une procédure interne pour l'équipe |
| Catégorie de signalement dédiée « CSAM »/mineur en danger (distincte de `illegal` générique) | **Non** |
| Conservation forensique automatique post-signalement d'un contenu suspect | **Non** |

### Sightengine — capacité native non exploitée

Sightengine propose commercialement une détection d'âge/mineur (modèle `face-attributes`/estimation d'âge sur les visages détectés), utilisable en complément de la nudité pour flaguer une combinaison « personne mineure + contenu suggestif ». **Soundy n'appelle que `nudity-2.1,offensive-2.0`** — le modèle de détection de mineurs n'est **pas activé**, et même s'il l'était par accident, `evaluateSightenginePayload` ne lit que les champs `nudity`/`offensive` et ignorerait un score de détection de mineur.

**Conclusion factuelle (sans minimisation ni exagération) :** Soundy dispose d'une politique déclarative CSAM, d'un signalement utilisateur générique, et d'une modération NSFW générique. Il n'existe **aucune détection technique spécifique au CSAM**, ni **aucun processus automatisé ou runbook opérationnel de signalement aux autorités compétentes** (PHAROS en France, NCMEC si opération aux USA). L'écart entre l'engagement écrit (« signalement immédiat aux autorités ») et l'implémentation réelle est **matériel et non ambigu**.

**Risque : 🔴 CRITIQUE** — c'est le point de risque légal et réputationnel le plus élevé de l'ensemble de cet audit, pour une plateforme qui héberge de l'upload de médias par des utilisateurs et du live streaming ouvert.

**Recommandation (priorité absolue) :**
1. Activer le modèle de détection de mineurs Sightengine (`face-attributes` ou équivalent) en complément de `nudity-2.1` sur toutes les surfaces d'upload UGC, et bloquer/flaguer automatiquement toute combinaison à risque pour revue humaine immédiate.
2. Créer une catégorie de signalement dédiée « contenu impliquant potentiellement un mineur » avec notification admin **immédiate** (pas de traitement différé).
3. Rédiger un runbook opérationnel interne (indépendant du texte légal utilisateur) : que fait l'équipe concrètement à la réception d'un signalement CSAM — préservation des preuves (ne pas supprimer avant signalement), contact PHAROS (https://www.internet-signalement.gouv.fr/), contact NCMEC CyberTipline si applicable, délai.
4. Étudier l'intégration d'un service de hash-matching reconnu (PhotoDNA via Microsoft PhotoDNA Cloud Service, ou Thorn Safer, ou l'API de hash-matching de NCMEC) — c'est un standard de facto pour toute plateforme UGC à cette échelle.
5. Faire trancher ce point en priorité absolue lors du rendez-vous avocat déjà planifié (`RENDEZ-VOUS-AVOCAT.md`).

---

## Synthèse des risques — Phase 7

| # | Sujet | Risque | Effort |
|---|---|---|---|
| MOD-1 | Modèles Sightengine limités à nudité/offensive (pas gore/weapon) | 🟠 Élevé | S (config) |
| MOD-2 | Uploads sponsors non scannés | 🟡 Moyen | S |
| MOD-3 | **Aucune modération automatique du flux vidéo live** | 🔴 Critique | M (échantillonnage périodique) |
| MOD-4 | Commentaires reels sans aucun filtre (ni lexical ni sanitization) | 🟡 Moyen | S |
| MOD-5 | Pas de notification auto à l'équipe admin lors d'un signalement | 🟠 Élevé | S |
| MOD-6 | Pas de SLA instrumenté / escalade auto catégorie `illegal` | 🟠 Élevé | S/M |
| MOD-7 | Pas de file « ambigu » pour les scores NSFW proches du seuil | 🟡 Moyen | M |
| **MOD-8** | **Aucune détection CSAM dédiée, aucun runbook PHAROS/NCMEC opérationnel** | 🔴 **Critique** | **M** (détection) **+ décision juridique** |
