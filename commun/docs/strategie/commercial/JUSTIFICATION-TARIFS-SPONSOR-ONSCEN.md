# Justification des tarifs sponsoring OnScen

**Document interne — OnScen (onscen.com)**  
**Auteur :** analyse CTO / produit · **Date :** 3 août 2026  
**Public :** fondateur (BIC, banque, partenaires, avocat/comptable) · **Statut :** indicatif — chiffres à recaler trimestriellement avec la comptabilité réelle.

> **Objet :** expliquer **pourquoi** la grille commerciale retenue (forfait **/ semaine / emplacement**, sans CPM) est cohérente avec les **coûts réels** (infra, outils, temps de développement et d’exploitation) et **à partir de quel volume** elle couvre l’ensemble des charges de l’activité.

---

## 1. Synthèse exécutive

| Élément | Conclusion |
|---------|------------|
| **Grille retenue** | 99 – 149 € HT / semaine / emplacement · packs 199 – 499 € HT / semaine |
| **Coût marginal d’une campagne** | Très faible (≈ 2 – 8 € HT en infra + API) → **marge brute variable élevée** |
| **Coût complet (charges fixes + temps)** | Nécessite un **volume commercial** : environ **12 à 16 « semaines-emplacement » facturées / mois** (ou **4 packs Complet / mois**) pour couvrir un scénario bootstrap ~**2 000 € HT / mois** de charges totales |
| **Logique prix** | Chaque tarif **≥ coût marginal + quote-part ops + plancher de marge** ; les formats à plus forte charge créative / visibilité (fil, reel) sont **plus chers** que l’icône carte |
| **Phase lancement** | Pas de CPM : impossible de garantir un volume de vues ; le prix fixe **protège l’éditeur** tout en restant **40 – 70 % sous le milieu de marché** (Meta / TikTok) en équivalent « inventaire premium vertical » |

**Sources techniques :** [`commun/docs/INFRA-ONSCEN.md`](../../INFRA-ONSCEN.md) · [`commun/docs/STACK-CIBLE.md`](../../STACK-CIBLE.md) · grille commerciale [`MODELE-DEVIS-SPONSOR.md`](./MODELE-DEVIS-SPONSOR.md).

---

## 2. Périmètre et hypothèses

| Hypothèse | Valeur retenue |
|-----------|----------------|
| Structure | Entrepreneur individuel · éditeur OnScen (SIREN 106548464) |
| Produit | Application en production · sponsoring **managed** (paramétrage admin, pas self-serve Stripe checkout) |
| Facturation sponsor | **Virement B2B** (pas de commission Stripe sur le chiffre sponsor — contrairement aux pourboires live) |
| Unité de vente | **1 emplacement × 1 semaine** (ou pack multi-emplacements sur la même semaine) |
| Tranche d’activité modélisée | **Bootstrap M0 – M12** (peu d’utilisateurs, montée commerciale Occitanie + 2 villes) |
| Dev | Fondateur unique · maintenance + évolutions · valorisation **temps interne** (pas salaire marché full-time) |

---

## 3. Structure de coûts — infrastructure

Chiffres alignés sur l’infra documentée (juillet 2026) et projections de montée en charge.

### 3.1 Coûts fixes infra & hébergement (€ HT / mois)

| Poste | M0 – MVP | M6 – traction | M12 – 5–15 k MAU | M24 – scale |
|-------|----------|---------------|------------------|-------------|
| VPS prod (Scaleway DEV1-S → PRO2) | 10 | 10 – 25 | 25 – 60 | 60 – 120 |
| VPS staging | 10 | 10 | 10 | 10 |
| PostgreSQL managé (DB-DEV-S → DB-PRD-S) | 15 | 15 – 35 | 35 – 75 | 75 – 150 |
| Domaine, DNS, email pro | 5 | 5 | 8 | 10 |
| Sauvegardes S3 / Object Storage | 0 – 5 | 5 – 15 | 15 – 40 | 40 – 80 |
| Redis (Phase 0 stack cible) | 0 | 10 – 20 | 20 – 40 | 40 – 80 |
| CDN / Cloudflare (WAF, cache) | 0 | 0 – 20 | 20 – 50 | 50 – 100 |
| **Sous-total infra fixe** | **~40 – 45** | **~55 – 130** | **~130 – 280** | **~280 – 540** |

### 3.2 Coûts variables infra (dépendent de l’usage)

| Poste | Déclencheur | Ordre de grandeur bootstrap | Commentaire |
|-------|-------------|----------------------------|-------------|
| **Cloudflare Stream** | Minutes HLS visionnées | 0 – 50 €/mois | ~1 $ / 1 000 min · faible si peu de lives longs |
| **LiveKit** | Dépassement quota Build | 0 – 46 €/mois | Plan Build gratuit au départ |
| **Sightengine** (modération) | Appels API images/vidéo | 30 – 120 €/mois | Volume reels / uploads |
| **Stripe Connect** | Pourboires live uniquement | Variable | **Hors revenu sponsor B2B** |
| Bande passante / egress | Médias, cartes | 5 – 30 €/mois | Croît avec les MAU |

**Total infra « réaliste » bootstrap (M0 – M6) :** **~80 – 200 € HT / mois** (fixe + variable modéré).

**Total infra cible M12 (objectif business plan 15 k MAU) :** **~200 – 450 € HT / mois**.

*Référence scaling agressif :* [`commun/msdev/SCALABILITY.md`](../../../msdev/SCALABILITY.md) — fourchettes 200 – 500 €/mois (PM2 cluster) à plusieurs k€ (Kubernetes), **non requis** avant preuve commerciale sponsor.

---

## 4. Coûts produit, juridique et outils (€ HT / mois)

| Poste | M0 – M6 | M6 – M12 | Notes |
|-------|---------|----------|-------|
| Apple Developer Program | 8 | 8 | ~99 €/an |
| Google Play (one-time amorti) | 2 | 2 | 25 $ unique |
| Comptabilité / expert-comptable | 60 – 120 | 80 – 150 | EI · TVA · liasse |
| Juridique (amorti RDV / dossiers) | 30 – 80 | 50 – 100 | CGU, contrats sponsor |
| Outils dev (IDE, CI, monitoring) | 20 – 60 | 40 – 100 | Sentry, etc. roadmap |
| INPI / propriété intellectuelle (amorti) | 10 | 10 | e-Soleau / marque |
| **Sous-total pro & outils** | **~130 – 280** | **~190 – 370** | |

---

## 5. Coût du développement et de l’exploitation (temps fondateur)

Le sponsoring **managed** consomme du temps **non automatisable** au lancement :

| Activité | Temps moyen / campagne / emplacement / semaine | Valorisation interne |
|----------|--------------------------------------------------|--------------------|
| Brief + devis + facturation | 0,5 – 1 h | Inclus |
| Intégration admin (dates, zone, assets) | 0,5 – 1 h | |
| Validation créative + conformité (DSA, charte) | 0,5 – 1 h | |
| Reporting + captures fin de campagne | 0,5 – 1 h | |
| **Total ops commercial / technique** | **2 – 4 h** | **45 €/h** → **90 – 180 €** |

| Activité | Temps / mois (bootstrap) | Valorisation |
|----------|--------------------------|--------------|
| Maintenance corrective + déploiements | 15 – 25 h | 45 €/h → **675 – 1 125 €** |
| Évolutions produit (sponsor, mobile, légal) | 20 – 40 h | 45 €/h → **900 – 1 800 €** |
| Support utilisateurs / modération | 5 – 15 h | 45 €/h → **225 – 675 €** |

> **TJM interne retenu : 45 €/h** (fourchette prudente sous TJM freelance full-stack 350 – 500 €/jour) — adapté à une phase BIC / bootstrap où le fondateur réinvestit une partie en capital temps.

### 5.1 Charges à couvrir pour « subvenir au minimum à tous les coûts »

Scénario **minimum vital activité** (à ajuster avec votre comptable et votre train de vie) :

| Bloc | € HT / mois (fourchette) |
|------|---------------------------|
| Infra + variables (§3) | 80 – 200 |
| Pro & outils (§4) | 130 – 280 |
| Temps ops + dev (§5, bas de fourchette) | 1 200 – 1 800 |
| **Total charges modélisées** | **~1 410 – 2 280 €/mois** |

**Arrondi de travail :** **~2 000 € HT / mois** à couvrir en phase bootstrap pour **infra + outils + temps de travail valorisé à un niveau minimum**, hors réinvestissement majeur (embauche, gros ads).

*(Les cotisations sociales BIC se calculent sur le bénéfice ; ce document raisonne en **seuil de chiffre d’affaires HT** avant IS/IR — votre expert-comptable traduira en net disponible.)*

---

## 6. Coût marginal et coût complet d’une « semaine-emplacement »

### 6.1 Coût marginal (technique)

| Composant | € / semaine-emplacement |
|-----------|-------------------------|
| CPU / requêtes API sponsors (`/api/sponsors/*`, cache 60 s) | < 0,50 |
| Stockage assets campagne (logo, bannière, vidéo) | 0,20 – 2 |
| Modération Sightengine (si nouvelle créa) | 0 – 5 |
| **Total marginal** | **≈ 2 – 8 €** |

→ Dès **99 € HT** facturés, la **marge brute variable** reste **> 90 %** sur le poste infra.

### 6.2 Coût complet (avec ops + quote-part charges fixes)

Formule :

```
Coût complet ≈ Coût marginal + Temps ops (2,5 h × 45 €) + (Charges fixes mensuelles / Nb semaines-emplacement vendues)
```

Exemple avec **2 000 €** charges/mois et **12** semaines-emplacement vendues :

| Composant | € |
|-----------|---|
| Marginal | 5 |
| Ops (2,5 h × 45 €) | 112 |
| Quote-part fixe (2 000 / 12) | 167 |
| **Coût complet** | **≈ 284 €** |

→ Une semaine à **99 €** **ne couvre pas seule** le coût complet : c’est un **prix d’entrée acquisition** (icône carte), compensé par des formats plus chers et du **volume**.

Exemple avec **16** semaines-emplacement / mois (mix réaliste) :

| Composant | € |
|-----------|---|
| Marginal + ops | 117 |
| Quote-part fixe (2 000 / 16) | 125 |
| **Coût complet** | **≈ 242 €** |

→ **Pack Complet 499 €** ou **2 × fil d’actu + 2 × pack Carte** couvrent largement le plancher.

### 6.3 Plancher tarifaire retenu par emplacement (lien avec la charge)

| Emplacement | Code | Prix HT / semaine | Justification interne |
|-------------|------|-------------------|------------------------|
| Icône Sponso carte | `map_sidebar_events` | **99 €** | Format le plus simple (logo + event) · entrée locale · ops ~2 h · **> coût marginal**, acquisition |
| Onglet Musique | `music_tab` | **119 €** | Contexte musique · créa comparable fil · emplacement stratégique |
| Bandeau carte | `map_banner` | **129 €** | Visibilité forte · specs bannière · ciblage geo |
| Reel sponsorisé | `reels_sponsored` | **129 €** | Vidéo · modération · temps intégration supérieur |
| Fil d’actualité | `feed_inline` | **149 €** | Format premium feed · forte surface · charge créative |

**Règle appliquée :** aucun emplacement **< 99 €** (sous le seuil où ops + marginal consommeraient la marge si le volume mensuel reste faible). Les **packs** encouragent le panier moyen (**199 – 499 €**) pour atteindre le point mort plus vite.

---

## 7. Grille packs — cohérence économique

| Pack | Prix HT / semaine | Somme unitaire | Remise annonceur | Intérêt OnScen |
|------|-------------------|----------------|------------------|----------------|
| Pack Carte | **199 €** | 228 € | ~13 % | Vend 2 emplacements d’un coup · **1,6×** le prix d’entrée |
| Pack Actu & Reel | **249 €** | 278 € | ~11 % | Cible sorties / clips |
| Pack Musique & Actu | **229 €** | 268 € | ~12 % | Labels & discovery |
| Pack Complet | **499 €** | 625 € | ~20 % | **≈ 25 % d’un mois bootstrap** couvert en **1 vente** |

**Remise −10 % sur 4 semaines consécutives (même pack) :** fidélisation · prévisibilité CA · baisse du coût d’acquisition relatif.

**Remise sponsor fondateur −25 % :** limitée en volume (stock **10**) · ne doit pas représenter > **30 %** du CA mensuel pour ne pas bloquer le point mort.

---

## 8. Point mort mensuel (seuil de volume)

Hypothèse : **charges totales = 2 000 € HT / mois** · panier moyen **132 € / semaine-emplacement** (mix typique : 40 % à 99–119 €, 40 % à 129–149 €, 20 % packs).

| Scénario | Calcul | Semaines-emplacement / mois |
|----------|--------|---------------------------|
| Mix moyen 132 € | 2 000 ÷ 132 | **≈ 16** |
| 100 % icône 99 € | 2 000 ÷ 99 | **≈ 21** |
| 100 % fil 149 € | 2 000 ÷ 149 | **≈ 14** |
| Pack Complet 499 € | 2 000 ÷ 499 | **≈ 4 packs** |
| Mix « 2 packs Carte + 4 icônes + 2 fils » | 398 + 396 + 298 | **≈ 1 092 €** → compléter avec **~7** autres semaines |

**Objectif commercial M6 – M12 (aligné business plan) :** **5 – 8 contrats récurrents** · si chaque client prend **2 semaines-emplacement / mois** en moyenne → **10 – 16** semaines → **zone de point mort**.

---

## 9. Projection infra vs revenu sponsor (12 mois)

Hypothèses revenus : objectif interne **40 k€ ARR sponsors** (~**3 333 € HT / mois** en régime de croisière M12).

| Mois | Infra totale (€) | CA sponsor cible (€ HT) | Ratio infra / CA | Marge dispo avant temps fondateur |
|------|------------------|---------------------------|------------------|-----------------------------------|
| M1 – M3 | 80 – 150 | 0 – 800 | élevé | investissement |
| M4 – M6 | 120 – 250 | 800 – 2 000 | 10 – 25 % | tendance point mort |
| M7 – M12 | 200 – 450 | 2 000 – 3 500 | 6 – 15 % | marge confortable si volume tenu |
| M12+ | 250 – 500 | 3 500+ | < 15 % | scale possible |

À **3 333 € HT / mois** de sponsors, même avec **450 €** d’infra et **300 €** d’outils, il reste **> 2 500 €** avant valorisation du temps — **couverture du scénario bootstrap** dès que l’objectif ARR 40 k€ est atteint.

---

## 10. Benchmark marché (sanité, pas base de calcul)

En phase sans audience mesurable, OnScen **ne facture pas au CPM**. Le benchmark sert uniquement à vérifier que le forfait **n’est pas « trop cher »** pour un annonceur local :

| Référence | Fourchette France | Équivalent « 7 jours » indicatif |
|-----------|-------------------|----------------------------------|
| Meta / Instagram CPM | 6 – 18 € | 300 – 2 000 €+ selon reach |
| TikTok CPM | 3 – 9 € | 150 – 800 €+ |
| **OnScen forfait** | Pas de CPM | **99 – 149 € / emplacement / semaine** |

Positionnement : **inventaire vertical musique + geo + formats natifs** · prix **accessible** pour bars/salles · **marge éditeur** suffisante si le **volume** suit.

---

## 11. Sensibilité et règles de décision

| Risque | Mitigation tarifaire |
|--------|----------------------|
| Volume < 10 semaines / mois | Limiter remises fondateur · pousser **packs** · refuser **< 99 €** hors promo ponctuelle |
| Infra streaming explose (lives) | Sponsors **ne financent pas seuls** les lives · abonnements / pourboires · plafonds OnScen+ |
| Temps ops > 4 h / campagne | Supplément **création graphique / montage reel** (150 – 900 €) · pas de baisse du forfait |
| Montée en charge 10 k MAU | Revoir prix **à la hausse** ou introduire **CPM plancher** (annoncé à l’avance, cf. devis) |

---

## 12. Conclusion — pourquoi ces prix

1. **Ils couvrent le coût marginal** avec une marge brute technique très élevée (modèle SaaS / média).
2. **Ils intègrent une valorisation réaliste du temps** (paramétrage, conformité, reporting) via un **plancher à 99 €** et des formats premium à **149 €**.
3. **Ils exigent un volume commercial modeste** (~**12 – 16** semaines-emplacement / mois, ou **~4** packs Complet) pour **couvrir ~2 000 €/mois** de charges bootstrap — cohérent avec **5 – 8 clients récurrents** visés à M12.
4. **Les packs (199 – 499 €)** accélèrent le point mort sans revenir au CPM avant d’avoir une audience mesurable.
5. **Les projections infra** (40 € → 450 €/mois de M0 à M12) laissent une **part suffisante du CA sponsor** pour le développement tant que l’objectif **~40 k€ ARR** est poursuivi.

---

## 13. Suivi recommandé

| Fréquence | Action |
|-----------|--------|
| Trimestrielle | Recaler §3 – §5 avec factures Scaleway, Sightengine, comptable |
| Mensuelle | Compter **semaines-emplacement** facturées vs point mort (§8) |
| Annuelle | Réviser grille si MAU > 50 k ou si CPM introduit |

---

## Annexe — Grille commerciale de référence (rappel)

| Code | Emplacement | HT / semaine |
|------|-------------|--------------|
| `map_sidebar_events` | Icône Sponso carte | 99 € |
| `music_tab` | Onglet Musique | 119 € |
| `map_banner` | Bandeau carte | 129 € |
| `reels_sponsored` | Reel sponsorisé | 129 € |
| `feed_inline` | Fil d’actualité | 149 € |

**Packs :** Carte 199 € · Actu & Reel 249 € · Musique & Actu 229 € · Complet 499 €.

*Document interne OnScen · onscen.com · À joindre au dossier BIC / pitch partenaires sur demande.*
