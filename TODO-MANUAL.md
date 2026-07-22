# TODO-MANUAL.md — Tâches non automatisables (post-audit Soundy)



Ces éléments nécessitent une décision produit, une configuration externe, une validation humaine sur device/navigateur, ou une refactorisation majeure planifiée en sprint dédié.



**Dernière revue :** 2026-07-15 (MODIF 1029)



---



## QA manuelle — session 2026-07-15 (MODIF 1009–1029)



Code livré ; à valider sur **390 px mobile**, **desktop**, et **iOS apptel** si applicable.



### Globe & carte

- [ ] Zoom street : pins événement/live restent visibles (globe 3D + carte plate, pas de blackout)

- [ ] Marqueur « Ma position » : pastille indigo + halo (globe) / dot centré (carte) ; FAB Recentrer aligné

- [ ] Rotation auto idle : défilement visuel constant au zoom (pas de ralentissement en vue globale) ; s’arrête au drag



### Live (web)

- [ ] Premier live : chat **épinglé** par défaut (colonne gauche) ; détacher puis rouvrir → préférence conservée

- [ ] Chat épinglé : colonne étroite, **ne chevauche pas** la vidéo (mobile + desktop)

- [ ] **apptel** : layout chat distinct (dock bas) — smoke test séparé



### Profil

- [ ] Propre profil : engrenage → **Paramètres** ; section **Mon compte** (abonnement, déconnexion…) uniquement dans Paramètres, plus sur l’onglet Profil

- [ ] Profil visité : même shell que mon profil (header, onglets, stats allégées)

- [ ] Profil visité header : **Suivre** + **DM** + menu **⋯** (Partager / Signaler) — pas de J’aime ni Message dans l’onglet Profil

- [ ] Lecture : **une seule photo** (avatar) ; pas de galerie ni tags intérêts/genres

- [ ] Édition : écran **sans scroll principal** (~390 px) ; sections cartes ; **Wave + Personnalisé** seulement ; une photo ; « Enregistrer les modifications »



### Fil d’accueil

- [ ] Compose : pas de compteur `0/2000` ; actions (événement / média / Publier) sur **une ligne**

- [ ] Espace visible entre bannière **SPONSORISÉE** (après 1er post) et publication suivante



### Boucle console (LOOP-01)

- [ ] Recharger l'app, tourner le globe : **aucun spam** duplicate-key `Sessions live` dans la console (DevTools)

- **Statut :** ✅ fix MODIF 1030 (clés React dupliquées « Sessions live »)



---



## Critique — Sécurité



### CRIT-01 — JWT → cookies httpOnly (ELEV-01 partiel)

**Statut :** ✅ **Web implémenté** (2026-06-21+) — cookie `soundy_auth` httpOnly Secure SameSite=Strict ; `authStorage.ts` no-op web.

**Reste :** Native Capacitor utilise Keychain/Keystore via override apptel (acceptable stores).

**Risque résiduel :** XSS sur web ne vole plus le JWT (cookie httpOnly).



### ELEV-01 — Révocation JWT (blacklist)

**Statut :** ✅ **Implémenté via `tokenVersion`** — `revokeSessionForToken()` + `POST /api/auth/logout` bump la version ; JWT invalidés sans table jti.

**Alternative future :** blacklist Redis si besoin révocation granulaire avant expiry.



### ELEV-07 — Stores OAuth en mémoire (vs Redis)

**Statut :** ⏳ Ouvert

**Risque :** En cas de redémarrage serveur, états OAuth CSRF en cours perdus.

**Action :** Migrer `oauthStates` / `oauthExchangeCodes` vers Redis ou PostgreSQL TTL.

**Effort estimé :** 0.5 jour si Redis disponible.



---



## Critique — Business / Légal



### C1 — IAP Apple/Google (remplacer Stripe)

**Statut :** ⚠️ **Garde-fous natifs en place** — `CreatorSubscribeSheet`, `LiveDonationSheet` bloquent Stripe sur app native (App Store 3.1.1).

**Reste :** Implémenter StoreKit 2 / Play Billing + sync backend (4–8 semaines).

**Décision produit requise :** modèle web vs mobile natif.



### C3 — Sign in with Apple

**Statut :** ✅ **Code prêt** — backend `GET /api/auth/apple` + UI AuthPage si `APPLE_CLIENT_ID` configuré.

**Reste :** Apple Developer Program + App Store Connect + variables prod `APPLE_*`.



### C6 — Mentions légales incomplètes

**Statut :** ⚠️ **Partiel** — SIREN, hébergeur, DPO email OK ; **adresse postale** via `LEGAL_PUBLISHER_ADDRESS` en prod (non versionnée).

**Action fondateur :** Renseigner `LEGAL_PUBLISHER_ADDRESS` (et optionnellement autres `LEGAL_PUBLISHER_*`) dans `/opt/soundly/.env` prod.

**Fichiers :** `msdev/legal-publisher.example.json`, `commun/deploy/legal-publisher.template.json`, `backend/src/lib/legalPublisher.ts`.



### C7 — URL privacy publique

**Statut :** ✅ **OK** — `GET /privacy` public sans auth (`backend/src/server.ts`).



---



## Architecture — Capacitor Mobile



### C5 — Projet Android manquant

**Statut :** ✅ **Corrigé (2026-07-22)** — `ios/apptel/android/` est gitignoré (jamais absent en réalité, juste invisible aux outils qui respectent `.gitignore` — source de la confusion dans les audits précédents). Build Gradle réel validé (`assembleDebug` → APK 12 Mo, `BUILD SUCCESSFUL`) avec JDK 21 + Android SDK (`platforms;android-36`, `build-tools;36.0.0`) déjà installés sur ce poste.

**Reproductibilité ajoutée** : le projet n'était personnalisé (permissions, deep links, targetSdk 36, FileProvider) que sur ce poste, sans script pour le recréer ailleurs/en CI. Corrigé via `ios/apptel/scripts/patch-android-native.mjs` (appelé automatiquement par `npm run cap:add:android`) + nouveau workflow CI `.github/workflows/android-capacitor.yml` (`ubuntu-latest`, régénère le projet à chaque run et build l'APK debug).

**Reste ouvert (action humaine, pas de code)** :
- `APPLE_TEAM_ID` toujours en placeholder (`TEAM_ID.com.soundy.app`) → nécessite un compte Apple Developer actif (99 $/an).
- `FIREBASE_SERVICE_ACCOUNT_JSON` absent en prod → push natif no-op tant que non configuré (compte Firebase requis).
- Aucun build release (AAB signé) ni soumission Play Console/TestFlight effectuée — décision fondateur sur le calendrier de publication.

```bash
# Régénérer le projet Android depuis un poste/CI vierge
cd ios/apptel
npm run cap:add:android   # npx cap add android + patch permissions/deep links/targetSdk
npm run mobile:cert-pins --prefix ..\..  # régénère network_security_config.xml (pins TLS)
npm run cap:sync:android
cd android && .\gradlew.bat assembleDebug
```



---



## UX — Sprints futurs



### C10 — Onboarding 9 étapes → 3 étapes maximum

**Statut :** ⏳ Sprint futur

**Note :** flux onboarding « jusqu'à 5 photos » non aligné avec profil mono-photo (MODIF 1021–1022) — à revoir produit.



### F1 — Remplacer les alert() / window.confirm() restants

**Statut :** ⏳ Partiel — voir liste fichiers dans historique audit.



---



## React Compiler / ESLint (MODIF 882)



**Statut :** ⚠️ Règles React Compiler (`set-state-in-effect`, `refs`) en **warn** — migration incrémentale ; CI passe sur errors only.

**Hook utilitaire :** `app/src/hooks/useSyncRef.ts` pour remplacer `ref.current = state` au render.



---



---

## Infra ops — priorités audit (manuel)

Checklist détaillée : [`commun/deploy/OPS-PRIORITIES.md`](commun/deploy/OPS-PRIORITIES.md)

| P | Action | Statut |
|---|--------|--------|
| 1 | Cloudflare proxy + WAF + cache `/assets/*` | ⏳ **À faire** — ajouter zone CF + NS OVH (`cloudflare-dns-check.ps1` → `ZONE_MISSING`) |
| 2 | Compte ACRCloud + `ACRCLOUD_*` en prod | ⏳ **À faire** — inscription [acrcloud.com](https://www.acrcloud.com/) |
| 3 | Crons backup staging + vérif PG + S3 | ✅ **Fait** 2026-07-15 |
| 4 | Uptime externe `/health` | ✅ **Fait** — `.github/workflows/uptime-health.yml` |
| 5 | Audit clés `.env` orphelines | ✅ **Fait** — `audit-external-env.cjs` |

**Statut :** ⚠️ P1 et P2 restent manuels (accès OVH / compte ACRCloud).

---

## Résumé priorisation (mise à jour 2026-07-15)



| Priorité | Item | Statut | Risque si non fait |

|----------|------|--------|-------------------|

| 🔴 | QA session MODIF 1009–1029 | ⏳ Checklist ci-dessus | Régressions UX non détectées |

| 🔴 | LOOP-01 erreur console boucle | ⏳ À confirmer | Console spam / perf |

| 🔴 | CRIT-01 JWT httpOnly web | ✅ Fait | — |

| 🔴 | C1 IAP Apple/Google | ⚠️ Garde natif | Rejet App Store sans IAP |

| 🔴 | C3 Sign in with Apple | ⚠️ Config Apple | Rejet si Google sans Apple |

| 🟠 | ELEV-01 Révocation JWT | ✅ tokenVersion | — |

| 🟠 | C6 Mentions légales | ⚠️ Adresse .env | Risque LCEN |

| 🟡 | ELEV-07 Redis OAuth | ⏳ | OAuth restart |

| 🟡 | C5 Android project | ✅ Corrigé 2026-07-22 | — (reste : Apple Team ID, Firebase, soumission stores) |

| 🟡 | React Compiler ESLint | ⚠️ Warn | Dette technique |

| 🟢 | C10 Onboarding | ⏳ | Abandon inscription |

| 🟢 | F1 alert() restants | ⏳ | UX |

