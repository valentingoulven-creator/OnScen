# Prompt Cloud Agent #1 — Smoke test msdev

Copier-coller le bloc **PROMPT** ci-dessous dans un nouveau Cloud Agent (branche à jour, secrets P0+P1 configurés).

---

## PROMPT (copier à partir d'ici)

```
Mission : smoke test OnScen msdev sur la VM cloud — vérifier boot API + frontend + carte + salons YouTube.

Contexte repo :
- Monorepo OnScen (OnScen) — msdev uniquement, JAMAIS prod/staging/deploy.
- Config cloud : .cursor/environment.json (terminals soundy-api + soundy-web).
- Secrets déjà dans le dashboard (P0 boot + P1 YOUTUBE_API_KEY recommandé).

Règles strictes :
- Ne pas deploy prod/preprod (pas deploy-prod.ps1, pas SSH VPS).
- Ne pas committer de secrets (.env, clés API).
- Ne pas modifier le code sauf fix minimal bloquant pour faire passer le smoke test (sinon rapport seulement).
- APP_ENV=msdev · pas de données prod.

Étapes :

1) INSTALL & ENV
   - Vérifier que bash .cursor/cloud-install.sh a tourné (ou le relancer).
   - Confirmer commun/msdev/.env et web/app/.env.development existent.
   - WEB_APP_URL=http://localhost:5173 · API :4080

2) DÉMARRER LES SERVICES
   - Terminal soundy-api : cd commun/backend && MSENV=msdev APP_ENV=msdev npm run dev:msdev
   - Terminal soundy-web : cd web/app && npm run dev -- --host 0.0.0.0 --port 5173
   - Attendre que les deux écoutent (logs sans crash).

3) HEALTH API
   - curl -s http://127.0.0.1:4080/health → JSON avec status (db ok ou degraded selon DATABASE_URL).
   - curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4080/api/ → 200 ou 404 acceptable si route racine absente.
   - Noter les erreurs startup dans les logs backend.

4) FRONTEND
   - curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/ → 200.
   - Browser tool : ouvrir http://localhost:5173 — screenshot page d'accueil / auth.

5) CARTE & GLOBE (API)
   - Tester un endpoint carte/geo si disponible (ex. GET /api/geo/nearby ou similar depuis les routes).
   - Si auth requise : utiliser compte démo msdev listener@msdev.local / msdev123 (créé au seed bootstrap).
   - Vérifier réponse JSON non vide ou 401 documenté.

6) SALONS YOUTUBE
   - Si YOUTUBE_API_KEY présente : vérifier qu'un salon ou endpoint musique/YouTube ne renvoie pas 500.
   - Browser : naviguer vers Carte ou Salon si UI accessible sans login complexe.
   - Screenshot si possible.

7) RAPPORT FINAL (markdown)
   - Tableau : Check | Résultat ✅/❌ | Détail
   - Checks : install, API :4080, /health, Vite :5173, carte API, YouTube/salon, screenshots
   - Logs d'erreur pertinents (sans secrets).
   - Si échec : cause racine + fix minimal proposé ou PR draft si trivial.

Ne pas ouvrir de PR sauf fix one-liner évident (typo env, port). Priorité : rapport smoke test complet.
```

---

## Prérequis dashboard

| Tier | Clés |
|------|------|
| **P0** | APP_ENV, PORT, HOST, JWT_SECRET, URLs localhost:5173/4080, VITE_* |
| **P1** | YOUTUBE_API_KEY (salons) |
| **P2** | DATABASE_URL (optionnel — store.json sinon) |

```powershell
npm run cloud:checklist
```

---

## Compte démo msdev (seed auto au boot)

| Champ | Valeur |
|-------|--------|
| Email | `listener@msdev.local` |
| Mot de passe | `msdev123` |

Autres comptes possibles : `dj@msdev.local` (voir seed-msdev).

---

## Succès attendu

- `http://localhost:4080/health` → 200
- `http://localhost:5173` → app React charge
- Pas de crash backend dans les 2 min après boot
- Carte ou geo API répond (200 ou 401 auth, pas 500)
- Rapport agent avec captures d'écran

---

## Variante courte (Slack / comment PR)

```
@cursor Smoke test msdev cloud : lancer soundy-api + soundy-web, curl /health :4080 et :5173, browser screenshot, tester carte + salon YouTube, rapport ✅/❌. Pas de deploy prod.
```
