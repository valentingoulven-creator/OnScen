# Phase 9 — CGU, CGV, politique de confidentialité

**Date :** 2026-08-10  
**Périmètre :** `web/app/src/content/legal/`, `lib/legalDocuments*.ts`, routes `/api/legal`, CMP cookies

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
| Rétention logs | Privacy annonce **12 mois** ; implémentation connexion ~4–5 mois (audit antérieur) | **élevé** | Aligner code ou texte |

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

Documentation **riche** ; écarts **DPA**, **rétention logs**, **cohérence commission dons** (30 % texte vs 50 % env — audit antérieur) à corriger après validation juridique.
