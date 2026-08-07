# Rapport Dev Agent — 2026-08-07 — Implémentation audit technique (vague 1 : CSAM, live, modération, DDoS)

**Agent :** @soundy-dev-agent
**Date :** 2026-08-07
**Durée estimée :** ~3 h
**Statut global :** ⚠️ Partiel (par conception — voir « Bloquers / décisions requises »)

---

## Mission

Implémenter un sous-ensemble priorisé, purement technique, des recommandations de l'audit complet (`commun/docs/audit/2026-08-audit-technique-complet/`), en commençant par les risques critiques et élevés de la Phase 7 (modération de contenu) et de la Phase 6 (DDoS/abus).

---

## Contexte / problème

Suite à l'audit 12 phases produit en amont (voir `00-synthese.md`), le fondateur a demandé de passer en implémentation (« vas y fais le », avec `@soundy-dev-agent`). L'audit liste ~40 findings ; cette session traite un sous-ensemble réalisable en une session, purement code (aucune décision business/légale/infra-prod), en priorisant :

1. **MOD-8 (critique)** — aucune détection CSAM technique, aucun runbook opérationnel.
2. **MOD-3 (critique)** — aucune modération automatique du flux vidéo live.
3. **MOD-1, MOD-2, MOD-4, MOD-5, MOD-6 (élevé/moyen)** — modèles Sightengine limités, uploads sponsors non scannés, commentaires reels non filtrés, pas de notification admin, pas de priorité de traitement.
4. **DDOS-2 (élevé)** — pas de rate limiting dédié sur `lives/start`, recherche, follow, like.

---

## Actions réalisées

- [x] Détection CSAM technique : modèle Sightengine `face-age` + seuils dédiés, nouvelle raison de refus `minor_risk`, escalade (signalement système + alerte email admin immédiate).
- [x] Runbook opérationnel CSAM (`commun/docs/juridique/RUNBOOK-CSAM.md`, brouillon à valider avocat).
- [x] Modèles gore/weapon activés par défaut (nouvelle raison `violent`).
- [x] Échantillonnage périodique de frames sur les lives Cloudflare Stream + coupure automatique en cas de détection.
- [x] Scan Sightengine sur les uploads logo/bannière sponsors.
- [x] Commentaires reels routés via le pipeline `prepareChatText` (sanitization + filtre lexical).
- [x] Priorité + notification admin immédiate sur les signalements `illegal`/`csam_risk` (nouvelle catégorie dédiée).
- [x] Rate limiters dédiés : démarrage de live, recherche (users/music/globale), follow, like/heart.
- [x] Tests unitaires ajoutés (minor_risk, violent, composition des modèles, priorité des signalements) — 502 tests backend passants (vs 489 avant session).
- [x] `tsc -b` backend + frontend : ✅ sans erreur. ESLint fichiers modifiés : ✅ sans erreur.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/sightengineConfig.ts` | Modèles `face-age`/`gore-2.0`/`weapon` par défaut + getters seuils |
| `commun/backend/src/lib/sightengineModeration.ts` | Raisons `minor_risk`/`violent`, extraction score visage mineur |
| `commun/backend/src/lib/sightengineModeration.test.ts` | +5 tests (minor_risk, violent, faux positifs évités) |
| `commun/backend/src/lib/sightengineConfig.test.ts` | Nouveau — composition des modèles |
| `commun/backend/src/lib/contentModeration.ts` | `escalateMinorRiskDetection`, `uploaderId` propagé partout |
| `commun/backend/src/lib/alertNotifier.ts` | 3 nouveaux types d'alerte (csam/live/report urgent) |
| `commun/backend/src/lib/contentReports.ts` | Champ `priority`, `computeReportPriority` |
| `commun/backend/src/lib/contentReports.test.ts` | Nouveau |
| `commun/backend/src/lib/cloudflareStream.ts` | `getInProgressLiveThumbnailUrl()` |
| `commun/backend/src/lib/liveContentSampling.ts` | Nouveau — échantillonnage + auto-coupure live |
| `commun/backend/src/lib/adminContentModeration.ts` | Arrêt échantillonnage sur blocage/suppression admin |
| `commun/backend/src/lib/abuseRateLimits.ts` | Nouveau — 4 limiteurs dédiés |
| `commun/backend/src/routes/{lives,reels,feed,stories,dm,chat,auth,users,music,search,legal,adminSponsors}.ts`, `socket.ts` | Wiring moderation `uploaderId` + rate limiters + catégorie `csam_risk` |
| `commun/docs/juridique/RUNBOOK-CSAM.md` | Nouveau — procédure interne (brouillon) |
| `commun/backend/.env.production.example` | Doc nouvelles variables env |
| `web/app/src/components/ReportContentModal.tsx` | Catégorie CSAM dans le formulaire |
| `web/app/src/pages/AdminReportsTab.tsx` | Badge urgent + libellés catégorie |
| `web/app/src/types.ts` | `ContentReport.priority` |

---

## Commandes exécutées

```text
cd commun/backend && npx tsc -b                 → ✅ 0 erreur
cd commun/backend && npx vitest run             → ✅ 105 fichiers, 502 tests
cd commun/backend && npx eslint <fichiers>      → ✅ 0 erreur
cd web/app && npx tsc -b                        → ✅ 0 erreur
cd web/app && npx eslint <fichiers>             → ✅ 0 erreur
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (suite complète) | ✅ 502/502 |
| Build TypeScript backend + frontend | ✅ |
| Lint fichiers modifiés (backend + frontend) | ✅ |
| Test manuel (Sightengine réel / live réel) | ❌ non fait — nécessite un compte Sightengine avec quota `face-age`/`gore-2.0`/`weapon` actifs et un live Cloudflare Stream réel ; à valider en staging avant confiance totale en prod |

---

## modification.txt

- [x] Entrée ajoutée — `MODIF 1342 — Audit technique : implémentation priorités critiques/élevées Phase 7 & DDOS-2`

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| **Validation avocat du RUNBOOK-CSAM.md** | Le document est un brouillon opérationnel — la procédure de signalement PHAROS/NCMEC doit être validée lors du rendez-vous avocat déjà planifié avant d'être considérée comme définitive. |
| **Coût Sightengine accru** | `face-age` + `gore-2.0` + `weapon` sont maintenant appelés sur **tous** les scans image (au lieu de 2 modèles, on en appelle jusqu'à 5) — impact direct sur la facture Sightengine au volume. Vérifier le plan tarifaire actuel avant montée en charge. |
| **Validation Sightengine en conditions réelles** | Je n'ai pas pu tester avec un vrai compte Sightengine (pas de credentials dispo dans cette session) — les noms de modèles/champs (`face-age`, `faces[].attributes.age.minor`, `gore.prob`, `weapon.classes`) sont basés sur la documentation officielle Sightengine (vérifiée via recherche web) mais **pas testés en conditions réelles**. Recommandation : tester en staging avec quelques images réelles avant de considérer la protection CSAM comme opérationnelle. |
| **Live frame sampling — MVP Cloudflare Stream uniquement** | Ne couvre pas les lives WebRTC/LiveKit purs. Étendre à LiveKit nécessiterait une piste d'egress dédiée (effort M/L, non traité cette session). |
| **Items non traités (nécessitent décision business/légale/infra-prod)** | Voir liste ci-dessous — non implémentés intentionnellement. |
| **MOD-7 (file de revue « ambiguë »)** | Non implémenté cette session (effort M, priorité moyenne) — le mécanisme reste tout-ou-rien (allow/deny). |
| **Stripe test key en prod, purge historique Git, révocation rôle DB, Cloudflare WAF/DNS, captcha Turnstile, hash-matching PhotoDNA/NCMEC** | Hors périmètre code pur — nécessitent respectivement une décision business (clé Stripe live), une opération destructive à valider explicitement (git history), un accès SSH prod avec validation (DB), un accès DNS externe (Cloudflare), un compte externe (Turnstile), un budget/fournisseur tiers (PhotoDNA/Thorn). |

---

## Prochaines étapes

1. Tester en staging avec un vrai compte Sightengine (image réelle contenant un visage jeune + nudité simulée légale, pour valider `minor_risk` sans faux négatif majeur) avant de considérer la protection CSAM pleinement opérationnelle.
2. Faire valider `RUNBOOK-CSAM.md` par l'avocat (rendez-vous déjà planifié).
3. Décider si `SIGHTENGINE_MINOR_THRESHOLD`/`SIGHTENGINE_VIOLENCE_THRESHOLD` doivent être ajustés après quelques semaines de volume réel (taux de faux positifs).
4. Prochaine vague suggérée (Phase 5/8/9/12 de l'audit) : notification Sentry sur mobile Capacitor, mode `needs_review` (MOD-7), extension du live frame sampling à LiveKit, alignement rétention logs vs politique de confidentialité (12 mois annoncés vs ~4-5 mois réels).

---

## Notes techniques

- Le score `faces[].attributes.age.minor` de Sightengine est un float 0-1 ; seuil par défaut `0.5`, combiné à un signal nudité/suggestif ≥ `0.3` avant de déclencher `minor_risk` — volontairement plus bas que le seuil adulte classique (`0.85`) car la combinaison mineur+suggestif est jugée plus grave qu'une nudité adulte isolée.
- `liveContentSampling.ts` utilise un nettoyage « paresseux » : si un live se termine par un chemin qui n'appelle pas explicitement `stopLiveContentSampling`, le prochain tick (max ~45s plus tard) détecte `live.isActive === false` et s'auto-nettoie — évite d'avoir à instrumenter chaque point de sortie et un risque de dépendance circulaire entre `liveContentSampling.ts` et `adminContentModeration.ts`.
- Toutes les nouvelles variables d'environnement ont des valeurs par défaut sûres (activées par défaut pour la sécurité, désactivables explicitement) — aucune n'est requise pour que le comportement existant continue de fonctionner.

---

*Généré par Soundy Dev Agent*
