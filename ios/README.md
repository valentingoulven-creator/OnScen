# Stack iOS — OnScen

Projet Capacitor + Xcode pour iPhone/iPad.

## Contenu

| Dossier | Rôle |
|---------|------|
| `apptel/` | Shell Capacitor (Vite tel + overrides `src/`) |
| `apptel/ios/` | Projet Xcode natif |
| `build-ios-ipa-prod.sh` | Build IPA production (macOS) |

## Commandes (depuis la racine)

```bash
npm run apptel:dev              # preview tel http://localhost:4082
npm run capacitor:build         # assets web → apptel/dist
npm run cap:sync --prefix ios/apptel
npm run cap:open:ios --prefix ios/apptel
```

## Source partagée

Le plugin Vite `apptelSrcFallback` charge `web/app/src/` pour tout fichier absent de `ios/apptel/src/`.
