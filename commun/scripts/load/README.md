# Tests de charge k6

Prérequis : [k6](https://k6.io/docs/get-started/installation/) installé.

## Smoke (prod ou staging)

```bash
k6 run commun/scripts/load/k6-smoke.js
```

Variables :

| Variable | Défaut |
|----------|--------|
| `BASE_URL` | `https://getsoundy.com` |

Exemple staging :

```bash
BASE_URL=https://staging.getsoundy.com k6 run commun/scripts/load/k6-smoke.js
```

Seuils : < 1 % échecs, p95 < 800 ms sur `/health` et `/`.
