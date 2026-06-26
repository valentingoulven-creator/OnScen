# Soundy Dev Agent — Guide d'utilisation

Agent Cursor dédié à **l'implémentation** : bugs, features, refactors ciblés, tests, build.

---

## Activer l'agent

1. Nouvelle conversation **Agent** dans Cursor.
2. Mentionner `@soundy-dev-agent` ou coller une mission du type :

```markdown
@soundy-dev-agent

Mission : implémenter CRIT-01 — migration JWT vers cookies httpOnly.
Scope : backend cookie-login + middleware + retrait authStorage frontend.
Ne pas commit. Rapport en fin de session.
```

3. Les règles projet (`mobile-responsive`, `modification-log`, `deploy-prod`) restent actives.

---

## Ce que fait l'agent Dev

| Fait | Ne fait pas |
|------|-------------|
| Lit et modifie le code | Décisions business / légal |
| Lance tests et build locaux | Deploy prod sans ordre |
| Écrit `modification.txt` si significatif | Commit/push sans demande |
| **Produit un rapport de session** | Stratégie long terme → `@soundy-ceo-ia` |

---

## Rapports de session

Chaque session dev significative produit :

| Fichier | Rôle |
|---------|------|
| `docs/dev-agent/rapports/YYYY-MM-DD-slug.md` | Rapport détaillé |
| `docs/dev-agent/INDEX.md` | Index chronologique |
| Message final chat | Résumé 5–10 lignes |

Template : [`docs/dev-agent/rapports/_TEMPLATE.md`](./dev-agent/rapports/_TEMPLATE.md)

Index : [`docs/dev-agent/INDEX.md`](./dev-agent/INDEX.md)

---

## Missions types (exemples)

```markdown
@soundy-dev-agent — C3 Sign in with Apple (backend + bouton login)
@soundy-dev-agent — F1 remplacer alert() dans DmPage.tsx par ConfirmModal
@soundy-dev-agent — Fix bug [description] — repro : …
@soundy-dev-agent — Audit rapide sécurité authStorage.ts + plan minimal
```

---

## Vérifications standard

```powershell
# Backend
cd backend; npm test

# Frontend
cd app; npm run build

# Dev local (si besoin manuel)
npm run dev
```

---

## Complémentarité avec CEO IA

| Besoin | Agent |
|--------|-------|
| Quoi prioriser cette semaine ? | `@soundy-ceo-ia` |
| Coder la priorité #1 | `@soundy-dev-agent` |
| Brief finances / sponsors | `@soundy-ceo-ia` |
| Implémenter endpoint + admin tab | `@soundy-dev-agent` |

---

*Soundy Dev — `docs/SOUNDY-DEV-AGENT.md`*
