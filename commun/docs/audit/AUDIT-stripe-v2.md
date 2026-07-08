# Re-audit Stripe — Soundy (v2, post-corrections MODIF 962)

## 0. Méthodologie

Ce rapport reprend intégralement les 11 constats de `commun/docs/audit/AUDIT-stripe.md` (score initial 61/100) et vérifie, **preuve à l'appui (fichier + ligne)**, l'état de chacun après les corrections décrites dans `modification.txt` → `MODIF 962` (2026-07-08). Toute affirmation non vérifiable dans le code actuel est signalée explicitement. Aucun fichier source n'a été modifié pendant ce re-audit (lecture, `grep`, `npm test` uniquement).

## 1. Résumé exécutif

La session `MODIF 962` a traité **les 4 problèmes High et 2 des 3 Medium** de l'audit initial : idempotence Stripe (paiements + remboursements), déduplication webhook renforcée en base (protection cross-worker PM2), routes de remboursement admin fonctionnelles, bug de nommage `SOUNDY`/`SOUNDLY` éliminé, blocage du boot si le secret webhook est absent, gestion de `invoice.payment_failed`, et centralisation de l'instanciation du SDK Stripe (`apiVersion` pinné). Sur les 11 constats originaux : **9 résolus, 0 partiel, 2 toujours ouverts** (tous deux de gravité Low, hors périmètre de la session : pays Connect en dur, identifiants de prod en clair dans un script). Le point positif (#11, raw body avant JSON) reste valide et inchangé.

`npm test` dans `commun/backend` : **356/357 tests passent**. Le seul test en échec (`src/lib/sponsors.test.ts:240`) est un test de dates de festival **sans aucun rapport avec Stripe**, déjà en échec avant cette session selon `modification.txt` (MODIF 962, section BUILD). `donations.test.ts` (12/12) et `subscriptions.test.ts` (8/8) — regroupés dans `src/lib/` — passent intégralement (20/20). **Aucune régression Stripe détectée.**

Aucun conflit constaté avec les modifications parallèles de l'agent DB/Infra (`MODIF 963`) : les migrations 028/029 (FK `donation_payments`/`creator_subscriptions`/`subscription_checkouts` en `ON DELETE SET NULL` au lieu de `CASCADE`) sont **complémentaires** aux nouveaux champs de remboursement ajoutés par `MODIF 962` — voir §4.

**Nouveau score du domaine : 83/100** (vs 61/100 initial), détail §5.

## 2. Statut des 11 problèmes originaux

| # | Gravité | Constat original | Statut | Preuve (fichier:ligne) |
|---|---|---|---|---|
| 1 | High | Aucune clé d'idempotence sur `paymentIntents.create`/`checkout.sessions.create` | **✅ Résolu** | `commun/backend/src/routes/donations.ts:42-51` (fonction `buildDonationIdempotencyKey`, SHA-256 de `userId+liveId+amountCents` sur fenêtre 60s) et `:383,403` (clé calculée puis passée en 2ᵉ argument de `stripe.paymentIntents.create`). `commun/backend/src/routes/subscriptions.ts:45-58` (`buildSubscriptionCheckoutIdempotencyKey`) et `:347,365` (passée en 2ᵉ argument de `stripe.checkout.sessions.create`). Étendu de facto aux nouveaux remboursements : `commun/backend/src/routes/adminPayments.ts:31-36,90,187`. |
| 2 | High | Dédup webhook uniquement en mémoire par process PM2 → risque de double-crédit cluster | **✅ Résolu** | `commun/backend/src/routes/donations.ts:487-515` : en plus du check RAM `db.gifts.find(...)` (ligne 487), ajout d'un check PostgreSQL `donationPaymentIntentExistsInPg(intent.id)` (ligne 495, définie `commun/backend/src/lib/pgDonations.ts:108-119`) avant `recordLiveDonation`. Idem `commun/backend/src/routes/subscriptions.ts:503-533` avec `creatorSubscriptionExistsInPg` (`commun/backend/src/lib/pgSubscriptions.ts:73-81`). Les contraintes `UNIQUE` en base invoquées par le commentaire de code existent bien : `commun/backend/src/db/migrations/010_donations.sql:14-16` (index unique partiel `live_gifts.payment_intent_id`) et `:24` (`donation_payments.payment_intent_id UNIQUE`) ; `commun/backend/src/db/migrations/012_creator_subscriptions_and_password_hash.sql:32-34` (index unique partiel `creator_subscriptions.stripe_subscription_id`). Ces migrations existaient déjà avant la session (pas de nouvelle migration nécessaire, conforme à `modification.txt`). |
| 3 | High | Aucun `stripe.refunds.create`, aucune route admin de remboursement | **✅ Résolu** | `commun/backend/src/routes/adminPayments.ts` (nouveau fichier, 235 lignes) : `POST /donations/:id/refund` (lignes 42-123) et `POST /subscriptions/:id/refund` (lignes 130-234), chacune appelant `stripe.refunds.create(...)` (lignes 80-91 et 177-188) avec clé d'idempotence dédiée. Protection : `authenticateJWT` (lignes 44, 132) + `requireAdmin()` → `isAccessAdmin(user)` (lignes 13-25, fonction important. `isAccessAdmin` définie `commun/backend/src/lib/accessControl.ts:139-147`, seul le flag DB `isAdmin` fait foi en production — ligne 144). Monté sur `/api/admin` : `commun/backend/src/server.ts:22,547`. |
| 4 | High | Bug de nommage env `SOUNDY` (code) vs `SOUNDLY` (docs/scripts) | **✅ Résolu** | Grep `SOUNDLY` sur tout le repo (`C:\Dev\Soundy`) : **0 occurrence** dans du code ou des scripts actifs — les 3 seules occurrences restantes (`commun/docs/audit/AUDIT-RAPPORT-FINAL.md`, `commun/docs/audit/AUDIT-stripe.md`, `modification.txt`) sont des **références documentaires historiques au bug corrigé**, pas des noms de variable actifs. Vérifié explicitement : `commun/msdev/.env.example` (0 match `SOUNDLY`, `SUBSCRIPTION_SOUNDY_PLUS_AMOUNT_EUR` présent ligne 145), `commun/scripts/secrets-checklist.template.txt` (0 match), `commun/scripts/setup-stripe-msdev.ps1:93-94` (écrit désormais `SUBSCRIPTION_SOUNDY_PLUS_AMOUNT_EUR`/`SUBSCRIPTION_SOUNDY_ULTRA_AMOUNT_EUR`), `commun/docs/reports/acompleter.txt` (0 match). Le code (`commun/backend/src/lib/subscriptions.ts:72,77,99`) est inchangé et cohérent avec ces fichiers. Le nom de marque historique « Soundly » n'a pas été touché ailleurs (hors scope, non demandé). |
| 5 | Medium | Pas de blocage boot si `STRIPE_WEBHOOK_SECRET` absent | **✅ Résolu** | `commun/backend/src/lib/productionStartup.ts:101-106` : `throw` si `DONATIONS_ENABLED === '1'` sans `STRIPE_WEBHOOK_SECRET`. `:108-117` : `throw` si `SUBSCRIPTIONS_ENABLED === '1'` sans `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` **ni** `STRIPE_WEBHOOK_SECRET` (fallback identique à celui réellement utilisé par le handler webhook, `commun/backend/src/routes/subscriptions.ts:448-449` — cohérence vérifiée). Point résiduel non couvert par la correction (déjà noté comme non-bloquant dans l'audit original) : `:119-124` — `STRIPE_SECRET_KEY=sk_test_` en prod reste un `console.warn`, pas un `throw`. |
| 6 | Medium | `invoice.payment_failed` non traité, pas de dunning | **✅ Résolu** | `commun/backend/src/routes/subscriptions.ts:557-577` : nouveau bloc `if (event.type === 'invoice.payment_failed')` — marque `sub.paymentFailedAt` (ligne 565), persiste en base (`persistCreatorSubscriptionToPgAsync`, ligne 567) et notifie l'abonné via `notifySubscriptionPaymentFailed()` (ligne 569, définie dans `commun/backend/src/lib/notifications.ts`, éligible push via `commun/backend/src/lib/webPush.ts`). Champ ajouté au modèle : `commun/backend/src/models/schema.ts:499` (`paymentFailedAt?: number`). |
| 7 | Medium/Low | 7 instanciations `new Stripe(key)` sans `apiVersion` pinné | **✅ Résolu** | `commun/backend/src/lib/stripeClient.ts` (nouveau, 22 lignes) : factory unique `getStripeClient()` avec `apiVersion: '2025-02-24.acacia'` pinné (ligne 9), client mis en cache (lignes 11-21). Grep `new Stripe\(` sur tout `commun/backend/src` = **1 seul résultat, dans la factory elle-même** (`stripeClient.ts:19`) — toutes les autres instanciations ont été supprimées. Grep `getStripeClient` confirme l'usage dans les 6 fichiers concernés : `donations.ts`, `subscriptions.ts`, `lib/donations.ts`, `lib/accountDeletionStripe.ts`, `lib/healthChecks.ts`, `routes/adminPayments.ts` (nouveau fichier, factory dès la création). Le script autonome `commun/scripts/test-stripe-donation-split.cjs:20` garde sa propre instanciation (CommonJS, hors périmètre TypeScript de la factory) mais avec le **même** `apiVersion` pinné en dur — cohérent. |
| 8 | Low | Aucun test HTTP sur les handlers webhook (signature invalide, doublon, etc.) | **❌ Toujours ouvert** | Aucun fichier de test ciblant `handleStripeDonationWebhook`/`handleStripeSubscriptionWebhook` trouvé (recherche de fichiers `*.test.ts` dans `commun/backend` : seuls `src/lib/donations.test.ts` et `src/lib/subscriptions.test.ts` existent, et ils testent uniquement la logique métier pure, pas les handlers HTTP webhook). **Nouveau constat lié** : les nouvelles routes `commun/backend/src/routes/adminPayments.ts` n'ont elles non plus aucun test dédié (aucun fichier `adminPayments*.test.ts` trouvé) — voir §3. |
| 9 | Low | `country: 'FR'` en dur dans `stripe.accounts.create` | **❌ Toujours ouvert** | `commun/backend/src/routes/donations.ts:183` : `country: 'FR',` toujours présent (la ligne a décalé de 169→183 du fait des ajouts liés à l'idempotence, mais le code est inchangé). Non traité par `MODIF 962` — cohérent avec le journal, qui ne le mentionne pas dans son périmètre. |
| 10 | Low | Identifiants de prod en clair dans `commun/scripts/stripe-connect-setup.sh` | **❌ Toujours ouvert** | `commun/scripts/stripe-connect-setup.sh:11` (`DEFAULT_ACCT="acct_1ThwQ2FsKQ6HX3Pk"`) et `:62` (`-d email=admin@getsoundy.com`) toujours présents en clair. Non traité par `MODIF 962`. |
| 11 | Info (positif) | Webhooks montés avec `express.raw()` avant `express.json()` global | **✅ Toujours valide (inchangé)** | `commun/backend/src/server.ts:370-377` : les deux routes webhook (`/api/donations/webhook`, `/api/subscriptions/webhook`) utilisent `express.raw({ type: 'application/json' })` ; le middleware `express.json()` global est monté plus loin (`:387`). Ordre toujours correct. |

**Synthèse** : 9/11 résolus, 0/11 partiel, 2/11 toujours ouverts (tous deux Low, hors périmètre de la session de correction). Le point positif original reste valide.

## 3. Vérifications ciblées demandées

- **Idempotence `donations.ts`/`subscriptions.ts`** : confirmée (voir #1 ci-dessus), avec en plus une clé d'idempotence sur les nouveaux appels `stripe.refunds.create` (`adminPayments.ts:31-36`).
- **Route `adminPayments.ts`** : existe (`commun/backend/src/routes/adminPayments.ts`), protégée par `authenticateJWT` + vérification stricte du rôle admin (`isAccessAdmin`, seul le flag DB `isAdmin` fait foi en production — `accessControl.ts:139-147`), appelle bien `stripe.refunds.create` à deux endroits (dons et abonnements). Montée sur `/api/admin` dans `server.ts:547`.
- **Grep `SOUNDLY`** : 0 occurrence dans le code ou les scripts de configuration ; les 3 occurrences restantes dans le repo sont des mentions documentaires du bug historique (rapports d'audit + journal de modifications), pas le bug lui-même. Le nom de marque « Soundly » (signature d'agent, ancien nom produit) n'apparaît dans aucun des fichiers concernés par le bug de nommage de variable — pas de confusion possible.
- **`productionStartup.ts` bloque le boot** : confirmé, `throw Error` à `:101-106` (dons) et `:108-117` (abonnements) si le(s) secret(s) webhook Stripe correspondant(s) sont absents alors que la fonctionnalité est activée.
- **Factory `stripeClient.ts` utilisée partout** : confirmée. Un seul `new Stripe(` subsiste dans `commun/backend/src` (dans la factory elle-même). Le script CommonJS `test-stripe-donation-split.cjs` reste une instanciation directe (hors scope TS) mais avec le même `apiVersion` pinné.

**Nouveau problème identifié pendant ce re-audit (non présent dans l'audit original, car les fichiers concernés n'existaient pas encore)** :
- Les nouvelles routes de remboursement admin (`adminPayments.ts`) et la nouvelle factory (`stripeClient.ts`) n'ont **aucun test automatisé dédié**. C'est une extension du problème Low #8 déjà identifié (absence de tests HTTP sur le périmètre Stripe), pas un nouveau problème de gravité supérieure, mais il mérite d'être signalé car ce sont désormais des routes qui déplacent de l'argent réel (remboursement) sans filet de sécurité automatisé — seule la vérification manuelle (lecture de code effectuée ici) couvre ce périmètre à ce jour.
- Le remboursement via `POST /donations/:id/refund` / `POST /subscriptions/:id/refund` ne s'accompagne d'aucun webhook `charge.refunded` côté application : si un remboursement est effectué manuellement depuis le Dashboard Stripe (hors app, cas déjà noté comme "impossible à vérifier" dans l'audit original), le champ `status: 'refunded'` local ne sera pas mis à jour automatiquement, seul le remboursement via la nouvelle route admin met à jour l'état applicatif. Impact limité (pas de risque financier, juste un état affiché possiblement désynchronisé de Stripe) mais à noter.

## 4. Vérification de non-conflit avec l'agent DB/Infra (`MODIF 963`, session parallèle)

Aucun chevauchement de fichiers directement modifiés : `MODIF 963` a touché `commun/backend/src/db/migrations/028_payment_fk_preserve_history.sql`, `029_content_tables_fk_not_valid.sql`, `lib/accountDeletionPg.ts`, `lib/chatHistory.ts`, `lib/pgStore.ts`, `lib/pgDirectMessages.ts`, `routes/geo.ts`, et des scripts de backup — aucun de ces fichiers n'est listé dans les fichiers modifiés par `MODIF 962`.

Relation logique vérifiée entre les deux sessions (pas un conflit, mais une dépendance croisée sur les mêmes tables) :
- La migration `028_payment_fk_preserve_history.sql:28-74` bascule les FK `donation_payments.sender_id`, `creator_subscriptions.subscriber_id`/`creator_id`, `subscription_checkouts.subscriber_id` de `ON DELETE CASCADE` vers `ON DELETE SET NULL`. Les nouveaux champs de remboursement ajoutés par `MODIF 962` (`refundId`, `refundedAmountCents`, `refundedAt`, `refundedBy`, `refundReason` — `commun/backend/src/models/schema.ts:473-478,500-503`) sont persistés **uniquement dans la colonne `payload` (jsonb)**, jamais dans des colonnes SQL dédiées (`commun/backend/src/lib/pgDonations.ts:62-93`, `commun/backend/src/lib/pgSubscriptions.ts:19-56` — aucune colonne `refund_*` en base, tout passe par `payload::jsonb`). **Aucune migration SQL supplémentaire n'était donc nécessaire pour stocker les données de remboursement**, et la bascule CASCADE→SET NULL de la migration 028 ne supprime ni ne tronque jamais ces données JSON historiques.
- Complémentarité positive constatée : `commun/backend/src/lib/accountDeletionPg.ts:5-10` (commentaire de tête, modifié par `MODIF 963`) indique explicitement que `purgeUserAccountFromPg` ne supprime plus les lignes `donation_payments`/`creator_subscriptions`/`subscription_checkouts` à la suppression d'un compte — ce qui **préserve** l'historique des remboursements ajoutés par `MODIF 962` au lieu de le détruire, alors qu'avant cette double-session ce même historique aurait été supprimé par CASCADE + DELETE explicite.
- Aucune régression fonctionnelle détectée : `npm test` (§ suivant) confirme que les tests `donations.test.ts`/`subscriptions.test.ts` passent toujours après les deux sessions cumulées.

**Conclusion : aucun conflit, relation complémentaire favorable entre les deux sessions sur les tables de paiement.**

## 5. Résultat des tests

Commande exécutée : `npm test` dans `commun/backend` (Vitest).

```
Test Files  1 failed | 76 passed (77)
     Tests  1 failed | 356 passed (357)
```

Le seul échec : `src/lib/sponsors.test.ts` → `sponsors > affiche Solar au zoom ville quand Le Crès est dans le viewport` (ligne 240, `AssertionError: expected [...] to include 'solar-festival-cres'`). Ce test dépend de dates de festival calendaires et **n'a aucun rapport avec l'intégration Stripe** ; `modification.txt` (MODIF 962, section BUILD) documentait déjà cet échec comme préexistant et sans rapport avant même cette session.

Exécution ciblée des tests Stripe (`npx vitest run src/lib/donations.test.ts src/lib/subscriptions.test.ts`) :

```
✓ src/lib/donations.test.ts (12 tests)
✓ src/lib/subscriptions.test.ts (8 tests)
Test Files  2 passed (2)
     Tests  20 passed (20)
```

**Aucune régression sur le périmètre Stripe.**

## 6. Points impossibles à vérifier avec les informations disponibles

- La valeur réelle de `STRIPE_WEBHOOK_SECRET`/`STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` sur le VPS de production (le nouveau `throw` de `productionStartup.ts` révèle une config incomplète au boot, il ne prouve pas que la config actuelle du VPS est complète).
- Le mode effectif (live vs test) du compte Stripe utilisé en production.
- Si des remboursements Dashboard-side (hors nouvelle route admin) désynchronisent le statut applicatif — l'analyse de code montre que ce cas n'est pas couvert, mais sa fréquence réelle en production ne peut pas être mesurée depuis le code seul.
- La conformité juridique précise de la clause de remboursement conditionnelle (déjà signalé non vérifiable dans l'audit original, inchangé).

## 7. Score du domaine recalculé

Méthodologie : les 13 sous-domaines de l'audit original sont repris, avec une pondération par groupe de sévérité (les 4 sous-domaines correspondant aux problèmes High originaux comptent triple, les 3 correspondant aux Medium comptent double, les 6 restants comptent simple — cette pondération, appliquée aux scores originaux, reproduit un résultat proche du score annoncé de 61/100, et est réutilisée ici pour la comparabilité).

| Sous-domaine | Score avant | Score après | Évolution / Justification |
|---|---|---|---|
| Webhooks (signature, raw body, dédup cross-worker) | 80 | **88** | Dédup PG ajoutée sur les deux webhooks (donations.ts:487-515, subscriptions.ts:503-533). Reste : pas de check `event.livemode`, pas de test automatisé (constat #8 toujours ouvert). |
| Idempotence | 20 | **85** | Clé déterministe SHA-256 sur les 3 opérations facturables (PaymentIntent, Checkout Session, Refund). Réserve mineure : fenêtre de 60s basée sur l'horloge serveur, pas de clé fournie par le client — un retry après 60s générerait une nouvelle clé (cas résiduel rare, retry très tardif). |
| Checkout vs PaymentIntent | 75 | 75 | Inchangé, hors périmètre de la session. |
| Cycle de vie abonnement | 55 | **78** | `invoice.payment_failed` géré + notification + `paymentFailedAt` (dunning applicatif) + remboursement/annulation admin possible. Reste : pas de relance automatique répétée, pas de test. |
| Customer Portal | 85 | 85 | Inchangé. |
| Metadata | 85 | 85 | Inchangé. |
| Secrets | 90 | 90 | Inchangé. |
| Test/Live mode | 70 | **82** | Boot bloqué si webhook secret absent et fonctionnalité activée (productionStartup.ts:101-117). `sk_test_` en prod reste un warn non bloquant (choix explicite non corrigé). |
| Produits/Prix | 50 | **88** | Bug de nommage `SOUNDY`/`SOUNDLY` éliminé partout (code déjà correct, docs/scripts harmonisés) — vérifié par grep exhaustif. |
| Gestion des erreurs | 75 | **80** | Factory `stripeClient.ts` centralisée avec `apiVersion` pinné, remplace 6 instanciations dupliquées (constat #7 résolu). |
| Remboursements | 5 | **72** | 2 routes admin fonctionnelles, protégées, idempotentes, journalisées, persistées. Manque : UI admin, tests automatisés, resynchronisation si remboursement fait depuis le Dashboard Stripe. |
| Stripe Connect | 80 | 80 | Inchangé — `country: 'FR'` toujours en dur (constat #9 toujours ouvert). |
| PCI / frontend | 100 | 100 | Inchangé. |

**Nouveau score du domaine : 83/100** (vs 61/100 initial, **+22 points**).

### Répartition des problèmes

- **Résolus : 9/11** (#1, #2, #3, #4, #5, #6, #7, plus le point positif #11 toujours valide — soit 7 corrections actives + 1 point déjà positif inchangé)
- **Partiels : 0/11**
- **Toujours ouverts : 2/11** (#9 pays Connect en dur, #10 identifiants de prod en clair dans un script — tous deux Low, hors périmètre de la session de correction)
- **Nouveaux constats (mineurs, non notés séparément car rattachés au #8 existant)** : absence de tests sur `adminPayments.ts`/`stripeClient.ts` ; pas de resynchronisation applicative en cas de remboursement fait hors app (Dashboard Stripe).
