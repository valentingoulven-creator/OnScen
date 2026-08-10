# OnScen (getsoundy.com) — Budget prévisionnel & besoin de financement bancaire

**Document de travail — dossier prêt professionnel / BPI complémentaire**  
**Date :** 2026-08-10  
**Statut :** Hypothèses à valider avec le fondateur, l’expert-comptable et l’établissement prêteur.  
**Références internes :** [`OnScen-Pitch-Deck.md`](../presentations/OnScen-Pitch-Deck.md), [`BUSINESS-PLAN-PREMIUM.md`](./BUSINESS-PLAN-PREMIUM.md), [`TODO-MANUAL.md`](../../../TODO-MANUAL.md)

---

## 1. Objet du financement

Financer **12 à 18 mois** de mise en conformité, finalisation produit (web + mobile iOS/Android), lancement commercial et communication, **sans attendre une levée equity**, afin d’atteindre :

- Application **publiable** sur App Store / Play Store (ou scope mobile documenté et conforme).
- **Paiements réels** opérationnels (Stripe live, pas de clé test en production).
- **3 à 5 contrats sponsors payants** et traction mesurable (objectif document interne : 5 000 → 15 000 MAU en phase 0).
- Dossier **juridique validé** (CGU, privacy, monétisation, sponsors, stores).

---

## 2. Synthèse — montants demandés (3 scénarios)

| Scénario | Montant emprunt recommandé | Horizon | Usage principal |
|----------|----------------------------|---------|-----------------|
| **A — Ciblé « finalisation »** | **60 000 – 80 000 €** | 12 mois | Dev freelance + juridique + infra + trésorerie minimale |
| **B — Lancement complet** | **120 000 – 150 000 €** | 15 mois | A + com’ / acquisition + commercial terrain + modération |
| **C — Aligné plan seed interne** | **190 000 – 280 000 €** | 18 mois | Équivalent levée seed (pitch deck) : growth 40 %, sales 30 %, produit 20 %, ops 10 % |

**Recommandation banque (PME innovante, garantie possible BPI / caution) :** viser le **scénario B (~135 000 €)** avec décaissement par tranches liées à jalons (voir §6), ou **80 000 €** si le fondateur finance la com’ en bootstrap et ne demande que **produit + juridique + conformité**.

---

## 3. Détail du budget par poste (scénario B — 15 mois, base **135 000 €**)

Les montants sont **HT** sauf mention. Fourchettes = fourchette basse / haute ; **Base** = chiffre retenu pour le total.

### 3.1 Produit & développement — **32 000 €** (base)

| Ligne | Détail | Base (€) | Fourchette (€) |
|-------|--------|----------|----------------|
| Audit sécurité + revue code | Freelance senior, rapport P0/P1/P2 | 4 000 | 3 000 – 6 000 |
| Finalisation mobile (Capacitor) | Panel hôte live, stores, Sign in with Apple, IAP ou scope documenté | 12 000 | 8 000 – 20 000 |
| Stripe prod + webhooks + Connect | Bascule live, tests, runbook | 2 500 | 1 500 – 4 000 |
| Dette UX / stabilité (F1, build, QA) | Toasts, modales, corrections ciblées | 5 000 | 3 000 – 8 000 |
| Design / UX ponctuel (optionnel) | Maquettes bottom-sheet live mobile | 3 000 | 0 – 6 000 |
| Contingence technique (10 %) | Imprévus intégration LiveKit / stores | 5 500 | — |

*Référence marché : freelance senior full-stack WebRTC/Capacitor, **550–650 €/jour**, mission type **6–8 semaines à 4 j/sem** ≈ **11–21 k€** ; le poste ci-dessus couvre **2 vagues** (audit + finalisation).*

### 3.2 Juridique, conformité & administratif — **16 500 €** (base)

| Ligne | Détail | Base (€) | Fourchette (€) |
|-------|--------|----------|----------------|
| Avocat digital (RGPD, DSA, stores, pourboires) | 1er dossier + 1 retour post-lancement | 8 000 | 5 000 – 12 000 |
| CGV / contrats sponsors & devis types | Rédaction ou relecture | 3 000 | 2 000 – 5 000 |
| Expert-comptable | 12–15 mois (250–350 €/mois) | 3 600 | 3 000 – 5 000 |
| Assurances | RC Pro, cyber (optionnelle) | 1 200 | 800 – 2 000 |
| Frais divers | e-Soleau déjà fait, greffe, formalités | 500 | 300 – 1 500 |
| Apple Developer + Google Play | Comptes + 1ère soumission | 200 | 150 – 500 |

*Dossier avocat PDF déjà généré (`commun/docs/juridique/dossier-avocat-a-valider/`) — le budget couvre la **validation et les ajustements**, pas la rédiction from scratch.*

### 3.3 Communication & marketing — **29 000 €** (base)

| Ligne | Détail | Base (€) | Fourchette (€) |
|-------|--------|----------|----------------|
| Identité & assets lancement | Vidéo courte, kit presse, landing | 4 000 | 2 000 – 8 000 |
| Social ads (Meta / TikTok tests) | Tests géo ciblées (Paris, Lyon, Toulouse) | 8 000 | 4 000 – 15 000 |
| Événements / partenariats locaux | 3–5 soirées pilotes, micro-influence | 6 000 | 3 000 – 12 000 |
| Offre lancement sponsors | Remises « 10 premiers » (99 €) — **coût commercial**, pas CA | 2 000 | 1 000 – 4 000 |
| Community / contenu (freelance ou mi-temps M6+) | 6 mois × ~1 500 €/mois | 9 000 | 0 – 18 000 |

*Aligné business plan : priorité 1 **150–800 €/mois** (0–3 mois), puis montée **800–5 000 €/mois** ; la base lisse sur 15 mois.*

### 3.4 Commercial & ventes (B2B sponsors / lieux) — **22 000 €** (base)

| Ligne | Détail | Base (€) | Fourchette (€) |
|-------|--------|----------|----------------|
| Prospection terrain + déplacements | Occitanie + Paris (3 villes pilotes) | 4 000 | 2 000 – 6 000 |
| Account executive freelance / commission | M7–M15, 2 j/sem ou success fee | 12 000 | 0 – 24 000 |
| Outils CRM / email pro / démo | 15 mois | 1 500 | 800 – 3 000 |
| Formation / salons pro (optional) | 1–2 événements sectoriels | 4 500 | 0 – 8 000 |

*Pitch deck : burn additionnel **120–180 k€/an** pour CM + AE + support si **3 embauches** ; ici version **lean** externalisée.*

### 3.5 Infrastructure, SaaS & modération — **12 000 €** (base)

| Ligne | Détail | Base (€) | Fourchette (€) |
|-------|--------|----------|----------------|
| Hébergement & cloud | Scaleway VPS, PG, S3 — palier croissance | 2 500 | 1 500 – 5 000 |
| LiveKit / Cloudflare Stream / Sightengine | Usage live + modération | 4 500 | 2 000 – 10 000 |
| Stripe (frais) + outils (Sentry, email, etc.) | Variable selon volume | 2 000 | 1 000 – 4 000 |
| Modération externalisée (mi-temps M9+) | 6 mois | 3 000 | 0 – 8 000 |

*Coût fixe MVP documenté **~41–45 €/mois** ; palier 5 000 DAU **~300–350 €/mois** (business plan).*

### 3.6 Trésorerie & imprévus — **13 000 €** (base)

| Ligne | Détail | Base (€) |
|-------|--------|----------|
| Fonds de roulement | 2–3 mois charges hors fondateur | 10 000 |
| Imprévus (≈ 8 % du sous-total hors trésorerie) | Retards stores, litige, infra | 3 000 |

### 3.7 Rémunération dirigeant (option — souvent **hors** emprunt ou partiel)

| Ligne | Détail | Base (€) | Note banque |
|-------|--------|----------|-------------|
| Allocations fondateur | 12 × 1 500 € (minimum vital) | 18 000 | À discuter : certains prêteurs exigent de le **montrer** dans le plan ; d’autres préfèrent **bootstrap** dirigeant |

**Sous-total postes affectés (3.1 à 3.6) : 32 000 + 16 500 + 29 000 + 22 000 + 12 000 + 13 000 = 124 500 €.**  
**Marge de sécurité non affectée (arrondi au montant cible du scénario B) : 10 500 €** — provision explicite, pas un « oubli » : à mobiliser en priorité sur la finalisation mobile (§3.1) si le périmètre IAP natif est retenu (cf. §12 Points de vigilance CTO).  
**Total scénario B sans rémunération dirigeant : 135 000 €.**  
**Avec rémunération dirigeant (+18 k€) : ~153 000 €.**

---

## 4. Répartition % (pour slide banque / BPI)

| Poste | Montant (€) | % (scénario B, 135 k€) |
|-------|-------------|-------------------------|
| Produit & développement | 32 000 | **24 %** |
| Communication & marketing | 29 000 | **21 %** |
| Commercial B2B | 22 000 | **16 %** |
| Juridique & admin | 16 500 | **12 %** |
| Trésorerie & imprévus | 13 000 | **10 %** |
| Infra, outils, modération | 12 000 | **9 %** |
| Marge de sécurité non affectée | 10 500 | **8 %** |
| **Total** | **135 000** | **100 %** |
| *(Option dirigeant non inclus)* | — | — |

*Comparable pitch deck seed : Growth 40 % · Sales 30 % · Produit 20 % · Ops 10 % — même logique, montants adaptés au prêt.*

---

## 5. Plan de trésorerie simplifié (hypothèses)

| | M1–M6 | M7–M12 | M13–M15 |
|---|-------|--------|---------|
| **Dépenses cumulées (base)** | ~55 k€ | ~115 k€ | ~135 k€ |
| **Revenus sponsors (hyp.)** | 5–15 k€ | 20–40 k€ | 35–55 k€ cumul |
| **Revenus abos / tips (hyp.)** | faible | 5–15 k€ | 10–25 k€ cumul |
| **Solde net cumulé (hyp.)** | -45 à -50 k€ | -70 à -85 k€ | -60 à -90 k€ |

*Scénario pitch **An 1** : ~65 k€ revenus pour ~100 k€ charges — déficit ~35 k€ ; le prêt **couvre le gap** avant break-even (~An 2 dans l’hypothèse base du deck).*

**Revenus à ne pas sur-promettre à la banque :** utiliser le **scénario conservateur** (15–25 k€ sponsors année 1) pour le remboursement ; garder le scénario base pour l’equity story.

---

## 6. Jalons de décaissement (proposition)

| Tranche | % | Montant (sur 135 k€) | Condition |
|---------|---|----------------------|-----------|
| T1 | 30 % | 40 500 € | Signature prêt + plan de trésao validé |
| T2 | 25 % | 33 750 € | Rapport audit dev + bascule Stripe live OK |
| T3 | 25 % | 33 750 € | Avis juriste reçu + soumission TestFlight / Play internal |
| T4 | 20 % | 27 000 € | 3 contrats sponsors signés ou 5 000 MAU (KPI au choix) |

---

## 7. Capacité de remboursement (indicatif)

| Paramètre | Valeur indicative |
|-----------|-------------------|
| Montant emprunté | 135 000 € |
| Durée | 5 à 7 ans |
| Taux (hyp.) | 4,5 – 6,5 % / an |
| Mensualité (7 ans, 5,5 %) | **~1 950 €/mois** |
| Mensualité (5 ans, 5,5 %) | **~2 570 €/mois** |

**Seuil de revenus mensuels** pour couvrir la mensualité seule (hors charges opérationnelles) : **~2 500 – 3 500 €/mois** de marge disponible — atteignable avec **2–4 contrats Pro Ville** (2 400 €/mois documentés) + sponsors ponctuels, **hypothèse M10+**.

*À faire chiffrer par le banquier ; ajouter assurance emprunteur (~0,3–0,5 % capital/an).*

---

## 8. Garanties & leviers complémentaires

- **BPI France** : prêt garanti PME / French Tech — souvent demandé par les banques pour **50–70 %** du risque.
- **CIR / JEI** : si éligible, mentionner le **MEMO-RD** interne pour crédibilité R&D (ne remplace pas le remboursement du prêt).
- **Actif** : code, marque, base utilisateurs, contrats sponsors — pas de garantie matérielle lourde (SaaS lean).
- **Apport personnel** : même **10–15 %** du projet améliore nettement le dossier.

---

## 9. Ce que le prêt ne doit pas financer (transparence)

- Dividendes ou rachat de parts
- Dette fiscale / URSSAF non planifiée (à régulariser avant dossier)
- **Speculation** media sans KPI (garder plafonds ads + mesure ROAS)
- Doublon avec **levée equity** simultanée sans tableau de sources clair

---

## 10. Checklist pièces jointes banque

- [ ] Kbis / statuts / RIB société  
- [ ] 2–3 derniers bilans ou **prévisionnel 3 ans** (expert-comptable)  
- [ ] Ce budget + business plan premium (PDF)  
- [ ] Pitch deck (12 slides)  
- [ ] Preuves traction : health prod, captures app, **pipeline sponsors** (même LOI)  
- [ ] Devis signés ou lettres d’intention : dev freelance, avocat  
- [ ] Tableau des subventions / BPI en cours ou visées  

---

## 11. Une page « executive » à copier dans le courrier banquier

> **Projet :** OnScen — réseau social musique & nightlife (carte, lives, sponsors natifs).  
> **Demande :** **135 000 €** sur **15 mois** (scénario lancement complet), remboursable sur **5–7 ans**.  
> **Emploi des fonds :** 24 % finalisation app & mobile stores, 21 % communication, 16 % commercial B2B sponsors, 12 % juridique/compta, 10 % trésorerie, 9 % infra & modération, 8 % marge de sécurité.  
> **Jalons :** Stripe live, conformité juridique, soumission stores, 3 contrats sponsors payants.  
> **Revenus An 1 (hyp. conservatrice) :** 15–25 k€ sponsors ; **An 2 (hyp. base interne) :** ~240 k€ — break-even visé ~An 2.  
> **Complément :** garantie BPI / apport fondateur **15 k€** envisagés.

---

## 12. Points de vigilance CTO (revue technique du document — 2026-08-10)

Revue croisée avec `TODO-MANUAL.md` et `commun/docs/audit/2026-08-audit-technique-complet/`.

1. **Risque de sous-budgétisation mobile (§3.1)** : la ligne « Finalisation mobile » (8 000 – 20 000 €) doit couvrir *simultanément* le portage du panel hôte live sur Capacitor, la soumission stores, Sign in with Apple **et éventuellement l'IAP natif (StoreKit2/Play Billing)**. `TODO-MANUAL.md` (item C1) chiffre l'IAP natif seul à **4–8 semaines** de dev — soit, au même TJM (550–650 €/j), **~9 000 – 20 000 €** à lui seul. Si le fondateur tranche pour l'IAP natif obligatoire (plutôt que le scope web-only déjà en place via les garde-fous App Store 3.1.1), la ligne §3.1 doit être **doublée** ou puiser dans la marge de sécurité (§3, note ajoutée). **Action avant dépôt du dossier :** trancher ce scope — cela change le montant demandé de façon non négligeable.
2. **Risque infra non mentionné explicitement** : les audits internes documentent une architecture **mono-VPS sans CDN/WAF devant l'application** (`06-ddos.md`, risque qualifié « Élevé ») et **aucun auto-scaling horizontal** opérationnel. Le scénario B cible 5 000–15 000 MAU, pour lequel le VPS actuel suffit (cohérent avec le business plan, poids infra 3–8 % au lancement) — mais ce n'est **pas une garantie en cas de traction plus rapide que prévu** (pic viral, campagne sponsor réussie). Recommandation : ajouter une phrase de risque dans le dossier banque (« infrastructure actuelle dimensionnée pour la phase de lancement ; scaling ultérieur = investissement complémentaire, pas couvert par cet emprunt ») plutôt que de laisser le sujet implicite.
3. **DPA non signés (Scaleway/Cloudflare/Stripe/Resend)** — coût nul mais action contractuelle identifiée dans l'audit RGPD (`09-cgu-rgpd.md`), à inclure dans le mandat de l'avocat (§3.2) pour ne pas la perdre de vue ; aucun ajustement budgétaire nécessaire, juste une inclusion explicite du périmètre de mission avocat.
4. **Erreurs arithmétiques corrigées dans cette révision** : les sous-totaux « Juridique » (18 000 € → 16 500 € réel) et « Communication » (28 000 € → 29 000 € réel) ne correspondaient pas à la somme de leurs propres lignes ; la répartition en % ne totalisait que 93 % au lieu de 100 %. Corrigé en ajoutant une ligne explicite « Marge de sécurité non affectée » (10 500 €, 8 %) plutôt que de masquer l'écart dans un arrondi non tracé. **Un banquier ou un comptable qui refait le calcul doit retrouver exactement les mêmes totaux — c'est fait, à revérifier après tout ajustement manuel ultérieur du document.**
5. **Cohérence sources vérifiée** : coût infra MVP (~41–45 €/mois), palier 5 000 DAU (~300–350 €/mois), tarif « Pro Ville » (2 400 €/mois HT, confirmé récurrent et non ponctuel dans `BUSINESS-PLAN-PREMIUM.md`), et chiffres An 1 du pitch deck (~65 k€ revenus / 100 k€ charges) — tous corrects et correctement cités.
6. **Mensualités d'emprunt (§7)** recalculées indépendamment (formule d'amortissement standard, taux 5,5 %) : ~1 940 €/mois sur 84 mois et ~2 582 €/mois sur 60 mois — cohérent à moins de 1 % des valeurs indicatives du document (arrondis acceptables pour un document marqué « indicatif », à faire chiffrer précisément par la banque).

**Verdict global :** document exploitable pour un dossier bancaire après les corrections ci-dessus (appliquées dans ce fichier). Point bloquant réel avant dépôt : **trancher le scope IAP natif vs web-only** (point 1) — c'est une décision produit, pas technique, qui impacte directement le montant à demander.

---

*Document préparé à partir des hypothèses OnScen documentées — à faire valider par un expert-comptable et l’établissement prêteur. Ne constitue pas un conseil financier réglementé.*
