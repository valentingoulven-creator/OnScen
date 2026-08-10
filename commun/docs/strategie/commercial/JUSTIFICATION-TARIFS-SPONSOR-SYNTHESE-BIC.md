# Synthèse BIC — Tarifs sponsoring OnScen

**Valentin Goulven · OnScen · getsoundy.com · 3 août 2026**  
Document interne · chiffres indicatifs · recaler avec expert-comptable.

---

## Grille commerciale retenue (HT · forfait / semaine · sans CPM)

| Emplacement | Prix / semaine |
|-------------|----------------|
| Icône Sponso (carte) | **99 €** |
| Onglet Musique | **119 €** |
| Bandeau carte · Reel | **129 €** |
| Fil d'actualité | **149 €** |
| **Packs** Carte 199 € · Actu & Reel 249 € · Musique & Actu 229 € · **Complet 499 €** | |

Pas de facturation au nombre de vues (phase lancement) · badge « Sponsorisé » (DSA).

---

## Charges mensuelles modélisées (bootstrap)

| Poste | € HT / mois |
|-------|-------------|
| Infra (VPS prod + staging, PostgreSQL Scaleway, domaine, S3, variables modération/streaming) | **80 – 200** |
| Pro & outils (compta, juridique amorti, Apple/Google, dev tools) | **130 – 280** |
| Temps fondateur (maintenance, évolutions, ops campagnes sponsor) — **45 €/h** | **1 200 – 1 800** |
| **Total à couvrir (fourchette)** | **≈ 1 400 – 2 300 €** |
| **Référence de travail** | **≈ 2 000 € HT / mois** |

Sources infra : documentation interne OnScen (Scaleway fr-par-2, prod + staging, PG managé).

---

## Point mort commercial

Pour couvrir **~2 000 € HT / mois** avec la grille actuelle :

| Levier | Volume indicatif |
|--------|------------------|
| Mix moyen ~132 € / semaine-emplacement | **≈ 15 – 16** semaines-emplacement / mois |
| Pack Complet 499 € | **≈ 4** packs / mois |
| Objectif business plan M12 | **5 – 8** clients récurrents × **2** semaines-emplacement en moyenne → zone de point mort |

**Coût marginal technique** d’une campagne : **~2 – 8 €** (API sponsors, stockage créa) → marge brute variable élevée ; le seuil dépend surtout du **temps** (paramétrage, conformité, reporting) et des **charges fixes**.

---

## Projection 12 mois

| | M0 – M6 | M7 – M12 (cible) |
|---|---------|------------------|
| Infra totale | 80 – 250 €/mois | 200 – 450 €/mois |
| CA sponsors visé | 0 – 2 000 €/mois | **~3 300 €/mois** (40 k€ ARR) |
| Ratio infra / CA | élevé (investissement) | **< 15 %** |

À l’objectif **40 k€ ARR sponsors**, l’infra reste une fraction du chiffre ; la couverture des coûts devient **soutenable** si le volume commercial est atteint.

---

## Pourquoi ces prix (en 4 points)

1. **≥ coût marginal + ops** : plancher **99 €** (format simple) ; formats premium **149 €** (fil).  
2. **Packs** pour augmenter le panier sans CPM (**199 – 499 €**).  
3. **Alignement marché** : rester **sous** les campagnes Meta/TikTok en CPM, tout en **ne vendant pas** au CPM tant que l’audience n’est pas mesurable.  
4. **Volume modeste** suffit à couvrir le bootstrap (**~15** semaines-emplacement / mois).

---

**Document complet :** `JUSTIFICATION-TARIFS-SPONSOR-ONSCEN.md` (infra détaillée, sensibilité, règles de décision).

*OnScen · Synthèse tarifs sponsor · usage BIC / financement / partenaires*
