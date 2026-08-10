# Stack Web — OnScen

Frontend web (Vite + React). Source partagée avec iOS/Android via `web/app/src/`.

## Contenu

| Dossier | Rôle |
|---------|------|
| `app/` | Webapp — build vers `commun/backend/public/` |

## Commandes (depuis la racine)

```bash
npm run appweb:dev      # http://localhost:5173
npm run appweb:build    # production → commun/backend/public/
npm run app:build:prod
```

## Développement

Toute logique métier partagée se code dans `web/app/src/`. Les overrides mobile sont dans `ios/apptel/src/`.
