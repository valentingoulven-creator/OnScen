# Soundy — Instructions agents

## Cursor Cloud

- Dev local : `npm run dev` → http://localhost:5173 (API :4080)
- Infra agent : `commun/scripts/verify-full-access.ps1` · `commun/scripts/setup-infra-access.ps1` · règle `.cursor/rules/infra-access.mdc`
- Preprod : `commun/scripts/deploy-preprod.ps1` → staging.getsoundy.com
- Prod : **ne jamais** déployer sans demande explicite → `commun/scripts/deploy-prod.ps1`
- Source frontend : `web/app/src/` · mobile overrides : `ios/apptel/src/` uniquement
- Changelog significatif : entrée en fin de `modification.txt`
- **Stack scale :** [`commun/docs/STACK-CIBLE.md`](./commun/docs/STACK-CIBLE.md) · checklist 500k : `commun/msdev/SCALABILITY.md`

## Agent Dev (implémentation)

- Règle : `@soundy-dev-agent` (`.cursor/rules/soundy-dev-agent.mdc`)
- Guide : [`commun/docs/SOUNDY-DEV-AGENT.md`](./commun/docs/SOUNDY-DEV-AGENT.md)
- Rapports : [`commun/docs/dev-agent/INDEX.md`](./commun/docs/dev-agent/INDEX.md) — un rapport par session significative

Usage : bugs, features, refactors, tests. **Rapport obligatoire** en fin de session (fichier + résumé chat).

## Agent CTO (architecture & audits)

- Règle : `@soundy-cto` (`.cursor/rules/soundy-cto.mdc`)
- Prompt complet : [`commun/docs/SOUNDY-CTO-PROMPT.md`](./commun/docs/SOUNDY-CTO-PROMPT.md)

Usage : audits, choix d'architecture, revue sécurité/légal/UX/infra, arbitrage technique **avant** implémentation. Analyse et recommande — n'implémente pas (→ `@soundy-dev-agent`).

## Projet Soundy CEO IA

Workspace dédié : [`Soundy-CEO-IA.code-workspace`](./Soundy-CEO-IA.code-workspace)  
Règle agent : `@soundy-ceo-ia` (`.cursor/rules/soundy-ceo-ia.mdc`)  
Prompt complet : [`commun/docs/SOUNDY-CEO-IA-PROMPT.md`](./commun/docs/SOUNDY-CEO-IA-PROMPT.md)

Pour un brief stratégique, croissance ou modèle financier, activer le mode CEO IA — le repo entier est le contexte produit.
