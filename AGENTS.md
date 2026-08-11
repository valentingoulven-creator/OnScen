# OnScen — Instructions agents

## Nouveau développeur

- **Onboarding complet :** [`commun/docs/ONBOARDING-DEVELOPPEUR.md`](./commun/docs/ONBOARDING-DEVELOPPEUR.md) — setup local, architecture, conventions, première semaine.

## Cursor Cloud

- **Setup complet :** [`commun/docs/CURSOR-CLOUD-AGENTS.md`](./commun/docs/CURSOR-CLOUD-AGENTS.md)
- **Config repo :** `.cursor/environment.json` · sync `npm run cloud:sync` · hook `npm run cloud:sync:install-hook`
- **Règles @onscen vides dans le chat ?** [`commun/docs/CURSOR-RULES-TROUBLESHOOTING.md`](./commun/docs/CURSOR-RULES-TROUBLESHOOTING.md)
- **Secrets :** dashboard [Cloud Agents](https://cursor.com/dashboard/cloud-agents) — clés listées dans `.cursor/cloud-secrets.manifest.json` (valeurs depuis `commun/msdev/.env` local, jamais Git)
- **Smoke test cloud :** [`.cursor/cloud-agent-prompts/01-smoke-msdev-boot.md`](./.cursor/cloud-agent-prompts/01-smoke-msdev-boot.md)
- Dev local : `npm run dev` → http://localhost:5173 (API :4080)
- Infra agent : `commun/scripts/verify-full-access.ps1` · `commun/scripts/setup-infra-access.ps1` · règle `.cursor/rules/infra-access.mdc`
- Preprod : `commun/scripts/deploy-preprod.ps1` → staging.onscen.com
- Prod : **ne jamais** déployer sans demande explicite → `commun/scripts/deploy-prod.ps1`
- Source frontend : `web/app/src/` · mobile overrides : `ios/apptel/src/` uniquement
- **Mobile only** : `@mobile-only` · `npm run mobile:override -- create <chemin>` · `npm run mobile:dev` → `:4082/tel/`
- Changelog significatif : entrée en fin de `modification.txt`
- Doc → Google Drive : `npm run docs:gdrive:install` puis `npm run docs:gdrive:watch` (voir `commun/docs/GOOGLE-DRIVE-DOCS-SYNC.md`)
- **Stack scale :** [`commun/docs/STACK-CIBLE.md`](./commun/docs/STACK-CIBLE.md) · checklist 500k : `commun/msdev/SCALABILITY.md`

## Agent Dev (implémentation)

- Règle : `@onscen-dev-agent` (`.cursor/rules/onscen-dev-agent.mdc`)
- Guide : [`commun/docs/ONSCEN-DEV-AGENT.md`](./commun/docs/ONSCEN-DEV-AGENT.md)
- Rapports : [`commun/docs/dev-agent/INDEX.md`](./commun/docs/dev-agent/INDEX.md) — un rapport par session significative

Usage : bugs, features, refactors, tests. **Rapport obligatoire** en fin de session (fichier + résumé chat).

## Agent CTO (architecture & audits)

- Règle : `@onscen-cto` (`.cursor/rules/onscen-cto.mdc`)
- Prompt complet : [`commun/docs/ONSCEN-CTO-PROMPT.md`](./commun/docs/ONSCEN-CTO-PROMPT.md)

Usage : audits, choix d'architecture, revue sécurité/légal/UX/infra, arbitrage technique **avant** implémentation. Analyse et recommande — n'implémente pas (→ `@onscen-dev-agent`).

## Projet OnScen CEO IA

Workspace dédié : [`OnScen-CEO-IA.code-workspace`](./OnScen-CEO-IA.code-workspace)  
Règle agent : `@onscen-ceo-ia` (`.cursor/rules/onscen-ceo-ia.mdc`)  
Prompt complet : [`commun/docs/ONSCEN-CEO-IA-PROMPT.md`](./commun/docs/ONSCEN-CEO-IA-PROMPT.md)

Pour un brief stratégique, croissance ou modèle financier, activer le mode CEO IA — le repo entier est le contexte produit.
