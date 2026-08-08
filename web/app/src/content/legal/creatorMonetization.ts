import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL } from './types';

/** Conditions relatives aux pourboires live et abonnements créateurs / OnScen+ */
export const conditionsCreatorMonetization: LegalDocument = {
  title: 'Pourboires, abonnements et monétisation créateurs',
  updated: '7 juin 2026 (seuils d’âge)',
  sections: [
    {
      heading: '1. Nature des paiements',
      body: `Les montants versés via la fonction « Pourboire » ou « Don » pendant un live, ainsi que les abonnements mensuels à un créateur ou à OnScen+, sont des gratifications volontaires de soutien au créateur ou à la plateforme.\n\nIl ne s’agit pas de dons à une association ou à un organisme à but non lucratif ouvrant droit à réduction ou crédit d’impôt au sens des articles 200 et 238 bis du Code général des impôts.\n\nOnScen agit en qualité d’intermédiaire technique ; le bénéficiaire du pourboire est l’hôte du live concerné ; le bénéficiaire de l’abonnement créateur est le profil concerné.`,
    },
    {
      heading: '2. Environnement de test',
      body: `Les paiements sont traités via Stripe en mode production sécurisé. Aucun paiement réel n’est effectué lors de tests internes. Des plafonds journaliers peuvent s’appliquer selon la configuration de la plateforme.`,
    },
    {
      heading: '3. Paiements en production',
      body: `En production, les pourboires sont traités via Stripe Payment Intents ; les abonnements récurrents via Stripe Checkout (mode subscription) et Stripe Billing.\n\nLe numéro de carte, la date d’expiration et le cryptogramme (CVV) ne transitent jamais par les serveurs OnScen : la saisie s’effectue via Stripe.js, Stripe Checkout ou le portail client Stripe, avec authentification forte (DSP2 / SCA) lorsque requis.\n\nLes montants sont exprimés en euros (EUR). Des frais de traitement peuvent être appliqués par Stripe et, le cas échéant, par votre établissement bancaire.`,
    },
    {
      heading: '4. Âge minimum et consentement',
      body: `Compte OnScen : à partir de 13 ans (voir CGU).\n\nLancer un live (contenu artistique) : à partir de 16 ans.\n\nEffectuer un pourboire payant ou souscrire un abonnement : à partir de 18 ans.\n\nRecevoir des pourboires ou abonnements en tant que créateur : à partir de 18 ans.\n\nEn validant un paiement, vous confirmez remplir la condition d’âge ou disposer de l’autorisation légale requise pour utiliser un moyen de paiement.`,
    },
    {
      heading: '5. Abonnements récurrents',
      body: `Les abonnements sont facturés mensuellement jusqu’à résiliation. Vous pouvez gérer ou annuler votre abonnement via le portail client Stripe (production) ; l’accès aux avantages liés au statut supporter reste actif jusqu’à la fin de la période en cours.\n\nLes paliers et tarifs (ex. Supporter 4,99 €/mois, Super fan 9,99 €/mois, OnScen+) sont configurables par l’éditeur et affichés avant validation.\n\nUne commission plateforme distincte peut être prélevée sur les abonnements créateurs (pourcentage configurable via SUBSCRIPTION_PLATFORM_COMMISSION_PERCENT, documenté dans l’application).`,
    },
    {
      heading: '5 bis. Commission sur les pourboires live',
      body: `Sur chaque pourboire payant en production, OnScen prélève une commission plateforme de 50 % par défaut (variable DONATION_PLATFORM_FEE_PERCENT).\n\nExemple pour un pourboire de 10 € : commission OnScen 5 €, part créateur estimée 5 € avant frais de traitement Stripe (modèle Stripe Connect).\n\nLa répartition (montant, commission OnScen, net créateur estimé, mention des frais Stripe) est affichée avant validation du paiement.\n\nLes pourboires ne constituent pas des dons associatifs ouvrant droit à reçu fiscal.`,
    },
    {
      heading: '6. Montants, plafonds et remboursements',
      body: `Pourboires : montant libre entre 1 € et 100 € par opération (sauf modification par l’éditeur).\n\nAbonnements : paliers mensuels affichés dans l’interface.\n\nLes remboursements sont examinés au cas par cas conformément aux CGU, au droit de la consommation et à la politique Stripe. Les pourboires et abonnements validés ne sont en principe pas remboursables sauf erreur manifeste, fraude ou obligation légale.\n\nL’éditeur peut désactiver la fonctionnalité, plafonner les montants ou suspendre un compte en cas d’abus ou de fraude.`,
    },
    {
      heading: '7. Données et sécurité',
      body: `OnScen ne conserve pas les numéros de carte complets ni les CVV. Seuls des identifiants de transaction Stripe (PaymentIntent, Subscription, Customer) et les montants sont enregistrés pour assurer le crédit du soutien et la traçabilité comptable.\n\nLes logs techniques ne contiennent pas de PAN (numéro de carte).\n\nPour l’exercice de vos droits sur les données liées au paiement, contactez également Stripe conformément à sa politique de confidentialité.`,
    },
    {
      heading: '8. Réclamations et contact',
      body: `Pour toute question relative aux pourboires ou abonnements : ${LEGAL_CONTACT_EMAIL}.\n\nConditions Stripe (consommateurs) : https://stripe.com/fr/legal/consumer\n\nEn cas de litige de consommation, les règles des CGU (droit français, médiation) s’appliquent.`,
    },
  ],
};
