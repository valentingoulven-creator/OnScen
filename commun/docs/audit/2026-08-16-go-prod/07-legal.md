# Phase 7 — Juridique / conformité **technique**

**Date :** 2026-08-16 · **Statut : non prêt** (à valider avocat)  
**L’auteur n’est pas avocat.** Distinguer CONSTAT TECHNIQUE / RISQUE / À VALIDER AVOCAT.

## Matrice

| Sujet | Dans le produit ? | Preuve | Trou | Risque | Action fondateur / avocat |
| ----- | ----------------- | ------ | ---- | ------ | ------------------------- |
| DSA | Partiel (signalement, docs brouillon) | `ReportContentModal`, `MODELE-RAPPORT-TRANSPARENCE-DSA.md`, PDFs dossier | Transparence / délais / recours **non validés** | Amendes DSA si volume | Valider docs + process |
| RGPD | Partiel (code + privacy draft) | `politique-confidentialite.pdf`, cookies CMP, age/geo gates | Base légale, DPO, AIPD signée | CNIL | Avocat + AIPD géo |
| DPA art. 28 | **Modèles seulement** | `dpa-sous-traitants.pdf` | **0 signature** | Transfert / sous-traitance | Signer Scaleway, CF, Stripe, Resend, Sightengine, LiveKit, Sentry |
| Cookies | CMP avant Sentry web | `sentry.ts` + `politique-cookies.pdf` | Natif sans bandeau (volontaire 08-15) | E-privacy | Avocat stores |
| CGU | PDF brouillon | `cgu.pdf` | Checklist ☐ | Inopposable / écart code | Valider vs `ageGates` 13/16/18 |
| Privacy | PDF brouillon | idem | Checklist ☐ | Écart mentions vs code | Idem |
| Mentions | `LEGAL_PUBLISHER_ADDRESS` **présent** prod (nom) | Env + `legalPublisher.ts` | Contenu public **NON VÉRIFIÉ** vs LCEN | LCEN | Relire page mentions live |
| Mineurs | DOB / geo 18 / dons 18 / live **16** | `ageGates.ts` | Grandfathering sans DOB ; live 16 | Pénal / RGPD | Arbitrage 16 vs 18 |
| UGC | Oui (feed, reels, live, musique) | App | Hébergeur vs éditeur non tranché | LCEN / DSA | Avocat |
| Hébergeur / éditeur | Docs internes | `DOSSIER-AVOCAT-LISEZMOI.md` | Pas d’avis | Qualification | Avocat |
| Paiements | Code Stripe ; **off** prod | Flags | Mentions dons vs réalité off | Info trompeuse | Aligner UI / flags |
| IAP | **Non** (403 natif) | `clientPlatform.ts` | Guideline 3.1.1 si store sans IAP | Rejet store | IAP ou pas de store |
| Musique UGC/live | ACRCloud **off** | Env | SACEM / labels **absents** | Contrefaçon | Cadre licence |
| CSAM | Sightengine + hash local + runbook brouillon | `csamHashMatch.ts`, `RUNBOOK-CSAM.md` | PhotoDNA/NCMEC **off** ; runbook **jamais testé** | Pénal | P0-03 + avocat |

## Conclusion autorisée

**Non prêt** — à valider avocat.

Interdit de conclure « l’application est légale ».  
`CHECKLIST-VALIDATION-AVOCAT.md` : **toutes les cases vides**, table RDV vide.
