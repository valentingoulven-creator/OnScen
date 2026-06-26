# Soundy — Instructions agents

## Cursor Cloud

- Dev local : `npm run dev` → http://localhost:5173 (API :4080)
- Infra agent : `scripts/verify-full-access.ps1` · `scripts/setup-infra-access.ps1` · règle `.cursor/rules/infra-access.mdc`
- Preprod : `scripts/deploy-preprod.ps1` → staging.getsoundy.com
- Prod : **ne jamais** déployer sans demande explicite → `scripts/deploy-prod.ps1`
- Source frontend : `app/src/` · mobile overrides : `apptel/src/` uniquement
- Changelog significatif : entrée en fin de `modification.txt`
- **Stack scale :** [`docs/STACK-CIBLE.md`](./docs/STACK-CIBLE.md) · checklist 500k : `msdev/SCALABILITY.md`

## Agent Dev (implémentation)

- Règle : `@soundy-dev-agent` (`.cursor/rules/soundy-dev-agent.mdc`)
- Guide : [`docs/SOUNDY-DEV-AGENT.md`](./docs/SOUNDY-DEV-AGENT.md)
- Rapports : [`docs/dev-agent/INDEX.md`](./docs/dev-agent/INDEX.md) — un rapport par session significative

Usage : bugs, features, refactors, tests. **Rapport obligatoire** en fin de session (fichier + résumé chat).

## Projet Soundy CEO IA

Workspace dédié : [`Soundy-CEO-IA.code-workspace`](./Soundy-CEO-IA.code-workspace)  
Règle agent : `@soundy-ceo-ia` (`.cursor/rules/soundy-ceo-ia.mdc`)  
Prompt complet : [`docs/SOUNDY-CEO-IA-PROMPT.md`](./docs/SOUNDY-CEO-IA-PROMPT.md)

Pour un brief stratégique, croissance ou modèle financier, activer le mode CEO IA — le repo entier est le contexte produit.
