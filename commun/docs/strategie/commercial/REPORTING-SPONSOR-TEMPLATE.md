# Rapport de campagne — Sponsoring OnScen

> **Modèle indicatif** — rapport de confirmation de diffusion à remettre à l'annonceur en fin de campagne.
> **Phase de lancement :** ce rapport atteste de la **diffusion effective** de l'Annonce (dates, emplacements, preuves visuelles). Il **ne repose pas sur un volume de vues/impressions garanti**, la plateforme étant en construction de son audience. La section analytique (§ "Indicateurs de mesure") reste **optionnelle** et n'est renseignée que si des données sont disponibles.

---

## En-tête

| | |
|---|---|
| **Campagne** | [REF_CAMPAGNE] |
| **Annonceur** | [ANNONCEUR] |
| **Contact** | [CONTACT] · [EMAIL_CONTACT] |
| **Formule** | [ ] Emplacement(s) à l'unité · [ ] Pack [NOM_PACK] · [NOMBRE_SEMAINES] semaine(s) |
| **Période** | du [DATE_DEBUT] au [DATE_FIN] |
| **Zone ciblée** | [ZONE_GEO] |
| **Rapport n°** | [NUMERO_RAPPORT] |
| **Date du rapport** | [DATE_RAPPORT] |
| **Éditeur** | OnScen · [EMAIL_COMMERCIAL] |

---

## Confirmation de diffusion par emplacement

| Emplacement | Code | Semaine(s) | Diffusé | Badge OK | Capture |
|-------------|------|------------|---------|----------|---------|
| Fil d'actualité | `feed_inline` | [SEM_FEED] | [ ] Oui | [ ] | [CAPTURE_FEED] |
| Carte · bandeau | `map_banner` | [SEM_MAP] | [ ] Oui | [ ] | [CAPTURE_MAP] |
| Carte · icône Sponso | `map_sidebar_events` | [SEM_SPO] | [ ] Oui | [ ] | [CAPTURE_SPO] |
| Reel sponsorisé | `reels_sponsored` | [SEM_REEL] | [ ] Oui | [ ] | [CAPTURE_REEL] |
| Onglet Musique | `music_tab` | [SEM_MUSIC] | [ ] Oui | [ ] | [CAPTURE_MUSIC] |

*(Ne garder que les lignes souscrites au contrat.)*

---

## Synthèse campagne

| Élément | Confirmation |
|---------|--------------|
| **Diffusion effective sur la période** | [ ] Oui, sans interruption · [ ] Oui, avec interruption(s) — voir détail |
| **Emplacements souscrits** | [LISTE_EMPLACEMENTS_SOUSCRITS] |
| **Zone géographique respectée** | [ ] Oui · [ ] Écart — voir commentaire |
| **Interruption(s) technique(s)** | [DUREE_INTERRUPTION] *(motif : [MOTIF_INTERRUPTION])* |

**Commentaire :** [SYNTHESE_COMMENTAIRE]

---

## Captures d'écran & preuves visuelles

| # | Emplacement | Description | Fichier / lien |
|---|-------------|--------------|----------------|
| 1 | [EMPLACEMENT_1] | [DESCRIPTION_1] | [CAPTURE_1] |
| 2 | [EMPLACEMENT_2] | [DESCRIPTION_2] | [CAPTURE_2] |
| 3 | [EMPLACEMENT_3] | [DESCRIPTION_3] | [CAPTURE_3] |

*(Joindre captures `SponsorAdPreview` ou screenshots prod datés, par emplacement et par semaine.)*

---

## Calendrier de diffusion

| Semaine | Période | Emplacement(s) actif(s) | Statut |
|---------|---------|--------------------------|--------|
| S1 | [DATE_S1_DEB] – [DATE_S1_FIN] | [EMPLACEMENTS_S1] | [ ] Diffusé |
| S2 | [DATE_S2_DEB] – [DATE_S2_FIN] | [EMPLACEMENTS_S2] | [ ] Diffusé |
| S3 | [DATE_S3_DEB] – [DATE_S3_FIN] | [EMPLACEMENTS_S3] | [ ] Diffusé |
| S4 | [DATE_S4_DEB] – [DATE_S4_FIN] | [EMPLACEMENTS_S4] | [ ] Diffusé |

---

## Indicateurs de mesure *(optionnel — selon disponibilité analytics)*

> Section renseignée uniquement si OnScen dispose d'un volume de trafic suffisant pour produire des statistiques exploitables. **Aucun engagement contractuel n'est attaché à ces chiffres** sur la formule forfaitaire hebdomadaire.

| Indicateur | Valeur (si disponible) |
|------------|--------------------------|
| Impressions constatées | [IMPRESSIONS_TOTALES] |
| Clics CTA constatés | [CLICS_TOTAL] |
| Reach constaté | [REACH_UNIQUE] |

*Définition impression : affichage ≥ 50 % de la durée configurée (`displayDurationSec`, défaut 8 s), lorsque mesurable.*

---

## ROI & indicateurs business *(si données fournies par l'Annonceur)*

| Métrique | Valeur | Source |
|----------|--------|--------|
| Clics trackés (UTM OnScen) | [CLICS_UTM] | `utm_source=soundy&utm_medium=[placement]&utm_campaign=[id]` |
| Visites landing / billetterie | [VISITES_LANDING] | Analytics annonceur |
| Conversions (billets, inscriptions) | [CONVERSIONS] | [SOURCE_CONV] |

> OnScen ne garantit pas de ROI chiffré en phase de lancement. Les conversions downstream dépendent du tracking côté annonceur (UTM, pixels).

---

## Recommandations & renouvellement

### Analyse

- **Point fort :** [POINT_FORT]
- **Axe d'amélioration :** [AXE_AMELIORATION]

### Proposition de renouvellement

| | |
|---|---|
| **Période proposée** | du [DATE_RENEW_DEB] au [DATE_RENEW_FIN] |
| **Emplacements / pack** | [EMPLACEMENTS_OU_PACK_RENEW] |
| **Tarif proposé HT** | **[PRIX_RENEW] €** *(forfait semaine / emplacement ou pack, sans CPM)* |
| **Remise fidélité** | [ ] −10 % engagement 6 mois · [ ] −15 % 12 mois |
| **Validité offre** | [DATE_VALIDITE_OFFRE] |

**Contact renouvellement :** [CONTACT_COMMERCIAL] · [EMAIL_COMMERCIAL] · [TELEPHONE_COMMERCIAL]

---

## Annexes techniques

| Paramètre campagne | Valeur |
|--------------------|--------|
| ID campagne admin | [ID_ADMIN] |
| Placements actifs | [LISTE_PLACEMENTS] |
| `startsAt` / `endsAt` | [TIMESTAMP_DEB] / [TIMESTAMP_FIN] |
| `displayDurationSec` | [DUREE_AFFICHAGE] s |
| Lien CTA | [URL_CTA] |
| Badge | Sponsorisé (`kind: sponsored`) |

---

## Disclaimer

> Rapport de confirmation de diffusion — modèle indicatif. La section analytique est fournie à
> titre informatif uniquement lorsque des données sont disponibles ; elle ne constitue pas un
> engagement contractuel sur la formule forfaitaire hebdomadaire. Document non contractuel ;
> les engagements de diffusion restent ceux du contrat signé (`CONTRAT-TYPE-SPONSOR.md`).

*OnScen · Rapport de campagne sponsor · [DATE_RAPPORT]*
