# Synthèse globale — Audit technique OnScen

**Date :** 2026-08-10  
**Auditeur :** revue senior (mode analyse — aucun correctif appliqué)  
**Méthode :** lecture code `commun/backend`, `web/app`, `ios/apptel`, `commun/deploy`, docs juridiques ; `npm audit` ; tests locaux backend (504/505) + web (576/576) ; comparaison avec audit du 2026-08-07 et correctifs livrés depuis (`modification.txt`, vague audit P1).

**Rapports détaillés :** [01-stack](./01-stack.md) … [12-divers](./12-divers.md)

---

## Vue d’ensemble

OnScen reste un **monolithe Node/React mature** pour son stade : CI GitHub Actions (build, lint, tests), séparation staging/prod au deploy, auth robuste (bcrypt, 2FA, WebAuthn, rate limits), PostGIS indexé, pas d’extraction YouTube, modération Sightengine étendue, **échantillonnage live Cloudflare** et **garde-fou Stripe `sk_live_` en prod** ajoutés depuis le 2026-08-07.

Les risques dominants pour une plateforme **live + UGC + geo + musique** restent : **(1) légal/contenu (CSAM hash-matching, licences musique, mineurs)**, **(2) scale & résilience (store RAM, WAF absent, SPOF)**, **(3) gouvernance ops (backups restore, secrets Git history, DPA)**.

---

## Critique — priorité absolue

| # | Constat | Domaine | Effort correction |
|---|---------|---------|-------------------|
| C1 | **Pas de hash-matching CSAM** (PhotoDNA / NCMEC ou équivalent) — heuristique Sightengine `face-age` insuffisante seule | Modération / Légal [07](./07-moderation.md) | **Élevé** (contrat fournisseur + intégration) |
| C2 | **Runbook CSAM / signalement PHAROS-NCMEC** — brouillon non validé avocat, jamais testé en exercice | Modération [07](./07-moderation.md) | **Moyen** (juridique + tabletop) |
| C3 | **Licences musique UGC / live** — pas de cadre SACEM/labels ; ACRCloud seul n’accorde pas de droits | Légal [10](./10-youtube.md) [11](./11-legalite-globale.md) | **Élevé** (business + juridique) |
| C4 | **Secrets dans historique Git** (commit ancien référencé audits antérieurs) — récupérables si accès repo | Sécurité [05](./05-securite.md) | **Moyen** (purge + rotation) |
| C5 | **Scaling API bloqué** — PM2 `instances: 1` + store applicatif RAM non partagé | DDoS / DB [06](./06-ddos.md) [02](./02-database.md) | **Élevé** (refonte architecture) |
| C6 | **Live WebRTC (LiveKit) sans modération vidéo** — seul Cloudflare Stream est échantillonné (~60 s) | Modération [07](./07-moderation.md) | **Élevé** (egress LiveKit ou restriction produit) |
| C7 | **WAF/CDN site non actif** — DNS direct OVH → VPS (`OPS-PRIORITIES` : bloqué) | DDoS [06](./06-ddos.md) | **Moyen** (accès DNS) |

---

## Élevé — traiter sous 2–8 semaines

| # | Constat | Domaine | Effort |
|---|---------|---------|--------|
| E1 | OAuth Google / YouTube app probablement en **mode Testing** — bloque usage réel (à confirmer console) | API [08](./08-api-externes.md) [10](./10-youtube.md) | **Élevé** (process Google) |
| E2 | **Mineurs** : vérif âge faible, geo fine non restreinte, live caméra non réservée majeurs | Légal [11](./11-legalite-globale.md) [03](./03-postgis.md) | **Moyen** |
| E3 | **Aucun captcha** (Turnstile/reCAPTCHA) inscription / reset password | DDoS [06](./06-ddos.md) | **Faible** (après Cloudflare) |
| E4 | **DPA RGPD art. 28** non signés (Scaleway, Cloudflare, Stripe, Resend…) | RGPD [09](./09-cgu-rgpd.md) | **Moyen** (contractuel) |
| E5 | **Rétention logs connexion** — écart privacy (12 mois) vs implémentation (~4–5 mois, audit antérieur) | RGPD [09](./09-cgu-rgpd.md) [12](./12-divers.md) | **Moyen** |
| E6 | **Test restauration backup** non prouvé récemment | DB [02](./02-database.md) | **Moyen** (ops) |
| E7 | **SPOF** : 1 VPS, 1 PostgreSQL (prod+staging même instance), Redis local | Infra [12](./12-divers.md) | **Élevé** |
| E8 | **Sentry absent sur mobile Capacitor** | Observabilité [04](./04-observabilite.md) | **Faible/Moyen** |
| E9 | **npm audit** : 5–6 vulnérabilités **high** (socket.io-parser, sharp, postcss…) | Stack [01](./01-stack.md) | **Faible/Moyen** |
| E10 | **Conformité stores IAP** — dons/abonnements via Stripe web dans app native | Légal [11](./11-legalite-globale.md) | **Moyen** (produit) |
| E11 | **Fail-open modération** si Sightengine indisponible — à confirmer config prod | Modération [08](./08-api-externes.md) | **Faible** |
| E12 | Rôle DB applicatif sur-privilégié (hérité audits) | DB [02](./02-database.md) | **Faible** |
| E13 | Processus **`soundy-auth`** non versionné en prod (hérité) | Divers [12](./12-divers.md) | **Moyen** (inventaire) |
| E14 | **1 test backend en échec** (`musicHome.test.ts`) sur 505 | Stack [01](./01-stack.md) | **Faible** |

---

## Améliorations depuis l’audit 2026-08-07 (ne pas régresser)

- Rate limits dédiés live / search / follow / like (`abuseRateLimits.ts`).
- Modèles Sightengine gore/weapon/face-age ; alertes `csam_risk_detected`.
- Échantillonnage frames live Cloudflare + coupure auto (`liveContentSampling.ts`).
- Runbook CSAM rédigé (à valider).
- Dons prod refusés sans `sk_live_` (`donations.ts`).

---

## Points positifs (à préserver)

- Requêtes SQL paramétrées ; sanitization HTML ; tests IDOR/auth nombreux.
- PostGIS GiST + flou coordonnées ~50 m.
- Pas de téléchargement YouTube serveur.
- CMP cookies avant Sentry web.
- CI : lint + tests + build prod sur chaque PR.

---

## Prochaines étapes recommandées (sans implémentation automatique)

1. **Valider avec vous** quelles corrections code/ops lancer en priorité (liste ci-dessus).  
2. Partager **C1–C3** avec l’avocat (`commun/docs/juridique/RENDEZ-VOUS-AVOCAT.md`).  
3. Ops : **Cloudflare WAF**, **restore backup**, **purge Git secrets**.  
4. Dev (sur demande explicite) : captcha, Sentry mobile, fix test `musicHome`, `npm audit fix`.

**Aucun fichier applicatif n’a été modifié dans le cadre de cet audit.**
