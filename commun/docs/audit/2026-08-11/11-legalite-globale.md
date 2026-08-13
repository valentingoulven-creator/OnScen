# Phase 11 — Légalité globale

**Date :** 2026-08-10 (rafraîchi 2026-08-11)  
**Périmètre :** docs juridiques, monétisation, stores, DSA, mineurs, `lib/ageGates.ts`, `lib/locationPrivacy.ts`, `routes/donations.ts`

> **🔄 Rafraîchissement 2026-08-11 (soir)** : les correctifs mineurs listés en §11.3 comme « code, non déployés » sont **confirmés déployés en prod** ce soir (vérifié directement sur `dist/lib/ageGates.js` du VPS). Nouveau facteur de risque : les inscriptions publiques sont désormais **ouvertes** (`ACCESS_REGISTRATION_MODE=open`), ce qui augmente le volume attendu de nouveaux comptes mineurs — renforce l'importance du DOB obligatoire déjà en place.

---

## 11.1 Droits musicaux

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| SACEM / sync | Pas de contrat SACEM documenté dans repo | **critique** | Mandat avocat + politique musique UGC |
| ACRCloud | Outil identification — pas licence automatique | **élevé** | Règles enforcement documentées |
| User uploads | Compositions MP3 propres — responsabilité utilisateur CGU | **moyen** | Content-ID light ou revue manuelle |

---

## 11.2 DSA (UE)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Point de contact | Email DSA dans mentions | faible | — |
| Notice & action | Signalements + délais CGU | faible | Rapport transparence si seuil utilisateurs atteint |
| Modération | Procédures internes + runbook CSAM brouillon | **moyen** | Publier rapport DSA annuel si requis |

---

## 11.3 Protection des mineurs

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Inscription | ✅ **Amélioré depuis le 08-10** (MODIF 1349) : `birthDate` désormais **obligatoire** à l'inscription (`register` + `oauth/exchange`), erreur serveur `birth_date_required`/`birth_date_invalid` si absente/invalide ; blocage < `MIN_PROFILE_AGE` (13 ans) | **moyen** (comptes pré-existants sans DOB non couverts rétroactivement) | Campagne de complétion DOB pour comptes historiques ; vérifier qu'aucun contournement client (ex. API directe) ne persiste |
| Live | **Correction du constat 08-10** : un verrou serveur **existe déjà** (`routes/lives.ts:257`, `userMeetsLiveAgeFromProfile`) — le démarrage de live est bloqué sous `MIN_LIVE_AGE = 16` ans, avec message d'erreur dédié. L'audit précédent sous-estimait ce point | **moyen** (seuil 16 ans, pas 18) | Arbitrage produit/légal : le seuil de 16 ans pour un live caméra public reste inférieur à la recommandation initiale (majorité vérifiée) — envisager de relever à 18 ans ou d'ajouter des restrictions différenciées pour les 16-17 ans (dons désactivés, modération renforcée, pas de DM public) |
| Géo | ✅ **Résolu et déployé** (MODIF 1350, confirmé en prod le 08-11 soir) : `GEO_PRECISE_MIN_AGE = 18`, `enforceMinorGeoPolicy` applique précision « ville » aux < 18 ans, sans GPS live, à l'inscription et en continu | résolu (code + prod) | Voir [03-postgis §3.2](./03-postgis.md) pour la réserve sur les comptes « âge inconnu » |
| Dons | ✅ **Résolu** : `donations.ts` ignore le booléen client `ageConfirmed` pour le contrôle d'accès réel — la vérification serveur `userMeetsDonationAgeFromProfile(user)` (dérivée de `birthDate`, fallback `age`) est seule décisionnelle, avec code d'erreur `DONATION_AGE_REQUIRED` | résolu | RAS — le champ `ageConfirmed` reçu du client n'est utilisé qu'à titre informatif/legacy, à supprimer du contrat API par propreté si inutilisé ailleurs |

---

## 11.4 RGPD — localisation serveurs

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Hébergement | Scaleway fr-par — UE | faible | — |
| Sous-traitants US | Sentry, Stripe, Google, LiveKit — clauses SCC | **moyen** | DPA + TIA |

---

## 11.5 Paiements (dons / cadeaux)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Stripe live | **`isDonationsEnabled()` exige `sk_live_` en prod** (correctif post-audit) | faible si déployé | Vérifier `.env` VPS réel |
| Jeu d’argent | Dons non aléatoires — pas loot boxes | faible | — |
| TVA / DAC7 | CGV créateurs — gaps TVA/DAC7 (audit antérieur) | **élevé** | Conseil fiscal |
| PCI | Aucune carte stockée | faible | — |

---

## 11.6 Conformité stores (Apple / Google)

| Point | Constat | Risque | Recommandation |
|-------|---------|--------|----------------|
| Live + UGC | Apple exige modération + signalement — mécanismes présents | **moyen** | Checklist `AUDIT-mobile-ios-android.md` avant soumission |
| IAP | Dons via Stripe web — **risque rejet** si contournement IAP pour digital goods | **élevé** | Revue guideline 3.1.1 |
| Sign in with Apple | Scripts setup présents — à valider prod | **moyen** | Test flux apptel |
| Target SDK / privacy | Fichiers android/ios présents | **moyen** | Audit store listing |

---

## 11.7 Synthèse phase 11

**Mise à jour 2026-08-11 (matin) :** progrès notables et vérifiés sur la protection des mineurs (E2) — DOB obligatoire à l'inscription, géo précise verrouillée < 18 ans, dons verrouillés côté serveur sur l'âge réel. Reste **élevé** : verrouillage technique du **live caméra** pour mineurs (à confirmer côté route API), et ces correctifs sont **dans le working tree, non déployés en prod**.

**Mise à jour 2026-08-11 (soir) :** tous ces correctifs sont **confirmés déployés en production**. Les inscriptions publiques ont par ailleurs été **ouvertes** le même jour — accroît la pertinence opérationnelle de ces garde-fous mineurs (plus de nouveaux comptes attendus).

Enjeux **juridiques > techniques** restants : licences musique, **live mineurs (seuil 16 vs 18)**, **IAP stores**, **DAC7/TVA**.
