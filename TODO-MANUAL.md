# TODO-MANUAL.md — Tâches non automatisables (post-audit Soundy)

Ces éléments nécessitent une décision produit, une configuration externe, ou une refactorisation majeure planifiée en sprint dédié.

---

## Critique — Sécurité

### CRIT-01 — JWT → cookies httpOnly (ELEV-01 partiel)
**Statut :** Commentaire MIGRATION TODO ajouté dans `app/src/lib/authStorage.ts`
**Risque :** Les tokens JWT stockés en localStorage/sessionStorage sont vulnérables aux attaques XSS.
**Ce qui reste à faire :**
- Backend : endpoint `POST /api/auth/cookie-login` qui pose un cookie `httpOnly; Secure; SameSite=Strict`
- Backend : middleware qui lit le cookie au lieu du header `Authorization` / `X-Auth-Token`
- Frontend : supprimer `authStorage.ts` + adapter tous les appels `api.*` (retirer le passage de `token`)
- Backend : endpoint `POST /api/auth/logout` qui efface le cookie côté serveur
- Durée token rememberMe déjà réduite à 7j (palliatif en attendant)
- **Effort estimé :** 2–3 jours de dev (backend + frontend coordonnés) + tests

### ELEV-01 — Révocation JWT (blacklist)
**Risque :** Un token compromis reste valide jusqu'à expiration.
**Ce qui reste à faire :**
- Implémenter une table PostgreSQL `jti_blacklist` (ou Redis SET)
- Modifier `signToken()` pour inclure un `jti` unique
- Modifier `authenticateJWT` pour vérifier le `jti` en base
- Ajouter `POST /api/auth/logout` qui inscrit le `jti` en blacklist
- **Effort estimé :** 1 jour + migration DB

### ELEV-07 — Stores OAuth en mémoire (vs Redis)
**Risque :** En cas de redémarrage serveur, tous les états OAuth CSRF en cours sont perdus (connexions en cours échouent).
**Ce qui reste à faire :**
- Provisionner Redis (ou utiliser PostgreSQL avec TTL)
- Migrer `oauthStates` (oauth.ts), `oauthExchangeCodes` (oauthExchange.ts) vers Redis
- **Effort estimé :** 0.5 jour si Redis déjà disponible

---

## Critique — Business / Légal

### C1 — IAP Apple/Google (remplacer Stripe)
**Exigence Apple/Google :** Les achats in-app (dons, abonnements créateurs) sur iOS/Android **doivent** utiliser StoreKit 2 (iOS) et Play Billing (Android). L'utilisation de Stripe pour des achats in-app entraîne le rejet de l'app des stores.
**Ce qui reste à faire :**
- Décision produit : modèle économique web vs mobile natif
- Implémenter StoreKit 2 (Capacitor plugin `@capacitor/purchases` ou RevenueCat)
- Implémenter Play Billing côté Android
- Synchroniser les achats stores avec le backend Soundy
- **Effort estimé :** 4–8 semaines (selon complexité abonnements)

### C3 — Sign in with Apple
**Exigence Apple :** Si l'app propose "Sign in with Google" ou "Sign in with Facebook", elle **doit** aussi proposer "Sign in with Apple".
**Prérequis :** Apple Developer Program ($99/an)
**Ce qui reste à faire :**
- S'inscrire à Apple Developer Program
- Configurer Sign in with Apple dans App Store Connect
- Implémenter le flow backend (JWT Apple → user lookup/creation)
- Ajouter le bouton dans le frontend
- **Effort estimé :** 2–3 jours

### C6 — Mentions légales incomplètes
**Exigence LCEN (France) :** Le fichier `legal-publisher.json` doit contenir :
- Numéro SIREN / SIRET de l'éditeur
- Adresse siège social
- Coordonnées du DPO (Délégué à la Protection des Données)
- Nom et coordonnées de l'hébergeur
**Action :** Compléter `backend/src/content/legal-publisher.json` avec les vraies données légales.

### C7 — URL privacy publique
**Exigence GDPR :** `https://getsoundy.com/privacy` doit être accessible publiquement (sans authentification).
**Action :** Vérifier que la route `/privacy` répond sans token et que le contenu est à jour.

---

## Architecture — Capacitor Mobile

### C5 — Projet Android manquant
**Ce qui reste à faire :**
```bash
cd apptel
npx cap add android
# Puis configurer android/app/build.gradle (applicationId, etc.)
# Puis versionner le dossier android/
```
**Effort estimé :** 0.5 jour + configuration Gradle

---

## UX — Sprints futurs

### C10 — Onboarding 9 étapes → 3 étapes maximum
**Problème :** L'onboarding actuel comporte 9 étapes, ce qui crée un taux d'abandon élevé.
**Recommandation :** Réduire à 3 étapes essentielles (email vérifié, pseudo, photo de profil optionnelle). Les autres informations (genres, rôle, etc.) peuvent être collectées progressivement après l'inscription.
**Effort estimé :** 1 sprint (design + dev)

### F1 — Remplacer les alert() / window.confirm() restants
**Déjà corrigés :** OAuth errors (App.tsx), start live error (LivesTabPage.tsx)
**Restant à corriger :**
- `ChatPanel.tsx` : erreurs de pièce jointe, ban, suppression de message
- `DmPage.tsx` : nombreux alert/confirm dans les flows DM et groupes
- `SalonPage.tsx L339` : confirm avant action critique
- `AdminAccountsTab.tsx`, `AdminSponsorsTab.tsx` : confirms admin
- `UserReelsSection.tsx` : confirm suppression/publication reel
- `SalonParticipantsPopover.tsx` : confirm retrait VIP
**Approche recommandée :** Créer un composant `ConfirmModal` réutilisable + un hook `useToast`.

---

## Résumé priorisation

| Priorité | Item | Effort | Risque si non fait |
|----------|------|--------|-------------------|
| 🔴 URGENT | CRIT-01 JWT → httpOnly cookies | 3j | XSS vole les sessions |
| 🔴 URGENT | C1 IAP Apple/Google | 6-8 sem | Rejet App Store |
| 🔴 URGENT | C3 Sign in with Apple | 3j | Rejet App Store |
| 🟠 HAUTE | ELEV-01 Révocation JWT | 1j | Token volé reste valide |
| 🟠 HAUTE | C6 Mentions légales | 0.5j | Risque LCEN |
| 🟡 MOYENNE | ELEV-07 Redis OAuth stores | 1j | Perte sessions OAuth restart |
| 🟡 MOYENNE | C5 Android project | 0.5j | Pas de déploiement Android |
| 🟢 BASSE | C10 Onboarding simplifié | 1 sprint | Taux d'abandon élevé |
| 🟢 BASSE | F1 alert() restants | 2j | UX dégradée |
