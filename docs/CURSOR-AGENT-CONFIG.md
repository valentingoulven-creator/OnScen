# Configuration Cursor Agent — Soundy

Documentation de la configuration agent Cursor pour le dépôt Soundy (`C:\Dev\Soundy`).

> **Note chemins :** plusieurs règles historiques mentionnent `app/`, `backend/`, `docs/` — la structure actuelle est `web/app/`, `commun/backend/`, `commun/docs/`. Voir [AGENTS.md](../AGENTS.md).

---

## Vue d'ensemble

Cursor combine plusieurs couches pour guider l'agent :

| Couche | Emplacement | Rôle |
|--------|-------------|------|
| Instructions racine | [`AGENTS.md`](../AGENTS.md) | Index : dev local, agents Dev/CEO, liens docs |
| Règles projet | [`.cursor/rules/*.mdc`](../.cursor/rules/) | Contraintes always-on ou activables par `@mention` |
| Settings Cursor | [`.cursor/settings.json`](../.cursor/settings.json) | Plugin AWS Core activé |
| Guides détaillés | [`commun/docs/`](../commun/docs/) | Dev agent, CEO IA, infra, environnements |
| Changelog code | [`modification.txt`](../modification.txt) | Journal des modifs significatives |
| Backlog manuel | [`TODO-MANUAL.md`](../TODO-MANUAL.md) | Tâches non automatisables (audit, QA device) |
| User rules Cursor | *(profil utilisateur)* | Commit, PR, style de réponse — hors repo |

Il n'y a **pas** de dossier `.cursor/skills/` dans ce projet. Les skills Cursor (create-rule, canvas, etc.) sont au niveau **utilisateur** (`~/.cursor/skills-cursor/`).

---

## Fichiers clés et leur rôle

### [`AGENTS.md`](../AGENTS.md)

Point d'entrée pour tout agent Cursor Cloud :
- Dev local : `npm run dev` → http://localhost:5173, API :4080
- Frontend : `web/app/src/` · overrides mobile : `ios/apptel/src/`
- Liens vers règles, guides Dev/CEO, stack (`commun/docs/STACK-CIBLE.md`)

### Règles `.cursor/rules/` (7 fichiers)

| Fichier | `@mention` | `alwaysApply` | Résumé |
|---------|------------|---------------|--------|
| [`deploy-prod.mdc`](../.cursor/rules/deploy-prod.mdc) | — | **true** | Dev / preprod / prod, commandes canoniques, secrets |
| [`infra-access.mdc`](../.cursor/rules/infra-access.mdc) | — | **true** | VPS, DB, SSH, scripts ops, health checks |
| [`mobile-responsive.mdc`](../.cursor/rules/mobile-responsive.mdc) | — | **true** | Mobile-first Tailwind v4, `dvh`, touch 44px, modals |
| [`modification-log.mdc`](../.cursor/rules/modification-log.mdc) | — | **true** | Entrée obligatoire dans `modification.txt` |
| [`soundy-dev-agent.mdc`](../.cursor/rules/soundy-dev-agent.mdc) | `@soundy-dev-agent` | false | Ingénieur implémentation, RACI, rapport session |
| [`soundy-cto.mdc`](../.cursor/rules/soundy-cto.mdc) | `@soundy-cto` | false | CTO virtuel : architecture, audits, sécurité/légal/UX/infra |
| [`soundy-ceo-ia.mdc`](../.cursor/rules/soundy-ceo-ia.mdc) | `@soundy-ceo-ia` | false | CEO virtuel stratégie, brief exécutif, RACI |

### Guides complémentaires

| Document | Rôle |
|----------|------|
| [`commun/docs/SOUNDY-DEV-AGENT.md`](../commun/docs/SOUNDY-DEV-AGENT.md) | Guide d'activation Dev, exemples de missions, vérifications |
| [`commun/docs/SOUNDY-CTO-PROMPT.md`](../commun/docs/SOUNDY-CTO-PROMPT.md) | Prompt complet CTO, format 14 sections, complémentarité agents |
| [`commun/docs/SOUNDY-CEO-IA-PROMPT.md`](../commun/docs/SOUNDY-CEO-IA-PROMPT.md) | Prompt complet CEO IA, format brief, schéma `AiCeoBrief` |
| [`commun/docs/dev-agent/INDEX.md`](../commun/docs/dev-agent/INDEX.md) | Index des rapports Dev |
| [`commun/docs/ENVIRONNEMENTS.md`](../commun/docs/ENVIRONNEMENTS.md) | Environnements dev/staging/prod |
| [`commun/docs/INFRA-SOUNDY.md`](../commun/docs/INFRA-SOUNDY.md) | Infra VPS, PostgreSQL, services |
| [`commun/docs/DEV-WORKFLOW.md`](../commun/docs/DEV-WORKFLOW.md) | Workflow développement |

### Workspace CEO IA

[`Soundy-CEO-IA.code-workspace`](../Soundy-CEO-IA.code-workspace) — ouvre le repo complet avec exclusions `node_modules` / builds Android. Recommandé pour les sessions stratégie.

---

## Comment activer les modes

### Agent Dev — `@soundy-dev-agent`

1. Nouvelle conversation **Agent** dans Cursor.
2. Mentionner `@soundy-dev-agent` + mission explicite (scope, contraintes).
3. Les règles always-on restent actives en parallèle.

**Exemple :**
```markdown
@soundy-dev-agent
Mission : fix bug globe — pins disparaissent au zoom street.
Ne pas commit. Rapport en fin de session.
```

**Usage :** bugs, features, refactors, tests, build local.

### CEO IA — `@soundy-ceo-ia`

1. Ouvrir [`Soundy-CEO-IA.code-workspace`](../Soundy-CEO-IA.code-workspace) (optionnel mais recommandé).
2. Mentionner `@soundy-ceo-ia` pour stratégie, finances, croissance, priorités.
3. Pour l'implémentation : basculer vers `@soundy-dev-agent`.

**Usage :** brief exécutif, arbitrage priorités, modèle financier — **sans modifier le code** sans demande explicite.

### CTO — `@soundy-cto`

1. Nouvelle conversation **Agent** dans Cursor.
2. Taper `@soundy-cto` puis décrire la mission (audit, choix technique, revue pré-feature).
3. Le CTO **analyse et recommande** — pour coder la suite, ouvrir une nouvelle session `@soundy-dev-agent`.

**Exemple — audit auth :**
```markdown
@soundy-cto
Audit complet du flux d'authentification Soundy (JWT, OAuth, 2FA, WebAuthn).
Citer les fichiers réels. Prioriser les risques OWASP. Ne pas coder.
```

**Exemple — choix d'architecture :**
```markdown
@soundy-cto
On veut ajouter des notifications push (iOS + Android + web).
Compare FCM vs OneSignal vs Capacitor natif. Recommande une approche
alignée sur notre stack Capacitor 8 + Express. Estime effort et risques.
```

**Exemple — revue pré-feature :**
```markdown
@soundy-cto
Avant d'implémenter un cache Redis pour le feed géolocalisé :
est-ce le bon moment ? Quelles alternatives (PostgreSQL, in-memory) ?
Impacts RGPD sur la localisation. Plan de dev pour @soundy-dev-agent.
```

**Quand NE PAS utiliser `@soundy-cto` :**
- Bug simple à corriger → `@soundy-dev-agent`
- Brief finances / croissance / sponsors → `@soundy-ceo-ia`
- « Ajoute ce bouton » ou tâche d'implémentation directe → `@soundy-dev-agent`

---

## Règles always-on vs requestable

### Always-on (`alwaysApply: true`)

Injectées dans **chaque** conversation Agent :

- **Deploy / env** — ne pas confondre dev, preprod, prod ; workflow deploy prod en 4 étapes
- **Infra** — accès VPS, scripts, limites (deploy prod sur demande)
- **Mobile responsive** — conventions UI mobile-first
- **Modification log** — journal `modification.txt` après changement significatif

### Requestable (`alwaysApply: false`)

Chargées quand mentionnées ou quand la tâche correspond :

- **`@soundy-dev-agent`** — workflow dev, priorités TODO-MANUAL, rapport obligatoire
- **`@soundy-cto`** — persona CTO, audits, format 14 sections (demandes substantielles)
- **`@soundy-ceo-ia`** — persona CEO, documents stratégiques, format brief

---

## Workflows importants

### Dev local

```powershell
npm run dev
# ou : commun/scripts/dev-start.ps1
# ou : commun/msdev/LANCER-DEV.ps1
```

- App : http://localhost:5173 (Vite HMR)
- API : localhost:4080 (msdev)
- `APP_ENV=msdev` — jamais la prod

### Deploy preprod / staging

Déclenché par : *deploy preprod*, *deploy staging*, *mise en preprod*.

```powershell
powershell -ExecutionPolicy Bypass -File commun/scripts/deploy-preprod.ps1
```

- Auto aussi via GitHub Actions après CI verte sur `main`/`master`
- Première fois : `setup-staging-infra.ps1` + `setup-staging-env.ps1`

### Deploy prod

**Uniquement sur demande explicite** (*deploy prod*, *mise en prod*, etc.).

Ordre obligatoire :
1. Vérifier build + tests
2. Commit local (pas de secrets)
3. Push GitHub
4. `commun/scripts/deploy-prod.ps1`

### Journal `modification.txt`

Après toute modif significative (feature, fix, refonte UI/backend) :
- Entrée en fin de fichier, format existant (TITRE, OBJECTIF, CHANGEMENTS, BUILD)
- Numéroter : `MODIF N — …`
- Ne pas documenter cosmétique ou travail annulé

### Mobile / apptel

- Fixes partagés : `web/app/src/`
- Overrides Capacitor **uniquement** : `ios/apptel/src/`
- QA manuelle listée dans [`TODO-MANUAL.md`](../TODO-MANUAL.md) (390 px, desktop, iOS apptel)

### Rapport Dev Agent (sessions significatives)

1. Créer `commun/docs/dev-agent/rapports/YYYY-MM-DD-slug.md` (template : `_TEMPLATE.md`)
2. Ligne dans `commun/docs/dev-agent/INDEX.md`
3. Résumé 5–10 lignes dans le dernier message chat

### Priorités Dev par défaut (`@soundy-dev-agent`)

1. Sécurité (TODO-MANUAL CRIT/ELEV)
2. Stores mobile (IAP, Sign in with Apple, Android)
3. Légal technique
4. UX / dette
5. Features produit (sur demande)

---

## Comment ajouter ou modifier une règle

1. Créer ou éditer un fichier `.mdc` dans [`.cursor/rules/`](../.cursor/rules/).
2. Frontmatter YAML obligatoire :
   ```yaml
   ---
   description: Courte description pour Cursor
   alwaysApply: true   # ou false pour règle @mention
   ---
   ```
3. Pour une règle activable : `alwaysApply: false` + mention claire dans `description` (ex. `@soundy-dev-agent`).
4. Référencer la nouvelle règle dans [`AGENTS.md`](../AGENTS.md) si elle est un mode agent ou un workflow majeur.
5. Documenter dans `modification.txt` si changement significatif de process.

Skill Cursor utilisateur `create-rule` (`~/.cursor/skills-cursor/create-rule/SKILL.md`) peut guider la création.

---

## Limites et garde-fous

| Action | Comportement agent |
|--------|-------------------|
| Deploy prod | ❌ Sans demande explicite utilisateur |
| Commit / push | ❌ Sans demande explicite |
| Secrets `.env` prod/staging | ❌ Ne jamais committer ; ne pas modifier prod seul |
| Décisions business / légal / pricing | ❌ Dev → escalade fondateur ou `@soundy-ceo-ia` |
| Bannir users / modifier DB / deploy (CEO IA) | ❌ Propositions seulement |
| Contact users ou sponsors | ❌ Drafts seulement (CEO IA) |

**Vérification infra :** `commun/scripts/verify-full-access.ps1` (cible 20+/22 checks OK).

**Health :**
- Prod : https://getsoundy.com/health
- Staging : http://51.159.170.181/health

---

## Complémentarité Dev ↔ CTO ↔ CEO IA

| Besoin | Agent |
|--------|-------|
| Audit sécurité / architecture | `@soundy-cto` |
| Choix technique avant feature | `@soundy-cto` |
| Implémenter la recommandation | `@soundy-dev-agent` |
| Prioriser la semaine (business) | `@soundy-ceo-ia` |
| Brief finances / sponsors | `@soundy-ceo-ia` |
| Bug fix / endpoint / admin tab | `@soundy-dev-agent` |

---

*Dernière synthèse : 2026-07-15 — sources lues : AGENTS.md, 7 règles .mdc, SOUNDY-DEV-AGENT.md, SOUNDY-CTO-PROMPT.md, SOUNDY-CEO-IA-PROMPT.md, Soundy-CEO-IA.code-workspace, TODO-MANUAL.md (intro).*
