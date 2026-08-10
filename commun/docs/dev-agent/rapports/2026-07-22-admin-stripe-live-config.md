# Rapport Dev Agent — 2026-07-22 — Config Stripe live depuis l'admin

**Agent :** @onscen-dev-agent
**Date :** 2026-07-22
**Durée estimée :** ~2 h
**Statut global :** ✅ Terminé

---

## Mission

Permettre à un founder/admin (Dev staff) de saisir/mettre à jour les clés
Stripe **live** (secret key, publishable key, webhook secret) directement
depuis l'onglet Admin de l'app, sans SSH ni édition manuelle du `.env` sur
le VPS.

---

## Contexte / problème

Audit CTO : `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY` en mode **test**
(`sk_test_`/`pk_test_`) alors que `APP_ENV=production` et
`DONATIONS_ENABLED=1`. Aucune clé live nulle part dans l'infra. Le code
détecte déjà ce cas et affiche l'alerte `stripe_test_on_production` dans
`prodSaasStatus.ts` (admin → Analytics → Costs). Manque : un moyen pour le
founder de corriger la clé sans SSH.

---

## Actions réalisées

- [x] Exploré l'existant : `AdminPage.tsx`, `prodSaasStatus.ts` (alerte),
  `AdminStripePlatformCard.tsx` (statut Connect existant, pas de saisie),
  `stripeClient.ts` (cache Stripe **par clé** — hot-reload déjà possible),
  `stripeConfig.ts` (`getStripeKeyMode`), `msdevLanConfig.ts` (pattern
  d'écriture `.env` existant réutilisé), `adminAuditLog.ts` (audit trail),
  conventions rate-limiting admin (`adminAiAgents.ts`).
- [x] Backend : lib de validation/masquage/application (`stripeConfigAdmin.ts`),
  writer `.env` générique (`envFileWriter.ts`), endpoint GET/PUT protégé
  Dev staff + rate limit (`adminStripeConfig.ts`), alias de chemin
  (`paths.ts`).
- [x] Frontend : carte `AdminStripeConfigCard.tsx` (formulaire masqué,
  validation, statut courant), intégrée dans `AdminDonationsTab.tsx`
  (Admin → Analytics → Donations), i18n FR/EN.
- [x] Tests unitaires backend (16 tests, validation + masquage + persistance
  `.env` + hot reload `process.env` + refus si `.env` introuvable).
- [x] `modification.txt` (MODIF 1200) + ce rapport.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/paths.ts` | +`getActiveEnvFilePath()` |
| `commun/backend/src/lib/envFileWriter.ts` | Nouveau — upsert clé=valeur dans un `.env` |
| `commun/backend/src/lib/stripeConfigAdmin.ts` | Nouveau — validation, masquage, statut, application |
| `commun/backend/src/lib/envFileWriter.test.ts` | Nouveau — 3 tests |
| `commun/backend/src/lib/stripeConfigAdmin.test.ts` | Nouveau — 13 tests |
| `commun/backend/src/routes/adminStripeConfig.ts` | Nouveau — GET/PUT `/api/admin/stripe-config` |
| `commun/backend/src/server.ts` | Montage du router |
| `web/app/src/components/AdminStripeConfigCard.tsx` | Nouveau — formulaire admin |
| `web/app/src/pages/AdminDonationsTab.tsx` | Intègre la nouvelle carte |
| `web/app/src/lib/api/admin.ts` | +`getStripeConfig`/`updateStripeConfig` |
| `web/app/src/types.ts` | +`StripeConfigStatus`/`StripeConfigFieldError` |
| `web/app/src/locales/fr.json`, `en.json` | `admin.stripeConfig.*` |
| `modification.txt` | MODIF 1200 |

---

## Commandes exécutées

```text
cd commun/backend && npm test           → ✅ (409/409, 87 fichiers, dont 16 nouveaux)
cd commun/backend && npx tsc --noEmit   → ✅
cd web/app && npx tsc --noEmit          → ✅ (fichiers du projet principal)
cd web/app && npm run build             → ❌ bloqué par src/lib/mapMarkersKey.test.ts
                                            (fichier préexistant non commité, hors
                                            périmètre — erreur TS2322 sans lien avec
                                            cette session)
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend (nouveaux) | ✅ 16/16 (`envFileWriter.test.ts`, `stripeConfigAdmin.test.ts`) |
| Suite complète backend | ✅ 409/409 (87 fichiers) |
| Typecheck backend (`tsc --noEmit`) | ✅ |
| Typecheck frontend (`tsc --noEmit`, hors projet test cassé) | ✅ |
| Build frontend complet (`npm run build`) | ⚠️ bloqué par un fichier préexistant hors scope |
| Test manuel | Non fait (nécessite un environnement avec `.env` réel + rôle Dev staff — voir section Notes) |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1200 — Config Stripe live depuis l'admin (sans SSH))

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| `src/lib/mapMarkersKey.test.ts` (frontend) contient une erreur de type et bloque `npm run build` | Fichier préexistant, non commité, sans lien avec cette session — à corriger séparément (autre sujet : carte/événements) |
| Aucune vraie clé Stripe live n'existe encore dans l'infra | Le founder doit créer le compte Stripe live (ou activer le mode live du compte existant) puis coller les clés via la nouvelle interface admin, ou demander à l'agent de les saisir une fois fournies (jamais en dur dans le code/chat) |

---

## Prochaines étapes

1. Founder : récupérer les clés Stripe live sur le Dashboard Stripe
   (Développeurs → Clés API, en mode Live) et le secret webhook (Webhooks →
   endpoint prod → Signing secret).
2. Se connecter à l'admin (compte Dev staff) → Analytics → Donations →
   carte « Clés Stripe live » → coller les 2–3 valeurs → Appliquer.
3. Vérifier que l'alerte `stripe_test_on_production` disparaît (Analytics →
   Costs) et que `AdminStripePlatformCard` affiche `Mode: Production (live)`.
4. Si le webhook Stripe prod n'existe pas encore côté Stripe Dashboard, le
   créer (URL `https://getsoundy.com/api/donations/stripe-webhook` ou
   équivalent) avant de coller le secret signing.

---

## Notes techniques

### Flux complet saisie → stockage → application

1. Front (`AdminStripeConfigCard.tsx`) valide le format côté client
   (`sk_live_`/`sk_test_`, `pk_live_`/`pk_test_`, `whsec_`, cohérence de
   mode) puis appelle `PUT /api/admin/stripe-config`.
2. Backend (`routes/adminStripeConfig.ts`) : `authenticateJWT` +
   `requireDevStaff` (rôle Dev uniquement) + rate limit 10/15 min (Redis
   cluster-safe, skip en msdev) + re-validation serveur
   (`validateStripeConfigInput`).
3. `applyStripeConfig()` (`lib/stripeConfigAdmin.ts`) :
   - résout le `.env` actif via `getActiveEnvFilePath()` (= `getAppRoot()/.env`,
     le même fichier que PM2 charge en prod/preprod — voir
     `commun/deploy/ecosystem.config.cjs` : `cwd=ROOT`, `env_file=ROOT/.env`) ;
   - **refuse** si ce fichier n'existe pas (pas de création d'un `.env`
     incomplet qui casserait les autres secrets) ;
   - `upsertEnvFileKeys()` remplace/ajoute `STRIPE_SECRET_KEY`,
     `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` sans toucher aux
     autres lignes du fichier ;
   - met à jour `process.env` immédiatement.
4. **Rechargement à chaud confirmé sans redémarrage** : `stripeClient.ts`
   cache son instance Stripe *par valeur de clé* — dès que
   `process.env.STRIPE_SECRET_KEY` change, le prochain appel à
   `getStripeClient()` recrée l'instance avec la nouvelle clé.
   `STRIPE_PUBLISHABLE_KEY` (routes/donations.ts) et
   `STRIPE_WEBHOOK_SECRET` (vérification signature webhook) sont lus
   depuis `process.env` à chaque requête, pas mis en cache. **Aucun
   redémarrage PM2 n'est donc nécessaire.**
5. La réponse (`StripeConfigStatus`) ne renvoie jamais la clé en clair —
   uniquement un aperçu masqué (`sk_live_••••1234`) calculé côté serveur.
   Le formulaire vide ses champs après un succès.

### Sécurité

- Auth : `requireDevStaff` (rôle `dev`, pas simple `admin` opérationnel) —
  cohérent avec les autres endpoints sensibles (`/admin/stripe-platform`,
  `/admin/prod-saas-status`, remboursements paiement).
- Rate limiting : 10 tentatives / 15 min, store Redis cluster-safe
  (`createRateLimitStore`), désactivé en msdev (comme les autres limiteurs
  admin sensibles).
- Audit trail : `logAdminAction` (table `admin_audit_log`) avec la clé
  **masquée** dans les détails — jamais la valeur en clair, ni en DB ni
  en logs console.
- Write-only : la clé secrète et le secret webhook ne sont jamais
  retournés en clair après saisie, seulement un masque 4 derniers
  caractères + préfixe.

### Limitations connues

- Pas de stockage chiffré en base dédié — écriture directe dans le `.env`
  serveur (cohérent avec **tous** les autres secrets du projet :
  `SIGHTENGINE_*`, `SCW_*`, `ANTHROPIC_API_KEY`… il n'existe aucun
  mécanisme de secrets chiffrés en DB dans OnScen à ce jour). Le `.env`
  reste protégé par les permissions filesystem du VPS (`chmod`, accès SSH
  root uniquement).
- `applyStripeConfig()` exige qu'un `.env` existe déjà à l'emplacement
  résolu — en environnement de développement local sans `.env` déployé,
  l'endpoint renvoie une erreur claire plutôt que de créer un fichier
  incomplet.
- Pas de rotation/historique des anciennes clés (écrasement direct,
  traçable seulement via `admin_audit_log` + l'horodatage de la dernière
  modification du fichier `.env` sur le VPS).
- `npm run build` frontend est actuellement bloqué par un fichier de test
  préexistant non lié à cette session (`src/lib/mapMarkersKey.test.ts`,
  non commité) — `tsc --noEmit` sur le projet principal est ✅.

### Test manuel (à faire par le founder ou en preprod)

1. `npm run dev` (msdev) ou déployer en preprod.
2. Se connecter avec un compte `staffRole: 'dev'`.
3. Aller dans Admin → Analytics → Donations.
4. Coller une clé test factice (`sk_test_...`, `pk_test_...`) → Appliquer →
   vérifier que le statut affiche `Mode: Test` et les 4 derniers
   caractères corrects.
5. Vérifier en base/logs que `admin_audit_log` contient une entrée
   `stripe_config_update` avec la clé masquée.
6. Recharger la page → le statut masqué doit persister (lu depuis
   `process.env`, donc valable jusqu'au prochain redémarrage — en prod, il
   sera aussi relu depuis le `.env` au prochain démarrage).

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
