# [P0-02] Rotation des secrets du commit historique (sans purge tant que le fondateur n’a pas tranché)

## Contexte
Les audits depuis juillet 2026 documentent des secrets réels dans le commit `72370fc8`. HEAD est propre (`.env` gitignorés). La purge (`git filter-repo`) est **destructive** et interdite sans accord explicite. Le prompt GO prod classe un secret exposé comme STOP CONDITION. Re-vérifié le **2026-08-20**.

## Problème
Quiconque a (eu) accès au repo privé peut extraire ces secrets. La **rotation** n’est pas démontrée. Tant qu’elle ne l’est pas, le P0 reste ouvert même si le repo reste privé.

## Preuve
- `git cat-file -t 72370fc8` → `commit` (2026-08-20).
- `git diff-tree --no-commit-id --name-only -r 72370fc8` : commit volumineux (milliers de chemins) — **ne pas extraire les blobs**.
- Audits : `AUDIT-CONSOLIDE.md` SEC-1 ; `2026-08-11` C4 ; `2026-08-16-go-prod` P0-02 ; `2026-08-20-go-prod/00-synthese.md`.
- Niveau : **VÉRIFIÉ REPO**. Contenu des secrets : **ne pas ouvrir / ne pas copier**. Rotation : **NON VÉRIFIÉ**.

## Impact
NO-GO. Compromission comptes, TLS historique, données fondateur selon les audits antérieurs.

## Résultat attendu
Inventaire des **types** de secrets concernés (sans valeurs) + rotation effectuée **ou** acceptation écrite du fondateur reportant la purge. Le Dev **ne purge pas** Git tout seul.

## Critères d'acceptation
- [ ] Liste des fichiers/chemins historiques (noms seulement) confirmée sans checkout du blob sensible dans le rapport
- [ ] Pour chaque type (mot de passe compte, clé TLS, publisher, etc.) : **roté** ou **expiré** ou **N/A** justifié
- [ ] Nouvelles valeurs uniquement dans `.env` VPS / gestionnaire de secrets — jamais Git
- [ ] Décision fondateur écrite : purge maintenant / plus tard
- [ ] Si purge : plan force-push + invalidation clones — **hors ce ticket Dev** tant que non autorisé

### Suivi Dev 2026-08-20

Rotation **non faite** (l’agent ne dump pas l’historique ni ne recrée les clés). Noms de chemins sensibles dans `72370fc8` (sans ouvrir les blobs) : `commun/docs/youtube-audit-demo-credentials.local.txt`, `commun/msdev/certs/dev-cert.pem`, `commun/msdev/certs/dev-key.pem`, plus des `*.env.example`. **BLOQUÉ fondateur** : rotation prouvée ou acceptation écrite.

## Fichiers concernés
- Historique : `72370fc8` (ne pas extraire le contenu)
- `.gitignore` (déjà en place pour `.env`)
- VPS `/opt/onscen/.env` (rotation in-place, ne pas dumper)
