# Restauration d'un compte depuis l'admin — spec

**Statut :** v1 implémentée (scope réduit, voir §Limites) · Date : 2026-07-16
**Auteur :** @soundy-cto (analyse) → @soundy-dev-agent (implémentation)
**Déploiement :** aucun — dev/local uniquement tant que non validé (pas de migration DB requise pour v1)

---

## 1. Problème

Un admin doit pouvoir restaurer les données d'**un seul compte** après corruption (bug, mauvaise action admin, migration ratée) — sans dépendre d'une restauration complète de la base (`pg_dump` quotidien, `commun/deploy/backup-db.sh`), qui écraserait tous les autres comptes.

Contexte complet et alternatives évaluées : voir l'analyse CTO dans la conversation du 2026-07-16 (résumé en §5).

---

## 2. Contrainte architecturale critique

Le flush périodique (10s, `commun/backend/src/lib/pgStore.ts:397-416`) réécrit **intégralement** chaque collection RAM « dirty » vers PostgreSQL, avec un `DELETE FROM x WHERE NOT id = ANY(...)` sur la collection entière.

**Conséquence :** toute restauration doit passer par le store applicatif en mémoire (`db.*` + `schedulePersist()`), **jamais par du SQL direct** sur une base PostgreSQL vivante — sinon la restauration est effacée au flush suivant.

---

## 3. Scope v1 (implémenté)

### Couvert

- **Profil** (`db.users` — champs métier : bio, genres, réseaux, préférences…)
- **Contenu possédé** : `feedPosts`, `userReels`, `stories`, `userAlbums`, `userCompositions` (filtrés par `userId`/`authorId`)

### Explicitement exclu de v1 (roadmap v2, voir §7)

- DM, messages de groupe, chats salon/live (données de **tiers** — plus sensible, plus complexe)
- Follows/followers, matches, hearts, notifications, favoris
- Paiements (dons, abonnements créateur)
- Médias binaires (avatar, vidéos reels, photos stories) — v1 restaure les **métadonnées** (URLs), pas les fichiers eux-mêmes. Si un fichier a été supprimé du stockage entre le snapshot et la restauration, l'URL restaurée pointera vers un fichier absent (à documenter côté UI : « restaure les données, pas les fichiers déjà supprimés »).

### Champs volontairement NON restaurés (sécurité)

`passwordHash`, `mustChangePassword`, `isAdmin`, `accountStatus`, `emailVerified`, tokens/secrets 2FA — un snapshot ne doit jamais permettre de revenir à un ancien mot de passe ou de contourner un blocage de sécurité en cours. La restauration ne touche que les champs « profil/contenu », jamais l'état de sécurité du compte.

---

## 4. Architecture

### Stockage — fichiers locaux, pas de migration DB

```
commun/backend/data/user-snapshots/{userId}/{snapshotId}.json.gz   ← contenu (gzip)
commun/backend/data/user-snapshots/{userId}/{snapshotId}.meta.json  ← métadonnées
```

Choix : pas de nouvelle table PostgreSQL en v1. Le catalogue de snapshots est lu directement depuis le système de fichiers (petits fichiers `.meta.json`). Avantages :

- **Zéro migration** → zéro risque sur la base de données, testable immédiatement en dev/msdev (sans PostgreSQL configuré).
- Découplé de la disponibilité de PostgreSQL — un snapshot reste lisible même si PG est en incident.
- Répertoire hors `public/` → jamais servi par le serveur web statique.

v2 pourra migrer vers un catalogue PostgreSQL (table `user_snapshots`) + synchronisation offsite S3 (`commun/deploy/backup-offsite.sh`) si le volume le justifie.

### Flux

```
Admin → [Sauvegarder maintenant]
  → POST /api/access/admin/users/:userId/snapshots
  → createUserSnapshot(user) : lit db.* en RAM, sérialise, gzip, écrit 2 fichiers
  → logAdminAction('user_snapshot_create')

Admin → [Restaurer] (sur un snapshot listé)
  → POST /api/access/admin/users/:userId/snapshots/:snapshotId/restore
  → restoreUserFromSnapshot() :
      1. Lit + décompresse le fichier snapshot
      2. Fusionne le profil (champs métier only, jamais les champs sécurité — §3)
      3. Remplace le contenu possédé de CET utilisateur uniquement
         (filtre les collections par userId, jamais les autres comptes)
      4. schedulePersistUserToPg(user) + schedulePersist() — jamais de SQL direct
  → logAdminAction('user_restore')
```

### API

| Méthode | Route | Action |
|---------|-------|--------|
| `POST` | `/api/access/admin/users/:userId/snapshots` | Créer un snapshot maintenant |
| `GET` | `/api/access/admin/users/:userId/snapshots` | Lister les snapshots d'un compte |
| `POST` | `/api/access/admin/users/:userId/snapshots/:snapshotId/restore` | Restaurer un snapshot |

Toutes protégées par `authenticateJWT` + `requireAdmin` (pattern identique à `commun/backend/src/routes/access.ts:239-344`), toutes journalisées via `logAdminAction()` (`commun/backend/src/lib/adminAuditLog.ts`).

---

## 5. Résumé de l'analyse CTO (alternatives évaluées)

| Option | Verdict |
|--------|---------|
| A — Extraction depuis le dump complet quotidien | Fallback manuel documenté, pas une fonctionnalité UI (RPO ≤ 24h, script fragile) |
| **B — Snapshot par utilisateur (v1 implémentée)** | **Retenue** — RPO à la demande, réutilise le store applicatif |
| C — Soft-delete / tombstone | Complémentaire, ne couvre pas la corruption de champs (pas de delete) — hors scope v1 |

---

## 6. Sécurité & légal

- Gating : `requireAdmin` — pas de rôle `super_admin` distinct aujourd'hui (limite connue, voir roadmap).
- Le contenu du snapshot n'est jamais exposé brut à l'admin (pas d'URL directe vers le fichier) — seules les métadonnées (date, taille, nombre d'items) sont affichées dans l'UI.
- Audit : chaque création et restauration journalisée (`admin_audit_log`).
- RGPD : v1 ne couvre que les données du titulaire lui-même (pas de données de tiers) — pas d'impact légal nouveau vs l'export existant (`accountDataExport.ts`).

---

## 7. Roadmap v2 (non implémenté)

1. Rôle `super_admin` dédié pour gater cette fonctionnalité plus strictement.
2. Extension aux données de tiers (DM, chats) — nécessite une revue légale/minimisation.
3. Catalogue PostgreSQL + synchronisation offsite S3.
4. Snapshot planifié automatique (cron) pour les comptes actifs/hôtes.
5. Purge automatique des snapshots après rétention (ex. 30-90 jours).
6. Tombstone (option C) pour les suppressions de compte réversibles.

---

## 8. Fichiers livrés (v1)

| Fichier | Rôle |
|---------|------|
| `commun/backend/src/paths.ts` | `getDataDir()` — répertoire privé hors `public/` |
| `commun/backend/src/lib/accountSnapshot.ts` | Création / liste / restauration |
| `commun/backend/src/routes/adminAccountSnapshots.ts` | 3 routes admin |
| `commun/backend/src/server.ts` | Montage du router |
| `web/app/src/lib/api/access.ts` | Fonctions API frontend |
| `web/app/src/types.ts` | Type `UserSnapshotMeta` |
| `web/app/src/components/AdminUserSnapshotsPanel.tsx` | UI snapshots (nouveau composant) |
| `web/app/src/pages/AdminAccountsTab.tsx` | Intégration du panneau dans la fiche compte |
| `web/app/src/locales/fr.json`, `en.json` | Clés i18n |
