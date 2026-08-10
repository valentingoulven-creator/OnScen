# Soundly — Architecture monorepo (4 stacks)

```
web/app/src/          ← SOURCE DE VÉRITÉ  (web + mobile)
ios/apptel/src/       ← OVERRIDES ONLY    (téléphone)
commun/backend/       ← API + public/     (web + mobile)
```

## Structure du repo

```
OnScen/
├── web/              Stack web (Vite → commun/backend/public/)
│   └── app/
├── ios/              Stack iOS (Capacitor + Xcode)
│   └── apptel/
├── android/          Stack Android (APK/AAB + export PWA)
│   └── OnScen-Mobile/
└── commun/           Partagé web / iOS / Android
    ├── backend/
    ├── scripts/
    ├── deploy/
    ├── docs/
    ├── msdev/
    └── tests/
```

Voir aussi : [`web/README.md`](web/README.md) · [`ios/README.md`](ios/README.md) · [`android/README.md`](android/README.md) · [`commun/README.md`](commun/README.md)

---

## Règle d'or : où coder quoi ?

| Situation | Où modifier |
|---|---|
| Logique métier, composant partagé, hook, lib | `web/app/src/` uniquement |
| UI différente sur téléphone (safe-area, taille…) | `ios/apptel/src/<fichier>` (override) |
| Nouvelle feature pour les deux apps | `web/app/src/` → automatiquement dans les deux |
| Feature web seulement | `web/app/src/` (pas dans apptel/src) |

---

## Commandes

```bash
# Développement
npm run dev               # backend :4080 + web :5173
npm run appweb:dev        # webapp seule
npm run apptel:dev        # téléphone :4082

# Build production
npm run appweb:build
npm run apptel:build

# Diagnostic : voir quels fichiers sont partagés vs overrides
npm run src:status

# Nettoyer les doublons dans apptel/src
npm run src:clean
npm run src:clean:dry
```

---

## Production & ops

Runbook VPS : [`commun/deploy/RUNBOOK-PROD.md`](commun/deploy/RUNBOOK-PROD.md)

Deploy : `npm run deploy:prod` · `npm run deploy:preprod`

**Dev local** : ne pas synchroniser `commun/msdev/data/` via iCloud — voir [`commun/msdev/data/README.md`](commun/msdev/data/README.md).
