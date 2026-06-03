import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL } from './types';

/** Mentions légales (LCEN / France) — complétez les champs entre crochets avant mise en production. */
export const mentionsLegales: LegalDocument = {
  title: 'Mentions légales',
  updated: '3 juin 2026',
  sections: [
    {
      heading: 'Éditeur du site et de l’application',
      body: `L’application MeloSong et le site associé sont édités par :\n\n[Nom ou raison sociale de l’éditeur]\n[Forme juridique — ex. entrepreneur individuel, SAS, association]\n[Adresse postale complète]\n[Numéro SIREN / SIRET]\n[Numéro RCS et ville du greffe, le cas échéant]\n[Capital social, le cas échéant]\n\nContact : ${LEGAL_CONTACT_EMAIL}\n\nDirecteur de la publication : [Nom du directeur de publication]`,
    },
    {
      heading: 'Hébergement',
      body: `En environnement de démonstration (msdev), l’application peut être exécutée localement sur l’ordinateur de l’utilisateur ou sur un serveur privé ; l’hébergeur est alors l’utilisateur ou son fournisseur d’accès.\n\nEn production, l’hébergement sera assuré par :\n[Nom de l’hébergeur]\n[Adresse de l’hébergeur]\n[Téléphone de l’hébergeur]\n\nLes données techniques (logs, adresses IP de connexion) peuvent transiter par cet hébergeur conformément à sa politique de confidentialité.`,
    },
    {
      heading: 'Activité du service',
      body: `MeloSong est une application sociale autour de la musique : salons d’écoute géolocalisés, lives, messagerie, carte des utilisateurs et contenus musicaux via des liens vers Spotify et YouTube. MeloSong n’est pas un service de rencontre sentimental.\n\nVersion actuelle : environnement msdev (démonstration / développement local). Les fonctionnalités et la disponibilité peuvent évoluer sans préavis.`,
    },
    {
      heading: 'Propriété intellectuelle',
      body: `L’ensemble des éléments composant MeloSong (textes, interface, logo, charte, code source, sauf composants open source et contenus tiers) est protégé par le droit d’auteur. Toute reproduction ou représentation non autorisée est interdite.\n\nLes marques Spotify, YouTube, Google et autres mentionnées appartiennent à leurs propriétaires respectifs. MeloSong n’est pas affilié, sponsorisé ou approuvé par ces sociétés, sauf accord écrit contraire.`,
    },
    {
      heading: 'Données personnelles et cookies',
      body: `Le traitement des données personnelles est décrit dans la Politique de confidentialité et le document Conformité RGPD accessibles depuis les paramètres de l’application.\n\nL’application utilise le stockage local du navigateur (localStorage) pour conserver le jeton de session, certaines préférences (rayon de recherche, langue, confidentialité) et des réglages d’affichage.`,
    },
    {
      heading: 'Signalement de contenu illicite',
      body: `Conformément à la réglementation applicable, vous pouvez signaler tout contenu illicite ou tout comportement contraire aux Conditions d’utilisation à : ${LEGAL_CONTACT_EMAIL}, en précisant l’URL ou le contexte (salon, live, message), la nature du contenu et vos coordonnées.`,
    },
    {
      heading: 'Médiation et litiges',
      body: `En cas de litige de consommation, vous pouvez recourir gratuitement à un médiateur de la consommation conformément aux articles L.612-1 et suivants du Code de la consommation, ou à la plateforme européenne de règlement en ligne des litiges : https://ec.europa.eu/consumers/odr/\n\nDroit applicable : droit français. Tribunaux compétents : selon les règles de droit commun, sous réserve des dispositions impératives protectrices du consommateur.`,
    },
  ],
};
