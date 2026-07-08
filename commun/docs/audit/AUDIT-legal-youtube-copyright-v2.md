# RE-AUDIT SENIOR — RGPD / YouTube / Copyright — Soundy (v2, post-corrections)

Date : 2026-07-08
Portée : re-vérification de `commun/docs/audit/AUDIT-legal-youtube-copyright.md` (scores initiaux RGPD 72/100, YouTube 68/100, Copyright 93/100) après application de `modification.txt` — entrée **MODIF 964**.

Méthodologie : lecture directe du code (fichiers + numéros de ligne cités), exécution réelle de `npm run build:prod` dans `commun/backend` pour vérifier physiquement le contenu de `dist/`, et re-grep exhaustif (insensible à la casse) sur l'intégralité du repo pour les patterns de risque copyright. Aucun fichier de code source n'a été modifié pendant cet audit ; seul ce rapport a été écrit. Aucune affirmation n'est faite sans preuve fichier + ligne(s) ; tout point non vérifiable est marqué explicitement.

---

## 1. Synthèse immédiate

| Catégorie | Problèmes résolus | Partiellement résolus | Toujours ouverts | Total |
|---|---|---|---|---|
| RGPD | 3 (RGPD-2, RGPD-3, RGPD-4) | 1 (RGPD-1) | 1 (RGPD-5) | 5 |
| YouTube | 1 (YT-2) | 0 | 2 (YT-1, YT-3) | 3 |
| **Total** | **4** | **1** | **3** | **8** |

- **Copyright : toujours propre, sans régression** — re-grep exhaustif négatif confirmé (voir §4), et le point de vigilance résiduel (YT-2, code mort Piped/Invidious) est désormais mieux mitigé qu'avant (suppression physique du build prod en plus du garde-fou runtime).
- **Scores recalculés : RGPD 86/100 (+14) · YouTube 75/100 (+7) · Copyright 96/100 (+3)** — détail et justification en §5.

---

## 2. Section RGPD — statut avant/après

### RGPD-1 [High → Partiellement résolu]

**Rappel du problème initial** : `commun/msdev/legal-publisher.json` contenait une adresse postale placeholder implicite et des e-mails de contact/RGPD pointant vers un Gmail personnel (`valentin.goulven@gmail.com`), et `verify-prod.sh` ne détectait pas ce format de placeholder.

**Vérifications effectuées :**

- Fichier actuel `commun/msdev/legal-publisher.json` :
  - L16 : `"contactEmail": "contact@getsoundy.com"` — **corrigé**, plus de Gmail personnel.
  - L17 : `"privacyEmail": "privacy@getsoundy.com"` — **corrigé**.
  - L4 : `"address": "[À COMPLÉTER OBLIGATOIREMENT AVANT PROD — adresse postale réelle de l'entrepreneur individuel, requise par la LCEN art. 6 — voir acompleter.txt]"` — l'adresse réelle **n'est toujours pas renseignée** ; le placeholder est cependant désormais **explicite et bloquant** (voir point suivant), ce qui est la solution attendue tant que l'information réelle n'est pas fournie.
- `commun/backend/src/lib/legalPublisher.ts` L32-38 (`PLACEHOLDER_PATTERNS`) et L40-44 (`isValueUnset`) : la fonction de détection de placeholder reconnaît bien `'à renseigner'`, `'acompleter'`, `'à compléter'` — le nouveau texte L4 du JSON contient `« à compléter »` et `« acompleter »`, donc `isValueUnset('address')` renverra `true`. Confirmé par lecture directe, cohérence vérifiée entre le texte JSON réel et le détecteur.
- `commun/backend/src/lib/legalPublisher.ts` L156-168 (`isPublisherConfigComplete`) inclut `address` dans la liste des champs requis (L161) → la config est donc considérée **incomplète** tant que l'adresse réelle n'est pas fournie. Cette fonction est utilisée en production par :
  - `commun/backend/src/lib/productionStartup.ts` L85 (contrôle au démarrage du serveur)
  - `commun/backend/src/lib/prodSaasStatus.ts` L128, L270 (statut SaaS exposé, gate sur `isDeployedEnv()`)
  - `commun/backend/src/routes/legal.ts` L15 (exposé côté API)
- `commun/deploy/verify-prod.sh` L57 : la regex a été **élargie** :
  ```
  grep -qiE '\[à compléter|à compléter|à renseigner|acompleter|@gmail\.com|@yahoo\.|@hotmail\.|@outlook\.' "$LEGAL_FILE"
  ```
  **Test réel exécuté** (git-bash/grep sur le fichier actuel) : la regex **matche** le fichier `commun/msdev/legal-publisher.json` actuel (confirmé — `MATCH`), donc `verify-prod.sh` déclenche bien `fail` (L58) et retournera un exit code 1 (L174) si ce fichier est copié tel quel en production. Le match est robuste même en cas de souci de locale sur les caractères accentués, car le token ASCII `acompleter` (présent littéralement dans le placeholder, L4) matche seul, indépendamment de la casse des caractères accentués.
- Les e-mails `contact@getsoundy.com`/`privacy@getsoundy.com` ne contiennent aucun des domaines personnels détectés par la regex (`@gmail.com`, `@yahoo.`, `@hotmail.`, `@outlook.`) — pas de faux positif.

**Conclusion RGPD-1** : **Partiellement résolu**. Les deux e-mails sont corrigés (fait, vérifiable, aucune ambiguïté). L'adresse postale réelle reste manquante — **action manuelle externe obligatoire**, mais désormais correctement bloquée par trois gardes-fous indépendants et vérifiés (détecteur `isValueUnset`, statut `isPublisherConfigComplete` exposé à l'admin/CEO-IA, et `verify-prod.sh` qui bloque le déploiement). Le risque juridique (affichage d'un placeholder à l'utilisateur final au lieu d'une fausse information) est neutralisé ; le risque de non-conformité LCEN art. 6 tant que l'adresse réelle n'est pas fournie subsiste, mais c'est un manque d'information, pas un bug.

### RGPD-2 [Medium → Résolu]

**Rappel** : `app_diagnostic_logs` (PII potentielles : `username`, `user_agent`, `url`, `context`) n'était purgée qu'au démarrage/après insertion, jamais par le passage de rétention périodique commun.

**Vérifications :**
- `commun/backend/src/lib/dataRetention.ts` L5 : import de `canPersistDiagnosticLogs, pruneOldDiagnosticLogs` depuis `./appDiagnosticLogs`.
- L58-70 : `runDataRetentionPass()` appelle désormais `pruneOldDiagnosticLogs()` (dans un try/catch non bloquant, no-op si PostgreSQL non configuré via `canPersistDiagnosticLogs()`).
- L42-48 : la signature de `runDataRetentionPass()` est devenue `async` et retourne un champ `diagnosticLogs: number`.
- L85-94 : `startDataRetentionScheduler()` — le passage périodique (`CHECK_INTERVAL_MS` = 6h, L14) et le passage initial appellent désormais la version async avec `.catch()`.
- `commun/backend/src/lib/appDiagnosticLogs.ts` L26 : `RETENTION_INTERVAL = '5 months'` (~150 jours, dans la fourchette 90-180 jours recommandée par l'audit initial).
- L116-123 : `pruneOldDiagnosticLogs()` exécute `DELETE FROM app_diagnostic_logs WHERE created_at < NOW() - INTERVAL '5 months'`.

**Conclusion RGPD-2** : **Résolu**. La purge est désormais intégrée au passage périodique commun (toutes les 6h), avec une fenêtre de rétention cohérente avec le registre RGPD (« 12 mois max » pour les logs techniques — 5 mois est bien inférieur au plafond annoncé).

### RGPD-3 [Medium → Résolu]

**Rappel** : le jeton OAuth YouTube n'était jamais révoqué auprès de Google lors de la suppression de compte (`DELETE /account`), seulement supprimé en base.

**Vérifications :**
- `commun/backend/src/routes/auth.ts` L44 (import `isPlatformConnected`), L65 (import `revokeAndDisconnectYoutube` depuis `../lib/youtubeOAuth`).
- L758-766 :
  ```
  // RGPD : révoquer le jeton OAuth YouTube auprès de Google avant la cascade de
  // suppression, plutôt que de simplement le supprimer en base (voir audit RGPD-3).
  if (isPlatformConnected(user, 'youtube')) {
    try {
      await revokeAndDisconnectYoutube(user);
    } catch (e) {
      console.warn('[account-deletion] révocation YouTube échouée (suppression du compte poursuivie):', e);
    }
  }
  ```
  Ce bloc est situé **avant** `await prepareUserAccountDeletion(userId)` (L768) et `deleteUserAccountCascade(userId)` (L769), dans le bon ordre.
- `commun/backend/src/lib/platformConnect.ts` L44 : `export function isPlatformConnected(user, platform)` existe et est utilisée sans modification de logique.
- `commun/backend/src/lib/youtubeOAuth.ts` L261 : `export async function revokeAndDisconnectYoutube(user: User): Promise<void>` — fonction déjà existante et utilisée par ailleurs lors d'une déconnexion manuelle (`platforms.ts`), désormais réutilisée ici. Échec de révocation loggé mais **non bloquant** pour la suppression de compte (comportement voulu : l'utilisateur ne doit pas être empêché d'exercer son droit à l'effacement si Google est indisponible).

**Conclusion RGPD-3** : **Résolu**. La révocation OAuth est désormais appelée systématiquement avant la cascade de suppression, avec gestion d'échec appropriée.

### RGPD-4 [Low → Résolu]

**Rappel** : e-mails en clair dans des `console.log` de scripts d'administration/seed.

**Vérifications :**
- `commun/backend/src/lib/maskPii.ts` (nouveau fichier, 22 lignes) — L13-21 : `export function maskEmail(email)` : `jean.dupont@example.com` → `j***@example.com` (conserve 1er caractère + domaine, masque le reste avec un minimum de 3 astérisques).
- Usages confirmés par grep :
  - `commun/backend/src/lib/msdevDemoAccounts.ts` L6 (import), L39, L62, L78 (`maskEmail(user.email)`).
  - `commun/backend/src/scripts/create-admin-user.ts` L24 (import), L74, L96.
  - `commun/backend/src/seed-production.ts` L6 (import), L46.
  - `commun/backend/src/seed-msdev.ts` L17 (import), L217.
- Re-grep de contrôle (`console\.(log|warn|error)\([^)]*\$\{[^}]*\.email\}`) sur tout `commun/backend/src` : **0 résultat** — aucun `console.log` restant n'affiche un `.email` brut par interpolation directe.

**Conclusion RGPD-4** : **Résolu**. Les 4 fichiers listés dans l'audit initial masquent désormais l'e-mail via une fonction utilitaire partagée, et le re-grep de contrôle ne trouve aucune régression résiduelle.

### RGPD-5 [Low → Toujours ouvert, inchangé]

**Vérification** : `web/app/src/content/legal/dpa.ts` L51, L70, L86, L104 : `dpaStatus: 'pending'` (Scaleway, Cloudflare, Stripe, Resend) — L119 : `dpaStatus: 'not-required'` pour un 5ᵉ sous-traitant. Aucun changement par rapport à l'audit initial.

**Conclusion RGPD-5** : **Toujours ouvert**. Non traité — action contractuelle hors code, explicitement listée comme non traitée dans `modification.txt` (« Non traité dans le code — action contractuelle, hors code »). Cohérent avec l'attente : ce point ne pouvait pas être résolu par une modification de code.

### Points positifs re-confirmés (inchangés, aucune régression)

- `DELETE /account` conserve la vérification mot de passe/confirmation `SUPPRIMER` (`auth.ts` L733-757), la cascade RAM (`accountDeletion.ts`) et purge SQL (`accountDeletionPg.ts`) — non modifiées par MODIF 964.
- `CookieConsentBanner.tsx`, `sentry.ts` L53, `errorMonitoring.ts` L81, `geo.ts` (`blurCoordinate`) : non touchés par la session de corrections, aucune régression détectée par grep ciblé.

---

## 3. Section YouTube — statut avant/après

### YT-1 [High produit → Toujours ouvert, inchangé]

**Vérification** : `commun/docs/GOOGLE-OAUTH-TEST-USERS.md` — L3 : « Corrige l'erreur `403 access_denied` ... quand l'écran de consentement OAuth est en mode Testing (non vérifié) » ; L48 : « Vérifier que le statut de publication [est] Testing (pas « In production » sans vérification) » ; L15, L69 confirment le même état. Document non modifié par MODIF 964 (absent de la liste « FICHIERS MODIFIÉS »).

**Conclusion YT-1** : **Toujours ouvert**. Confirmé explicitement dans `modification.txt` (« Non traité dans le code — action manuelle prioritaire, hors code — Vérification de l'app OAuth Google… processus externe de revue Google, non contournable par du code »). Aucune preuve disponible dans le repo indiquant un changement de statut réel côté Google Cloud Console — **impossible à vérifier avec les informations disponibles** si le statut a changé depuis (accès Google Cloud Console non effectué dans cet audit, cf. §6).

### YT-2 [Medium → Résolu]

**Rappel** : fallback Piped/Invidious neutralisé uniquement par un garde-fou runtime (`isYoutubeRemoteFallbackAllowed()`), mais le fichier compilé restait physiquement présent dans `dist/` en production.

**Vérifications (code) :**
- `commun/backend/scripts/strip-dev-only-modules.js` (nouveau, 63 lignes) : supprime physiquement `dist/lib/youtubeRemote.js`, `.js.map`, `.d.ts`, `.d.ts.map` (L30-35), avec vérification post-suppression (L47-51 : `process.exit(1)` si le fichier est toujours présent après tentative de suppression).
- `commun/backend/package.json` L8-9 : `"build:prod": "npm run build && node scripts/strip-dev-only-modules.js"` — nouvelle commande distincte de `"build"` (L8, inchangée, utilisée par `build:exe` et le dev local).
- `commun/deploy/deploy_zero_downtime.ps1` L221-226 : le build backend (étape `[2/9]`, hors du bloc conditionnel `$Environment -eq 'prod'` qui ne concerne que le rappel de snapshot) appelle désormais `npm run build:prod` — s'applique donc **aux deux environnements prod et preprod**.
- `commun/backend/src/lib/youtubeSearch.ts` L121-134 et `youtubePlaylists.ts` L58-65 : les deux imports dynamiques `import('./youtubeRemote')` sont entourés d'un `try/catch` — en cas d'absence du fichier (prod/preprod), la requête dégrade proprement (`console.warn`, pas de fallback) au lieu de lever une exception non gérée.
- `commun/backend/src/lib/youtubeRemote.ts` L12-25 : en-tête enrichi documentant explicitement les 3 couches de défense (garde-fou runtime + suppression physique au build + try/catch appelants).

**Vérification empirique (exécution réelle)** : `npm run build:prod` exécuté dans `commun/backend` pendant cet audit.
- Sortie de build : `[strip-dev-only-modules] retiré du build : dist/lib/youtubeRemote.js` puis `[strip-dev-only-modules] OK — fallback Piped/Invidious (non conforme ToS YouTube) exclu du build de production (1 fichier(s)).` — exit code 0.
- Contrôle direct du contenu de `dist/lib/` après build : **absent** — `youtubeRemote.js` ne figure pas dans le dossier.
- Les 8 autres modules YouTube compilés sont bien **présents et intacts** : `youtubeApiErrors.js`, `youtubeCompliance.js`, `youtubeDataApi.js`, `youtubeMetadata.js`, `youtubeOAuth.js`, `youtubePlaylists.js`, `youtubeQuotaBudget.js`, `youtubeSearch.js` — la suppression est bien ciblée et n'a pas cassé le reste de la fonctionnalité YouTube.

**Conclusion YT-2** : **Résolu**, avec preuve d'exécution réelle (pas seulement lecture de code). Défense en profondeur à 3 niveaux confirmée fonctionnelle. Risque résiduel minime et documenté : `npm run build` (sans `:prod`) laisse volontairement le fichier pour l'usage msdev/dev local — cohérent avec l'objectif (le fallback msdev n'est pas un déploiement public).

### YT-3 [Low → Toujours ouvert, inchangé]

**Vérification** : `web/app/src/components/SalonYouTubePlayer.tsx` L505 : `controls: 0,` ; L508 : `modestbranding: 1,`. Attribution compensatoire toujours présente (`PoweredByYouTube.tsx`, `OpenOnYoutubeButton.tsx` existent, confirmés par recherche de fichiers). Aucun changement — ce point n'était pas listé dans le périmètre de MODIF 964.

**Conclusion YT-3** : **Toujours ouvert** (Low, zone grise des Branding Guidelines, non traité — cohérent, non demandé).

### YT-4 [Positif → Inchangé]

`commun/backend/src/lib/youtubeOAuth.ts` L13 : `export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';` — scope minimal inchangé. Cache 1h (`youtubeDataApi.ts`) et gestion de quota (`youtubeQuotaBudget.ts`) non modifiés par MODIF 964 — aucune régression détectée.

---

## 4. Section Copyright — re-confirmation exhaustive (méthodologie identique à l'audit initial)

Grep insensible à la casse sur l'intégralité du repo (`C:\Dev\Soundy`, tous dossiers confondus : `commun/backend`, `commun/msdev`, `web/app`, `ios/apptel`, `android`, tous les nouveaux fichiers créés depuis l'audit initial) :

| Pattern recherché | Résultat | Détail |
|---|---|---|
| `ytdl-core`, `yt-dlp`, `youtube-dl`, `node-ytdl-core` | **0 résultat** dans le code source | Seules occurrences : les deux rapports d'audit eux-mêmes (`AUDIT-legal-youtube-copyright.md`, `AUDIT-RAPPORT-FINAL.md`), qui les citent pour dire qu'ils sont absents |
| `googlevideo.com`, `ytInitialData`, `ytInitialPlayerResponse`, `streamingData`, `adaptiveFormats` | **0 résultat**, y compris dans les rapports d'audit cette fois | Grep global, aucune occurrence nulle part dans le repo |
| Recherche ciblée dans tous les `package.json` (`ytdl-core\|yt-dlp\|youtube-dl\|node-ytdl-core`) | **0 résultat** | Aucune dépendance de téléchargement YouTube ajoutée depuis l'audit initial |
| `ffmpeg` (insensible à la casse, tout le repo) | Seule occurrence dans le **code source** : `commun/backend/src/lib/videoDuration.ts` L3 | Commentaire expliquant l'absence volontaire de ffmpeg (« sans dépendance externe — pas de ffmpeg/ffprobe... ») pour sonder la durée de vidéos **uploadées par les utilisateurs** (reels), sans rapport avec YouTube. Deux autres occurrences dans `modification.txt` (historique de log, tests OBS/streaming local, sans rapport avec YouTube). Identique à l'audit initial, aucune régression |
| Cache local de fichiers média YouTube dans le service worker | **0 résultat** | Re-grep de `youtube`/`googlevideo`/`ytimg` sur `commun/backend/public/sw.js` **et** `web/app/public/sw.js` (nouveau fichier vérifié en plus de l'audit initial) → aucun match dans les deux |
| Nouveaux fichiers créés depuis l'audit initial (`git status` : `commun/backend/scripts/strip-dev-only-modules.js`, `maskPii.ts`, `apiQuotaMonitor.ts`, `stripeClient.ts`, `adminPayments.ts`, migrations `028_*.sql`/`029_*.sql`, `useFloatingChatChromeAutoHide.ts`, etc.) | **0 résultat** sur tous les patterns ci-dessus | Ces fichiers sont couverts par le grep global du repo (aucune exclusion) ; aucun n'introduit de dépendance ou de logique de téléchargement/scraping YouTube. La plupart sont hors périmètre thématique (paiements Stripe, quotas API, UI chat) |

**Régression sur le point de vigilance résiduel (YT-2 / dead code Piped-Invidious)** : **amélioration, pas de régression**. Le code reste identique dans `youtubeRemote.ts`/`youtubeCompliance.ts`/`youtubeSearch.ts`/`youtubePlaylists.ts` (pas de nouvelle route de téléchargement ajoutée), mais il est désormais **physiquement absent du bundle de production** en plus du garde-fou runtime déjà audité — donc le risque résiduel documenté dans l'audit initial (« reste présent et exécutable si mal configuré ») est réduit, comme vérifié empiriquement en §3 (YT-2).

**Conclusion Copyright** : **aucune violation trouvée, aucune régression introduite**. La méthodologie exhaustive de l'audit initial a été intégralement reproduite avec un résultat négatif identique (voire légèrement meilleur sur le point de vigilance résiduel).

---

## 5. Scores recalculés /100

### RGPD : 86/100 *(était 72/100, +14)*

Justification : sur les 5 problèmes de l'audit initial, 3 sont désormais pleinement résolus avec preuve technique directe (RGPD-2 purge automatique intégrée, RGPD-3 révocation OAuth avant suppression de compte, RGPD-4 masquage des e-mails dans les logs). Le problème High (RGPD-1) est passé d'un simple placeholder non détecté et d'un Gmail personnel exposé à un état où : (a) les e-mails de contact/RGPD sont corrects et professionnels, (b) le placeholder d'adresse est désormais correctement détecté à 3 niveaux indépendants (`isValueUnset`, `isPublisherConfigComplete` exposé à l'admin, `verify-prod.sh` qui bloque le déploiement — testé et confirmé fonctionnel dans cet audit). Le score n'atteint pas un niveau plus élevé car l'adresse postale réelle manque toujours (non-conformité LCEN art. 6 tant que non renseignée) et RGPD-5 (DPA `'pending'`) reste totalement ouvert.

### YouTube : 75/100 *(était 68/100, +7)*

Justification : le point Medium (YT-2, code non conforme aux ToS toujours présent en prod) est désormais résolu avec une défense en profondeur vérifiée par exécution réelle (build + contrôle du contenu de `dist/`). Le score ne progresse pas davantage car le point le plus bloquant pour l'usage produit — YT-1, app OAuth Google toujours en mode Testing non vérifié — est un problème **externe à Google**, non affecté par cette session de corrections et toujours ouvert avec la même preuve documentaire qu'à l'audit initial. YT-3 (branding, Low) reste également non traité, sans impact significatif sur le score.

### Copyright : 96/100 *(était 93/100, +3)*

Justification : re-confirmation exhaustive et négative de l'absence de toute violation (téléchargement, extraction, cache permanent, conversion, scraping de contenu YouTube), avec la même méthodologie de recherche que l'audit initial, étendue aux nouveaux fichiers créés par d'autres agents en parallèle (aucun n'introduit de risque). Le score progresse légèrement (+3, pas plus) car le seul point qui empêchait un score maximal — le code mort Piped/Invidious — est désormais mieux neutralisé (suppression physique du build prod vérifiée par exécution réelle, en plus du garde-fou runtime déjà en place), réduisant le risque résiduel « si mal configuré » identifié dans l'audit initial. Le score n'est pas à 100/100 car le code source (`youtubeRemote.ts` et ses appelants) reste présent dans le dépôt et dans les builds non-`:prod` (msdev/dev local), ce qui constitue toujours une dépendance de conception à des outils tiers non officiels, même si elle est désormais neutralisée par 3 couches indépendantes plutôt qu'une seule.

---

## 6. Impossible à vérifier avec les informations disponibles

- Contenu réel de `/opt/soundy/legal-publisher.json` en production (et de sa copie sur le VPS staging) — seule la copie locale `commun/msdev/legal-publisher.json` a été auditée. `modification.txt` indique explicitement que l'adresse réelle n'a pas été renseignée par l'agent (« cette information n'est pas connue de l'agent et n'a pas été inventée »), mais aucun accès SSH/VPS n'a été effectué dans cet audit pour confirmer l'état exact du fichier distant.
- Statut réel et actuel de la vérification de l'app OAuth Google dans la Google Cloud Console (YT-1) — le document `GOOGLE-OAUTH-TEST-USERS.md` n'a pas été modifié depuis l'audit initial ; aucun accès à la Google Cloud Console n'a été effectué.
- Signature effective des DPA avec Scaleway, Cloudflare, Stripe, Resend (RGPD-5) — statut `'pending'` dans le code, mais l'état contractuel réel est hors du repo.
- Exécution réelle et effective de `verify-prod.sh` avant chaque déploiement en production (le script existe et a été testé manuellement dans cet audit avec le fichier actuel, mais son exécution automatique/systématique lors des déploiements réels n'a pas été vérifiée en dehors de la lecture de `deploy_zero_downtime.ps1`).
- Durée de rétention réelle appliquée par Cloudflare sur ses logs (mentionnée « 7 jours par défaut » dans `dpa.ts`, non vérifiable techniquement depuis le code).
- Conformité stricte aux YouTube API Branding Guidelines du choix `controls: 0` (YT-3) — nécessite une revue/validation Google formelle.
- Application réelle en production de `runDataRetentionPass()` toutes les 6h avec purge effective des lignes anciennes de `app_diagnostic_logs` — le code est vérifié et cohérent, mais l'exécution effective en environnement de production (avec `DATABASE_URL` configuré) n'a pas été observée directement (pas d'accès VPS dans cet audit).

---

## 7. Actions manuelles externes toujours requises

1. **[Obligatoire avant prod publique]** Renseigner l'adresse postale réelle de l'entrepreneur individuel dans `commun/msdev/legal-publisher.json` (champ `address`, L4) **et** dans la copie de production sur le VPS (`/opt/soundy/legal-publisher.json`) — action non exécutable par un agent (information non inventable), bloquée par conception par `verify-prod.sh` (confirmé fonctionnel dans cet audit) tant que non faite.
2. **[Priorité produit]** Soumettre l'application OAuth Google (scope `youtube.readonly`) à la vérification Google pour sortir du mode « Testing » — processus externe de revue Google (délai hors contrôle direct), bloque actuellement l'usage de la fonctionnalité YouTube pour tout utilisateur non explicitement whitelisté.
3. **[Contractuel]** Finaliser la signature des DPA standards avec Scaleway, Cloudflare, Stripe, Resend (actuellement `dpaStatus: 'pending'` dans `web/app/src/content/legal/dpa.ts`).
4. **[Optionnel, conformité produit]** Revue formelle des YouTube Branding Guidelines pour le choix `controls: 0` (`SalonYouTubePlayer.tsx` L505) si le volume d'utilisateurs devient significatif.
5. **[Hors périmètre de cet audit, signalé pour information]** `commun/docs/audit/AUDIT-securite.md` (document distinct, non re-vérifié dans cet audit legal/YouTube/copyright) mentionne un fichier `commun/docs/youtube-audit-demo-credentials.local.txt` contenant des identifiants réels en clair, potentiellement suivi par Git — ce point relève de l'audit sécurité, pas de cet audit RGPD/YouTube/Copyright, mais mérite un suivi rapide et séparé.

---

## 8. Synthèse finale

- **8 problèmes réévalués** (5 RGPD + 3 YouTube) : **4 résolus** (RGPD-2, RGPD-3, RGPD-4, YT-2), **1 partiellement résolu** (RGPD-1 : code/détection corrigés, adresse réelle manquante), **3 toujours ouverts** (RGPD-5, YT-1, YT-3 — tous les trois hors périmètre de MODIF 964, deux d'entre eux nécessitant une action externe non codable).
- **Scores** : RGPD **72 → 86** (+14) · YouTube **68 → 75** (+7) · **Copyright 93 → 96** (+3).
- **Copyright confirmé toujours propre** : re-grep exhaustif négatif reproduit à l'identique sur tout le repo (y compris les nouveaux fichiers créés en parallèle par d'autres agents), aucune régression, mitigation du point de vigilance résiduel améliorée (suppression physique du build prod vérifiée par exécution réelle).
