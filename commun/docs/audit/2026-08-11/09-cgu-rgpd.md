# Phase 9 — CGU, CGV, politique de confidentialité

**Date :** 2026-08-10  
**Périmètre :** `web/app/src/content/legal/`, `lib/legalDocuments*.ts`, routes `/api/legal`, CMP cookies

> **🔄 Rafraîchissement 2026-08-11 (soir)** : `commun/msdev/legal-publisher.json` (VPS prod) référençait encore `contact@getsoundy.com` et `productionDomain: getsoundy.com` — corrigé vers `onscen.com` / `admin@onscen.com` (MODIF 1356). Nouveau : e-mail « Votre compte OnScen est activé » ajouté au flux `admin_approval`, et renvoi de l'e-mail de vérification désormais possible (`POST /auth/resend-verification-email`) — améliore l'accès de l'utilisateur bloqué sans email valide.

---

## 9.1 Existence & accessibilité

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| CGU / Privacy / Mentions | Pages in-app + JSON serveur `legalDocumentsApp.json` | faible | Lien footer auth + settings |
| CGV monétisation | Documents créateurs / dons présents | faible | Sync avec Stripe live |
| DSA contact | Point de contact DSA dans mentions | faible | — |

---

## 9.2 Contenu CGU (contenu, modération, sanctions)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Âge minimum | 13+ / 16 UE mentionné dans textes | **moyen** | Aligner avec contrôle technique (phase 11) |
| Contenu interdit | CSAM, haine, etc. — sections détaillées | faible | — |
| Sanctions | Avertissement → ban — décrit | faible | Journaliser décisions admin |
| PI UGC | Licence utilisateur pour hébergement | faible | Revue avocat |

---

## 9.3 RGPD (privacy)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Finalités / bases | Privacy structurée (sous-traitants listés) | faible | — |
| Droits | Export JSON, suppression compte, rectification profil | faible | Tester purge S3 |
| DPO | Contact privacy email ; DPO formel si seuil | **moyen** | Décision juridique |
| DPIA | Document `commun/docs/juridique/` référencé audits antérieurs | faible | Mettre à jour post-live modération |
| DPA sous-traitants | Statut **pending** Scaleway, CF, Stripe, Resend (audit consolidé) | **élevé** | Signer DPA art. 28 |
| ✅ Rétention logs | **Vérifié conforme 2026-08-11** : la référence « 12 mois » d'un audit antérieur est obsolète — `privacy.ts` (§5, « Durées de conservation ») annonce déjà **« 6 mois en production »** pour les logs techniques ; implémentation réelle (`app_diagnostic_logs`, `dataRetention.ts`) = **5 mois** (≤ promesse). Conforme, aucun écart | résolu | — |

---

## 9.4 Cookies & tracking

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Bandeau | CMP `cookieConsent.ts` — Sentry chargé seulement si « tout accepter » | faible | — |
| YouTube embed | Cookies tiers possible — mention privacy | **moyen** | Mode privacy-enhanced youtube-nocookie |
| Stripe | Chargé on-demand checkout | faible | — |

---

## 9.5 Suppression compte & backups

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Suppression | Route auth delete + purge médias documentée | faible | — |
| Backups | Données peuvent persister dans dumps SQL | **moyen** | Politique purge backup + anonymisation |
| Délai | Texte legal délai traitement — vérifier implémentation queue | **moyen** | Job async confirmation email |

---

## 9.6 Synthèse phase 9

Documentation **riche** ; écarts restants **DPA** (contractuel), **cohérence commission dons** (30 % texte vs 50 % env — audit antérieur, à valider juridiquement). **Rétention logs vérifiée conforme le 2026-08-11** (voir ci-dessus).

**Mise à jour 2026-08-11 (soir) :** cohérence domaine légal restaurée (`legal-publisher.json` prod pointait encore vers `getsoundy.com`) ; UX de vérification email complétée (renvoi possible, notification d'activation).
