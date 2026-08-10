# Phase 11 — Légalité globale

**Date :** 2026-08-10  
**Périmètre :** docs juridiques, monétisation, stores, DSA, mineurs

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
| Inscription | Case âge / birth date partiel (`004_user_birth_date_privacy`) — pas de vérification forte | **élevé** | Date naissance obligatoire + bloc <13 |
| Live | Restrictions mineurs hébergement live non verrouillées techniquement | **élevé** | Majeur vérifié pour go-live caméra |
| Géo | Pas de downgrade auto mineurs (phase 3) | **élevé** | — |
| Dons | `userMeetsDonationAge` — bypass `ageConfirmed` signalé audit antérieur | **élevé** | Hard check birth date |

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

Enjeux **juridiques > techniques** : licences musique, **mineurs/live**, **IAP stores**, **DAC7/TVA**.
