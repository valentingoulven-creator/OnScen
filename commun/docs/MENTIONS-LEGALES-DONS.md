# Mentions légales — pourboires live (Soundy)

Document de référence pour le flux **Pourboire / tip** pendant un live.  
Les **abonnements créateurs** et **Soundy+** restent régis par les mêmes CGU avec une commission distincte (non modifiée par ce document).

**Dernière mise à jour :** 13 juin 2026

---

## 1. Nature du paiement

Le paiement effectué via « Pourboire », « Don » ou « Tip » est un **soutien volontaire au créateur** (hôte du live).

- Il ne constitue **pas** un don à une association ou organisme à but non lucratif.
- Il **n’ouvre pas droit** à réduction ou crédit d’impôt (articles 200 et 238 bis du CGI).
- Soundy agit en qualité d’**intermédiaire technique** ; le bénéficiaire du pourboire est l’hôte du live.

## 2. Commission plateforme Soundy (30 %)

Sur chaque pourboire payant en production :

| Élément | Détail |
|--------|--------|
| Montant versé par le spectateur | Montant choisi (1–100 €, entier) |
| Commission Soundy | **30 %** du montant (`DONATION_PLATFORM_FEE_PERCENT`, défaut 30) |
| Part créateur estimée | **70 %** du montant, avant frais Stripe |
| Frais Stripe | Prélevés selon le modèle **Stripe Connect** (frais de traitement carte, hors commission Soundy) |

La répartition est **affichée avant validation** du paiement dans l’application.

Configuration technique : `backend/src/config/donationLegal.ts`, variable d’environnement `DONATION_PLATFORM_FEE_PERCENT`.

## 3. Conditions de paiement et CGU

Les pourboires sont soumis aux :

- **Conditions pourboires, abonnements et monétisation créateurs** (clé légale `creatorMonetization` / `donations` dans l’app)
- **Conditions générales d’utilisation (CGU)** de Soundy
- **Conditions Stripe** (consommateurs) : https://stripe.com/fr/legal/consumer

Accès dans l’app : **Paramètres → Légal → Pourboires, abonnements et monétisation**.

## 4. Obligations du créateur

Le créateur bénéficiaire est **responsable de la déclaration** de ses revenus auprès de l’administration fiscale et sociale compétente, conformément à sa situation (activité, statut, pays de résidence).

## 5. Remboursements

Les pourboires validés sont en principe **non remboursables**, sauf :

- erreur manifeste de montant ou de destinataire ;
- fraude avérée ;
- obligation légale ou décision Stripe / Soundy au cas par cas.

Contact : voir `LEGAL_CONTACT_EMAIL` dans les CGU (`contact@melosong.app`).

## 6. Données personnelles (RGPD)

Les données de paiement (carte, authentification forte) sont traitées par **Stripe** en tant que sous-traitant de paiement.

Soundy ne stocke **pas** le numéro de carte complet ni le CVV. Seuls des identifiants de transaction (PaymentIntent) et montants sont conservés pour crédit du soutien et traçabilité.

Voir aussi : Politique de confidentialité et Conformité RGPD dans l’app.

## 7. Mode démonstration (msdev)

En environnement msdev, les pourboires sont **simulés** : aucun paiement réel, aucune commission Stripe. La répartition 30 % / 70 % peut être affichée à titre indicatif.

---

## English summary

Tips are **voluntary creator support**, not tax-deductible charitable donations. Soundy retains a **30 % platform fee** on each live tip; the creator receives an estimated **70 %** before Stripe processing fees (Stripe Connect). Payment data is processed by Stripe (GDPR). Tips are generally non-refundable except error, fraud, or legal obligation. Full terms: in-app legal section « Creator monetization » and Terms of Use.
