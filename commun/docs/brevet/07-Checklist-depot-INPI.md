# Checklist dépôt INPI (France)

> Pour une **demande de brevet national français** — juin 2026  
> Vérifier les tarifs à jour sur [inpi.fr/tarifs](https://www.inpi.fr)

---

## Avant de commencer

- [ ] Recherche d'antériorité réalisée (voir `06-Recherche-antériorité-guide.md`)
- [ ] Consultation CPI / avocat PI effectuée (fortement recommandé)
- [ ] Date de première divulgation publique documentée
- [ ] Décision : **brevet complet** vs **e-Soleau seul**
- [ ] Titulaire identifié (personne physique ou morale)
- [ ] Inventeur(s) identifié(s) — peut différer du titulaire

---

## Option A — e-Soleau (preuve de date uniquement)

| # | Document / action | Statut |
|---|---|---|
| A1 | Compte INPI / e-soleau | [ ] |
| A2 | Fichier à déposer (ZIP ou PDF) : description technique + extraits code | [ ] |
| A3 | Paiement ~15 € | [ ] |
| A4 | Récépissé archivé | [ ] |

**Contenu suggéré pour e-Soleau :** `02-Description-detaillee.md` + extraits `playbackClock.ts`, `salonPlayback.ts`, `useSalonPlaybackSync.ts`

---

## Option B — Demande de brevet INPI

### B1 — Documents obligatoires

| # | Document | Source dans ce dossier | Statut |
|---|---|---|---|
| B1.1 | **Description** | `02-Description-detaillee.md` (réécrit par CPI) | [ ] |
| B1.2 | **Revendications** | `03-Revendications-preliminaires.md` (réécrit par CPI) | [ ] |
| B1.3 | **Abrégé** (≤ 150 mots) | `04-Abrege.md` | [ ] |
| B1.4 | **Figures** (si utiles à la compréhension) | `05-Figures-description.md` → PNG/PDF | [ ] |
| B1.5 | Formulaire de demande (inventeur, titulaire, adresse) | INPI en ligne | [ ] |

### B2 — Documents recommandés

| # | Document | Statut |
|---|---|---|
| B2.1 | Déclaration d'invention | `01-Declaration-invention.md` | [ ] |
| B2.2 | Pouvoir mandataire (si dépôt par CPI) | [ ] |
| B2.3 | Certificat de dépôt pour priorité ultérieure (PCT / étranger) | [ ] |

### B3 — Taxes INPI (ordre de grandeur 2026 — vérifier site)

| Étape | Taxe indicative | Échéance |
|---|---|---|
| Dépôt électronique | ~36 € | À la demande |
| Rapport de recherche (si demandé) | ~520 € | Dans les 20 mois |
| Délivrance | ~90 € | Après examen |
| Annuités (années 3–20) | croissant, ~36 € → ~600 €+ | Chaque année |

**Budget mandataire CPI (rédaction + dépôt) :** 600–2 000 €+ selon complexité.

---

## Informations à préparer pour le formulaire INPI

### Inventeur(s)

```
Nom :
Prénom :
Adresse :
Nationalité :
```

### Titulaire (si différent, ex. société)

```
Dénomination :
SIREN :
Adresse siège :
```

### Titre de l'invention

```
Système de synchronisation d'écoute multimédia multi-clients avec cartographie et relais audiovisuel
```
*(à valider par CPI)*

### Classification technique (indicatif)

- IPC : H04L 65/60, H04L 67/1095, G06F 3/16

---

## Après le dépôt

| # | Action | Délai |
|---|---|---|
| P1 | Recevoir numéro de dépôt et date de priorité | Immédiat |
| P2 | Demander rapport de recherche INPI ou EPO | ≤ 20 mois |
| P3 | Répondre aux objections de l'examinateur | Selon notification |
| P4 | Payer annuités | À partir année 3 |
| P5 | Envisager extension PCT ou brevet européen | **≤ 12 mois** depuis priorité |

---

## Extension internationale (si stratégie le justifie)

| Voie | Délai depuis priorité FR | Coût indicatif |
|---|---|---|
| **PCT** (demande internationale) | 12 mois | 3 000–5 000 €+ |
| **Brevet européen (EPO)** | 12 mois | 5 000–15 000 €+ (validation par pays) |
| **Brevet US** (non-provisoire) | 12 mois | 8 000–15 000 $+ |

---

## Checklist qualité avant envoi

- [ ] Revendications **techniques** (pas « un réseau social musical »)
- [ ] Description permet d'**exécuter** l'invention sans effort excessif
- [ ] Figures numérotées cohérentes avec la description
- [ ] Abrégé ≤ 150 mots
- [ ] Aucun secret commercial indispensable **uniquement** dans le brevet sans stratégie de divulgation
- [ ] Cohérence inventeur / titulaire / contrat de cession (si salarié / cofondateur)

---

## Pièges fréquents

| Piège | Conséquence | Prévention |
|---|---|---|
| Divulgation publique avant dépôt | Rejet pour défaut de nouveauté (UE) | Dépôt ou e-Soleau **avant** lancement |
| Revendications trop larges (« système social ») | Rejet art. 52 CBE | Revendications techniques ciblées |
| Oublier les cofondateurs comme inventeurs | Litige titularité | Accord fondateurs + cession |
| Ne pas payer annuités | Extinction du brevet | Calendrier de paiement |
| Copier-coller ce dossier sans CPI | Revendications non défendables | Relecture professionnelle obligatoire |

---

## Contacts

- **INPI — dépôt en ligne :** https://procedures.inpi.fr
- **e-Soleau :** https://www.inpi.fr/realiser-demarches/proteger-oeuvre/soleau

---

*Checklist indicative — les procédures INPI évoluent ; toujours vérifier sur inpi.fr.*
