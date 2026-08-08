# Runbook opérationnel — Contenu suspecté CSAM / mineur en danger

**Statut : ⚠️ Brouillon opérationnel — à faire valider par l'avocat lors du rendez-vous déjà planifié (`RENDEZ-VOUS-AVOCAT.md`).**
Ce document n'est **pas** un texte destiné aux utilisateurs (voir CGU/politique mineurs pour cela) — c'est une procédure interne pour l'équipe OnScen (admin/modération/support/fondateur), rédigée suite à l'audit technique du 2026-08-07 (`commun/docs/audit/2026-08-audit-technique-complet/07-moderation.md`, §7.6 — MOD-8, risque critique).

**Complément opérationnel (alertes, staging, coûts Sightengine) :** [`MODERATION-OPS.md`](./MODERATION-OPS.md).

---

## 0. Contacts alertes et SLA interne

- **Destinataires email** : `SMTP_ADMIN_EMAIL` (défaut admin@getsoundy.com) + **`ALERT_EXTRA_EMAILS`** (liste séparée par des virgules dans `.env` VPS — ex. modérateur, fondateur). Configurer au minimum une adresse surveillée **7j/7** pour `csam_risk_detected` et `urgent_content_report`.
- **SLA interne** (aligné CGU, en attente validation avocat) : qualification d'un signalement **urgent** (`illegal`, `csam_risk`) **< 24 h ouvrées** ; action conservatoire (suspension compte) **< 1 h ouvrée** si alerte automatique `minor_risk` ou signalement `csam_risk` crédible.
- **Signalement utilisateur vs détection auto** :
  - **Détection Sightengine** (`minor_risk`, frame live) → contenu **non publié** ou live **coupé automatiquement** + alerte `csam_risk_detected`.
  - **Signalement utilisateur** (`csam_risk`) → **alerte immédiate** + priorité admin, **sans** coupure automatique du live (éviter abus) ; enquête manuelle puis suspension / blocage admin si nécessaire.

---

## 1. Ce qui déclenche ce runbook

- Une alerte email automatique **`csam_risk_detected`** (voir `lib/alertNotifier.ts`) reçue par l'équipe admin, déclenchée par :
  - Un upload bloqué automatiquement (Sightengine `face-age` + signal de nudité/suggestif combinés — voir `lib/sightengineModeration.ts`, raison `minor_risk`).
  - Une frame de live échantillonnée détectée à risque (`lib/liveContentSampling.ts`).
  - Un signalement utilisateur avec la catégorie **« ⚠️ Contenu impliquant potentiellement un mineur »** (`csam_risk` dans `AdminReportsTab`).
- Tout signalement manuel (support, modérateur, utilisateur) mentionnant explicitement un soupçon d'exploitation d'un mineur, même hors des catégories ci-dessus.

## 2. Ce qui a déjà été fait automatiquement (ne pas refaire, ne pas défaire)

- Le contenu détecté par Sightengine (upload ou frame live) est **automatiquement bloqué / la diffusion est coupée** — il n'est jamais publié ni visible publiquement.
- Un enregistrement système est déjà créé (`content-reports.jsonl`, catégorie `csam_risk`, `reporterId: system:sightengine` ou `system:sightengine-live`) avec l'identifiant de l'utilisateur concerné et les scores de détection.
- **Ne pas supprimer cette entrée avant la fin de la procédure ci-dessous** — c'est la trace de preuve minimale actuellement disponible.

## 3. Actions immédiates (à faire dès réception de l'alerte, idéalement < 1h ouvrée)

1. **Ne pas re-télécharger, ne pas partager, ne pas transférer** le contenu suspect en dehors des canaux strictement nécessaires (panneau admin interne). La détention/diffusion de CSAM est un délit pénal même à des fins de vérification non encadrée.
2. Un seul référent désigné (fondateur ou modérateur senior habilité) consulte le signalement dans `AdminReportsTab` (badge 🚩 Urgent) pour qualifier la situation :
   - **Faux positif manifeste** (ex. photo d'un adulte à l'air jeune, erreur de détection) → passer en `dismissed` avec commentaire, pas d'escalade légale nécessaire, envisager d'ajuster `SIGHTENGINE_MINOR_THRESHOLD` si les faux positifs sont fréquents.
   - **Doute raisonnable ou confirmation** → poursuivre à l'étape 4.
3. **Suspendre immédiatement le compte** de l'utilisateur concerné (uploader ou hôte du live) le temps de l'investigation — ne pas attendre la confirmation légale pour cette mesure conservatoire.
4. **Ne pas notifier l'utilisateur** du motif exact de la suspension à ce stade (risque de destruction de preuves côté utilisateur si informé).

## 4. Signalement aux autorités (cas confirmé ou doute raisonnable non levé)

### France — PHAROS (priorité, hébergement et opération en France)

- Plateforme : **https://www.internet-signalement.gouv.fr/**
- Signalement à faire par le référent désigné, avec :
  - Capture d'écran / export du contenu concerné (métadonnées : date, heure, URL interne, ID utilisateur).
  - Coordonnées OnScen (raison sociale, contact DPO/légal — voir `legalPublisher.ts`/mentions légales).
- **Délai visé : sous 24h ouvrées** à compter de la qualification à l'étape 3 (cohérent avec le délai déjà annoncé dans les CGU — voir `legalDocumentsApp.json`).

### États-Unis — NCMEC CyberTipline (si utilisateurs/hébergement US concernés)

- Plateforme : **https://report.cybertip.org/**
- À évaluer avec l'avocat si OnScen est un « electronic service provider » soumis à l'obligation fédérale US de signalement (18 U.S.C. § 2258A) — pertinent dès lors que l'app est accessible à des utilisateurs américains, même sans hébergement US.

### Conservation de la preuve

- Conserver l'entrée `content-reports.jsonl` et les métadonnées associées (ne pas purger avant confirmation de clôture par les autorités).
- Ne pas conserver le contenu lui-même au-delà de ce qui est strictement nécessaire à l'enquête — se référer aux instructions PHAROS/NCMEC sur la conservation (elles peuvent explicitement demander de conserver ou de transmettre le fichier via un canal sécurisé dédié, ne pas l'envoyer par email standard).

## 5. Après signalement

- Bannissement définitif du compte (pas de réactivation, indépendamment de la suite judiciaire).
- Documenter la clôture du dossier (date de signalement, référence PHAROS/NCMEC si fournie) dans un registre interne dédié (à créer — hors du panneau admin public, accès restreint fondateur/DPO).
- Revue mensuelle (tant que le volume le justifie) du taux de faux positifs `minor_risk` pour ajuster les seuils sans jamais désactiver la détection.

## 6. Limites connues de la détection technique actuelle (transparence interne)

- Détection basée sur **Sightengine `face-age`** (probabilité qu'un visage détecté appartienne à un mineur) combinée à un signal de nudité/suggestif — **pas** un hash-matching contre une base de contenus CSAM connus (type PhotoDNA/NCMEC hash list). Un contenu CSAM sans visage détectable, ou avec un visage non exposé, peut ne pas être détecté automatiquement.
- L'échantillonnage vidéo live (`liveContentSampling.ts`) capture une frame toutes les **~60 secondes** par défaut (`LIVE_MODERATION_SAMPLE_INTERVAL_MS`, défaut 60 000 ms) — un contenu bref entre deux échantillons peut ne pas être capté. Ce n'est pas un scan continu.
- **Périmètre live** : échantillonnage actif uniquement pour les lives **`streamMode === 'cloudflare'`** (ingest RTMP/OBS → Cloudflare Stream). Les lives **WebRTC / LiveKit** sans Cloudflare **ne sont pas** couverts par ce mécanisme — traiter comme lacune connue ; orienter les lives publics UGC vers Cloudflare ou prévoir egress LiveKit (hors scope MVP).
- **Action de suivi recommandée** (non implémentée dans cette itération, nécessite budget + décision) : étudier l'intégration d'un service de hash-matching reconnu (Thorn Safer, PhotoDNA Cloud Service, ou l'API de hash-matching NCMEC) pour compléter cette détection heuristique par une détection déterministe sur les contenus déjà répertoriés.
