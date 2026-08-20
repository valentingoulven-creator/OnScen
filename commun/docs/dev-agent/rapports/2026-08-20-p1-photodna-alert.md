# Rapport — P1 alerte PhotoDNA

STATUS: DONE

## Objectif
Alerte dédiée match hash CSAM : time, user id, SHA-256, source ; jamais le fichier. PHAROS / NCMEC restent humains.

## Résultat
`buildCsamHashMatchEscalation` + escalade sur upload image/vidéo bloqué par PhotoDNA ou blocklist locale. Indisponibilité PhotoDNA (pas de clé) : refus sans alerte « match ».

## Tests faits
`contentModeration.test.ts` + `csamHashMatch.test.ts` → 20 tests OK.

## Tests non faits
Envoi Resend réel, Match Microsoft live (compte en review).

## Web / Tel
Backend partagé. Pas d’override apptel.

## CTO
Pas d’API NCMEC. Gel lives : toujours en attente de la clé / deploy.
