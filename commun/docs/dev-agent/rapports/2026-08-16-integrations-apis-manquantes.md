# Rapport Dev Agent — 2026-08-16 — Intégrations : API manquantes

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-16  
**Durée estimée :** 0,4 h  
**Statut global :** ✅ Terminé

---

## Mission

Mettre dans l’onglet Admin → Intégrations toutes les API réellement utilisées par OnScen.

---

## Actions réalisées

- [x] Ajouter Apple, Turnstile, PhotoDNA, Sentry (éditables)
- [x] Ajouter Redis en lecture seule (pas d’écriture `REDIS_URL`)
- [x] Comptes / i18n / tests

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `commun/backend/src/lib/externalSecretsRegistry.ts` | 5 providers |
| `commun/backend/src/lib/externalSecretsAdmin.ts` | `readOnly` |
| `commun/backend/src/lib/integrationAccounts.ts` | Comptes |
| `web/app/src/components/AdminExternalSecretProviderCard.tsx` | Pas de Configurer si lecture seule |
| `web/app/src/locales/fr.json` / `en.json` | Libellés |

---

## Commandes exécutées

```text
cd commun/backend && npm test -- …registry/admin/accounts/stripe → ✅ 51/51
```

---

## modification.txt

- [x] MODIF 1441

---

*Généré par OnScen Dev Agent*
