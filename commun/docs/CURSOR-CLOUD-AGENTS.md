# Cursor Cloud Agents — OnScen

Configuration repo pour lancer des **Cloud Agents** sur OnScen (VM Ubuntu, msdev).

## Fichiers

| Fichier | Rôle |
|---------|------|
| `.cursor/environment.json` | Install, terminals (API :4080 + Vite :5173), ports |
| `.cursor/cloud-install.sh` | `npm install` idempotent sur la VM |
| `.cursor/cloud-materialize-env.mjs` | Secrets dashboard → `commun/msdev/.env` |
| `.cursor/cloud-secrets.manifest.json` | Liste des clés (sans valeurs) — généré |
| `.cursor/hooks.json` | Sync auto à la fin d'une session Agent locale |
| `commun/scripts/sync-cloud-env.mjs` | Régénère le manifest + empreinte deps |

## Setup initial (une fois)

```powershell
# 1. Sync manifest + hook git pre-push
npm run cloud:sync:install-hook

# 2. Dashboard Cursor
#    https://cursor.com/dashboard/cloud-agents
#    → Connecter GitHub (repo Melo / OnScen)
#    → Secrets : copier les clés depuis .cursor/cloud-secrets.manifest.json
#      Valeurs depuis commun/msdev/.env LOCAL (Runtime Secret pour API keys)

# 3. Lancer un Cloud Agent depuis une branche pushée
#    (le code local non commité n'est PAS synchronisé automatiquement)
```

## Sync continue (local → cloud)

| Déclencheur | Action |
|-------------|--------|
| Fin de session Agent (`stop` hook) | `sync-cloud-env.mjs --if-changed` |
| `git push` (pre-push hook) | idem — manifest à jour sur le remote |
| Manuel | `npm run cloud:sync` |

**Ce qui se synchronise via Git :** `environment.json`, scripts install, manifest des clés, lockfiles.

**Ce qui ne se synchronise PAS automatiquement :**
- Valeurs de `commun/msdev/.env` → **dashboard Secrets** (manuel)
- Changements non commités → commit + push avant Cloud Agent
- SSH VPS / deploy prod → rester en **Client local**

## Cloud vs local OnScen

| Tâche | Client | Cloud |
|-------|--------|-------|
| `npm run dev` + secrets `.env` | ✅ | ✅ (après secrets dashboard) |
| Deploy `deploy-prod.ps1` | ✅ | ❌ |
| SSH `soundy-prod` | ✅ | ❌ (tunnel requis) |
| PR draft + tests autonomes | manuel | ✅ |

## Terminals cloud

1. **onscen-api** — `commun/backend` msdev `:4080`
2. **onscen-web** — Vite `:5173` (proxy API → 4080)

Ports forwardés : 5173 (web), 4080 (api).

## Checklist secrets (premier agent)

```powershell
npm run cloud:checklist
```

Fichier détaillé : `.cursor/cloud-secrets.tiers.json` (P0 boot → P4 modération).

**P0 minimum dashboard** (Environment Variable sauf JWT_SECRET = Runtime Secret) :

| Clé | Valeur cloud |
|-----|----------------|
| `APP_ENV` | `msdev` |
| `PORT` | `4080` |
| `HOST` | `0.0.0.0` |
| `JWT_SECRET` | copier depuis `commun/msdev/.env` local |
| `WEB_APP_URL` | `http://localhost:5173` |
| `API_BASE_URL` | `http://localhost:4080/api` |
| `SOCKET_URL` | `http://localhost:4080` |
| `VITE_APP_ENV` | `msdev` |
| `VITE_DESIGN_QUICK_WINS` | `1` |

**P1 salons YouTube** : `YOUTUBE_API_KEY` (+ OAuth Google si login test).

**P2** : `DATABASE_URL` optionnel (sinon store.json sur la VM).


- **Secrets absents** : dashboard → redémarrer l'agent après ajout
- **Deps obsolètes** : `install` relance `npm install` à chaque boot VM
- **Nouvelle clé `.env.example`** : `npm run cloud:sync` → ajouter la clé au dashboard

Doc Cursor : [Cloud agent setup](https://cursor.com/docs/cloud-agent/setup.md)

## Premier agent — smoke test msdev

Prompt prêt à coller : [`../../.cursor/cloud-agent-prompts/01-smoke-msdev-boot.md`](../../.cursor/cloud-agent-prompts/01-smoke-msdev-boot.md)

Résumé : boot API `:4080` + Vite `:5173` → `/health` → carte/geo → salon YouTube → rapport avec screenshots. Compte démo `listener@msdev.local` / `msdev123`.
