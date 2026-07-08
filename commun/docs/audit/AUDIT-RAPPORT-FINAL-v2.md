# AUDIT SENIOR COMPLET — SOUNDY — RAPPORT DE SUIVI (v2)

Date : 2026-07-08 · Suite de `AUDIT-RAPPORT-FINAL.md` (audit initial du 2026-07-07), après une session de corrections appliquées par 6 agents en parallèle, puis vérifiées par 6 agents de re-audit indépendants.

Rapports détaillés v2 :
- `commun/docs/audit/AUDIT-architecture-code-v2.md`
- `commun/docs/audit/AUDIT-securite-v2.md`
- `commun/docs/audit/AUDIT-stripe-v2.md`
- `commun/docs/audit/AUDIT-db-infra-v2.md`
- `commun/docs/audit/AUDIT-legal-youtube-copyright-v2.md`
- `commun/docs/audit/AUDIT-apis-externes-performance-v2.md`

## 1. Constat transversal le plus important : RIEN N'EST ENCORE EFFECTIF

Deux re-audits indépendants (Sécurité et DB/Infra) ont découvert, avec preuve directe, que **les corrections de code sont réelles et de bonne qualité mais n'ont ni effet sur le dépôt distant, ni effet en production** :

- **Sécurité** : la suppression du suivi Git des 4 fichiers sensibles (credentials, clé privée, données confidentielles) est faite en local (working tree/index) mais **jamais commitée**. `git cat-file -e HEAD:<fichier>` confirme que ces 4 fichiers existent toujours dans le dernier commit (`6838b70a`) et sur `origin/master`. Le dépôt GitHub est confirmé **privé**, ce qui limite l'exposition sans l'annuler.
- **DB/Infra** : vérifié en direct par SSH lecture seule sur `soundy-prod` — `pm2 list` montre toujours **2 workers cluster** actifs malgré la correction locale (`instances: 1`), `schema_migrations` en base s'arrête à la version 27 (les migrations 028/029 ne sont pas appliquées, le `CASCADE DELETE` sur les paiements est donc toujours actif en prod), et `dist/index.js` sur le VPS date d'avant les corrections.

**Conséquence : tant qu'aucun commit + push + déploiement n'a lieu, l'état réel de production reste celui de l'audit initial (score global 64/100), quel que soit l'état du code local.**

## 2. Scores par domaine — avant / après (code local)

| Domaine | Score initial | Score v2 (code local) | Évolution |
|---|---|---|---|
| Architecture & code | 60 | 66 | +6 |
| Sécurité | 78 | **70** | **-8** (voir §1 — fix non commité) |
| Stripe / paiements | 61 | 83 | +22 |
| DB & Infrastructure | 61 | 64 | +3 (68 si code seul, 62 si état prod réel) |
| RGPD | 72 | 86 | +14 |
| YouTube | 68 | 75 | +7 |
| Copyright | 93 | 96 | +3 |
| APIs externes | 78 | 84 | +6 |
| Performance | 82 | 87 | +5 |
| **Moyenne simple** | 72,6 | **79,0** | +6,4 |

## 3. Score global v2 : 68/100 (code local) · 64/100 (état réel de production, inchangé)

Le score du code local progresse (72,6 → 79,0 en moyenne simple), mais la pénalité pour risques Critical non finalisés reste quasi identique tant que :
1. le commit de sécurité n'a pas été fait (fuite toujours active sur le dépôt distant),
2. le déploiement n'a pas eu lieu (RAM/cluster, CASCADE paiements, rate-limiters cluster-safe : tout reste actif en production tel quel).

**Le score global ne peut légitimement dépasser 64/100 jusqu'à ce que ces deux actions soient effectuées.**

## 4. Bilan détaillé par domaine

### Architecture & code (66/100, +6)
5/11 résolus (mojibake, code mort MapView, seuil lint, erreurs ESLint feedPosts/stories), 1 mitigé sans résolution structurelle (PM2 instances:1 — le store RAM reste non partagé, refonte de fond non faite), 5 toujours ouverts et documentés hors scope (strict mode TS, catch silencieux, god-components, dette dépendances, absence de couche services). Aucune régression introduite. Nouveau constat sans lien : 1 test préexistant cassé par le temps (`sponsors.test.ts`, date de festival fictive dépassée).

### Sécurité (70/100, -8)
2/7 pleinement résolus (JWT fallback strict, DSN Sentry factice), 4/7 partiellement résolus (code correct mais **non commité** : fuite Critical, .gitignore, clé TLS, données confidentielles), 1 non corrigé mais justifié (CSP style-src). Nouvelles routes admin de remboursement vérifiées sans régression (même pattern d'autorisation que les autres routeurs admin).

### Stripe / paiements (83/100, +22)
9/11 résolus avec preuve (idempotence, dédup DB, remboursements admin, bug SOUNDY/SOUNDLY, blocage boot, invoice.payment_failed, factory Stripe). 2 Low toujours ouverts (pays FR en dur, identifiants dans script). 356/357 tests passent, 0 régression.

### DB & Infrastructure (64/100 code / 62/100 prod réelle, +3)
2/18 résolus et actifs dès déploiement (rate-limiters geo, chemin backup), 4/18 partiellement résolus (RAM/cluster, CASCADE→SET NULL, flush directMessages capé, FK NOT VALID sur 5 tables), 12/18 toujours ouverts (SPOF triple, PG partagé prod/staging, clé Stripe test en prod, process non versionné, disque staging 73%, etc.). **Rien n'est déployé.**

### RGPD / YouTube / Copyright (86 / 75 / 96, +14 / +7 / +3)
4/8 résolus (purge logs, révocation OAuth, masquage emails, suppression physique du fallback YouTube non-officiel du build prod — vérifiée par build réel), 1 partiel (email pro corrigé, adresse postale réelle toujours manquante — action utilisateur), 3 ouverts (DPA, vérification OAuth Google, branding). **Copyright reconfirmé propre** par re-grep exhaustif incluant tous les nouveaux fichiers.

### APIs externes & Performance (84 / 87, +6 / +5)
7/12 résolus (WebRTC relay-only viewer, monitoring quota, Brotli, WebP, Sentry, UI reconnexion), 1 partiel (lazy-loading — quelques aperçus d'upload restants, impact faible), 4 ouverts et assumés (TTL LiveKit, host WebRTC, Cloudflare CDN/WAF, doc privacy tiers). 0 régression, tests et build OK.

## 5. Actions requises pour que les corrections deviennent réelles

### A. Décision utilisateur requise (ne sera pas fait sans accord explicite)
1. **Commit** des corrections de sécurité (untrack des 4 fichiers sensibles + `.gitignore` corrigé) — indispensable pour que la fuite soit réellement résolue sur le dépôt versionné/distant.
2. **Commit** de l'ensemble des autres corrections (architecture, Stripe, DB/infra, légal, perf) si validées.
3. **Push** vers le dépôt distant.
4. **Déploiement** (preprod puis prod) pour que les correctifs prennent effet sur le serveur réel : PM2 `instances:1`, migrations 028/029, rate-limiters cluster-safe, factory Stripe, monitoring quota, etc.

### B. Actions manuelles externes (hors code, à faire par l'utilisateur quel que soit le commit/déploiement)
1. **Urgent** : changer le mot de passe du compte `yt.audit.demo2.soundy@gmail.com` (et le Gmail associé).
2. Décider d'une purge d'historique Git (BFG/filter-repo) si jugée nécessaire (le repo est privé, ce qui réduit l'urgence sans l'annuler).
3. Renseigner l'adresse postale réelle dans `commun/msdev/legal-publisher.json` avant toute mise en production publique.
4. Soumettre l'app OAuth Google (`youtube.readonly`) à la vérification Google (mode Testing → publié).
5. Signer les DPA avec Scaleway/Cloudflare/Stripe/Resend.
6. Révoquer les privilèges `CREATEROLE`/`CREATEDB` du rôle DB applicatif `soundy` (action SSH/psql).
7. Séparer les instances PostgreSQL prod/staging (actuellement le même hôte).
8. Vérifier/corriger la clé Stripe en mode test constatée sur `APP_ENV=production`.

## 6. Conclusion

La session de corrections a été efficace sur le plan du code (+6,4 points en moyenne, la moitié des problèmes Critical/High résolus ou mitigés, aucune régression détectée sur 6 domaines). **Mais aucun gain n'est aujourd'hui réel pour l'utilisateur final ou pour la sécurité du dépôt**, car rien n'a été commité ni déployé — une découverte qui n'aurait pas été faite sans ce second passage d'audit indépendant.

**Prochaine étape recommandée** : valider le contenu des changements (`git diff`/`git status`), puis décider explicitement du commit et du déploiement (preprod d'abord, comme le prévoit le processus du projet).
