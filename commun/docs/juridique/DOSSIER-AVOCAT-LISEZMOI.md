# Dossier avocat — application (nom commercial à finaliser)

**Objectif :** regrouper les documents **à faire relire et valider** par un avocat (droit du numérique, RGPD, contrats B2B, monétisation, stores) avant diffusion définitive ou montée en charge commerciale.

> **Avertissement :** contenu **indicatif** et issu de l’équipe produit / technique. Aucun document ne constitue un avis juridique. Les versions **opposables** sont celles publiées in-app après validation et complétion des placeholders (`{{publisherName}}`, SIREN, etc.).

**Format livrable :** PDF uniquement dans `dossier-avocat-a-valider/`  
**Contact interne :** admin@getsoundy.com

---

## Comment utiliser ce dossier (PDF)

1. Lire **00-CHECKLIST-VALIDATION-AVOCAT.pdf** — ordre de revue et priorités.
2. Commencer par **05-audit-et-preparation/RENDEZ-VOUS-AVOCAT.pdf** (fiche RDV + 15 questions).
3. Croiser avec **05-audit-et-preparation/LEGAL_REPORT.pdf** (audit interne juin 2026).
4. Valider les textes **utilisateurs** (`02-documents-utilisateurs/`) puis **monétisation** (`03-monetisation/`), **sponsors** (`01-commercial-sponsors/`), **RGPD entreprise** (`04-rgpd-entreprise/`).
5. Compléter les données éditeur via **06-donnees-editeur/** (templates éditeur LCEN).

---

## Structure (fichiers PDF)

| Dossier | Contenu | Priorité avocat |
|---------|---------|-----------------|
| `01-commercial-sponsors/` | Devis, contrat type, reporting campagnes sponsoring | **Haute** (B2B, CGV annonceurs) |
| `02-documents-utilisateurs/` | CGU, privacy, mentions, cookies, RGPD, API plateformes, licences | **Haute** (LCEN, RGPD, DSA) |
| `03-monetisation/` | Pourboires live, abonnements créateurs, mentions dons | **Haute** (Stripe, fiscalité, formulation « don ») |
| `04-rgpd-entreprise/` | Modèle DPA sous-traitants, modèle AIPD/DPIA | **Moyenne** (art. 28 & 35 RGPD) |
| `05-audit-et-preparation/` | Fiche RDV, comparatif TI/IG, LEGAL_REPORT, extrait TODO légal | **Contexte** |
| `06-donnees-editeur/` | Template données éditeur / hébergeur | **Haute** (mentions légales) |
| `07-annexes-produit/` | One-pager commercial sponsors (tarifs indicatifs) | **Moyenne** |

---

## Régénérer les PDF (équipe produit)

Depuis la racine du dépôt :

```powershell
npm run dossier-avocat --prefix commun/docs/juridique
```

---

## Manques connus (à traiter avec l’avocat)

- **CGV annonceurs standalone** : aujourd’hui intégrées au contrat type sponsor — séparation ou fusion à valider.
- **Comparatif TikTok / Instagram** : voir [`COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md`](./COMPARATIF-JURIDIQUE-TIKTOK-INSTAGRAM.md) — **5 documents in-app ajoutés** (août 2026) : communauté, branded content, publicité, modération/recours, droits d'auteur.
- **IAP Apple / Google** vs Stripe web — voir extrait TODO dans `05-audit-et-preparation/`.
- **Sign in with Apple** si Google OAuth actif sur iOS.
- **CMP cookies** (Stripe.js, YouTube) — voir LEGAL_REPORT LEG-RGPD-001.
- **Placeholder éditeur** : SIREN, adresse, capital, médiateur consommation.

---

*Dossier avocat · Document interne · validation juridique*
