# Politique de modération chat — OnScen

Document de référence (CTO / produit / modération). Dernière mise à jour : 2026-08-07.

## Objectif

Assurer des espaces **salon**, **live**, **DM** et **groupes** accueillants pour **tous les artistes** (musique, danse, spectacle…) et leur public, en s’alignant sur les bonnes pratiques des grandes plateformes (Twitch, Instagram, TikTok) **sans prétendre reproduire leurs listes secrètes**.

OnScen combine :

| Couche | Rôle |
|--------|------|
| **Politique plateforme** | Termes bloqués / masqués côté serveur (`commun/backend/src/lib/chatModeration*.ts`) |
| **Normalisation** | Anti-contournement (accents, leetspeak, espaces entre lettres) |
| **Config hôte live** | `LiveChatConfig.blockedTerms` — liste custom par live (max 50 termes) |
| **Env ops** | `CHAT_BLOCKED_TERMS` (virgules) — ajouts sans redéploiement code |
| **Modération humaine** | VIP modérateurs, bans salon/live, suppression de messages, signalements |
| **Médias** | Sightengine sur pièces jointes chat / profil / feed (complément texte) |
| **Rate limit** | `checkChatRateLimit` — anti-flood |

## Catégories (comme Twitch / Meta / TikTok)

Nous ne publions **pas** la liste exhaustive des mots (risque d’évasion + pas de liste officielle chez les concurrents). Les **catégories** appliquées :

1. **Grossièretés (masquage)** — message publié avec astérisques (`***`).
2. **Discrimination / slurs (blocage)** — message **non publié**, erreur utilisateur.
3. **Harcèlement grave / incitation (blocage)** — ex. formulations type « kill yourself », « kys ».
4. **Spam / arnaques (blocage)** — ex. « crypto giveaway », « DM me for… ».
5. **Termes hôte / env (blocage)** — mots ajoutés par le créateur du live ou l’équipe ops.

Le **contexte** reste limité (filtre lexical, pas de LLM) : faux positifs possibles → modération humaine + évolution des listes.

## Comportement technique

- Entrée : `prepareChatText()` dans `sanitizeUserText.ts` (HTML neutralisé puis politique).
- Refus HTTP : `422` sur DM / groupes avec message générique FR.
- Refus socket : événement `chat_message_denied` (salon / live) — affiché dans `ChatPanel` via `sendError`.
- Live : liens / slow mode / abonnés-only restent dans `LiveChatConfig` (inchangés).

## Sécurité & légal

- Listes serveur uniquement — **jamais** exposées via API publique.
- Message de refus **générique** (pas de citation du terme détecté).
- RGPD : contenu chat déjà traité dans la politique de rétention globale ; pas de journalisation du terme bloqué en clair recommandée (audit admin agrégé si besoin futur).
- Pas de conseil juridique : CGU / charte utilisateur doivent renvoyer à cette politique.

## UX

- Mobile-first : erreur inline dans le panneau chat (`sendError`).
- Touch targets conservés sur actions modération existantes.
- i18n : message de refus FR aujourd’hui ; EN à brancher sur `requestLocale` si besoin.

## Évolutions recommandées (backlog)

| Priorité | Item |
|----------|------|
| P1 | UI hôte : champ « mots bloqués » dans config chat live |
| P2 | Termes bloqués **salon** (symétrie live) |
| P3 | Liste admin globale éditable (DB) + audit |
| P3 | API modération texte tierce (Sightengine text ou équivalent) |
| P4 | Signalement chat → file modération admin |

## Handoff dev

Fichiers clés :

- `commun/backend/src/lib/chatModerationPolicy.ts`
- `commun/backend/src/lib/chatModerationTerms.ts`
- `commun/backend/src/lib/chatModerationNormalize.ts`
- `commun/backend/src/lib/sanitizeUserText.ts`
- `commun/backend/src/socket.ts` (salon / live / dm)
- `commun/docs/CHAT-MODERATION-POLICY.md` (ce document)

Tests : `commun/backend/src/lib/chatModerationPolicy.test.ts`
