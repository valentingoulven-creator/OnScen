# Rapport — P1 audit 21h

STATUS: PARTIEL

## Objectif
Corriger les P1 de l’audit 21h que le code / l’ops permettent. Steps P0 PhotoDNA pour le fondateur, sans déployer.

## Résultat
- Live 18 ans : backend + CGU web (pas d’override tel).
- Log bootstrap inscriptions = mode réel (`ACCESS_REGISTRATION_MODE`).
- Resend : refuse `@resend.dev` en prod, wrap erreur sandbox, `ALERT_EMAIL`, health smtp `error` si From sandbox.
- Staging disque **80 % → 73 %** (`public.bak` + apt + journal).
- P0 non implémenté (contrat / assume + deploy). Steps : `commun/docs/audit/2026-08-20-21h-go-prod/P0-03-steps.md`.

## Fichiers
`ageGates.ts`, `profileAge.ts`, legal web + `legalDocuments*`, `bootstrap.ts`, `emailSend.ts`, `healthChecks.ts`, `productionStartup.ts`, `alertNotifier.ts`, `commun/docs/RESEND-PROD.md`

## Tests faits
`vitest` 5 fichiers / 45 tests OK (`ageGates`, `emailSend`, `profile`, `csamHashMatch`, `lives.start`).

## Tests non faits
Build app, QA live réel, envoi Resend Production, deploy prod.

## BLOQUÉ (fondateur)
Resend clé Production · `APPLE_TEAM_ID` / IAP · avocat / SACEM · ACRCloud intention · **deploy prod** (SHA) · dons/abos.

## Web / Tel
CGU dans `web/app/src/content/legal/` (partagé). Pas d’override `ios/apptel`.
