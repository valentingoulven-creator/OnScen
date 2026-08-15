# Rapport Dev Agent — 2026-08-15 — Web prod sans Face ID / empreinte

**Agent :** @onscen-dev-agent  
**Date :** 2026-08-15  
**Durée estimée :** 0,3 h  
**Statut global :** ✅ Terminé

---

## Mission

Retirer l’API et l’UI Face ID / empreinte (WebAuthn) du site web en production.

---

## Contexte / problème

Le login et les paramètres web proposaient WebAuthn dès que le navigateur exposait un authenticator plateforme. Demande fondateur : plus sur le web en prod. L’app native (iOS/Android) conserve la biométrie.

---

## Actions réalisées

- [x] Helper frontend `isWebAuthnOffered()` (natif = oui, web prod = non)
- [x] Auth + Settings : plus d’UI / plus d’appel `PublicKeyCredential` en web prod
- [x] API `/api/auth/webauthn` : 403 `WEBAUTHN_WEB_DISABLED` pour client web en prod
- [x] Tests unitaires backend

---

## Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `web/app/src/lib/webAuthnUi.ts` | Gate UI |
| `web/app/src/pages/AuthPage.tsx` | Plus de bouton login biométrique en web prod |
| `web/app/src/pages/SettingsPage.tsx` | Plus de bloc Face ID en web prod |
| `web/app/src/components/BiometricSetup.tsx` | No-op si non offert |
| `commun/backend/src/lib/webAuthnPublic.ts` | Gate API |
| `commun/backend/src/routes/webauthn.ts` | Middleware |
| `commun/backend/src/server.ts` | Commentaire |

---

## Commandes exécutées

```text
cd commun/backend && npx vitest run src/lib/webAuthnPublic.test.ts
```

---

## Tests & vérifications

| Vérification | Résultat |
|--------------|----------|
| Tests unitaires backend | ✅ 3/3 `webAuthnPublic.test.ts` |
| Build frontend | non requis (gate UI) |
| Test manuel | après deploy |

---

## modification.txt

- [x] Entrée ajoutée (MODIF 1437)

---

## Bloquers / décisions requises

| Sujet | Action fondateur |
|-------|------------------|
| Deploy prod | requis pour que le site onscen.com reflète le changement |

---

## Prochaines étapes

1. Commit / push / deploy si demandé
2. Vérifier login + paramètres sur https://onscen.com (plus de Face ID)
3. Vérifier que l’app native garde le bouton

---

*Généré par OnScen Dev Agent — ne pas éditer le template `_TEMPLATE.md`*
