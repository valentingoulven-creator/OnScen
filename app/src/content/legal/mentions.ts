import type { LegalDocument } from './types';

/** Mentions légales (LCEN / France) — complétez les champs entre crochets avant mise en production. */
export const mentionsLegales: LegalDocument = {
  title: 'Mentions légales',
  updated: '3 juin 2026',
  sections: [
    {
      heading: 'Éditeur du site et de l’application',
      body: `L’application Soundy et le site associé sont édités par :\n\n{{publisherName}}\n{{legalForm}}\n{{address}}\nSIREN / SIRET : {{siren}}\n{{rcs}}\n{{capital}}\n\nContact : {{contactEmail}}\n\nDirecteur de la publication : {{publicationDirector}}`,
    },
    {
      heading: 'Hébergement',
      body: `En environnement de démonstration (msdev), l’application peut être exécutée localement ; l’hébergeur est alors l’utilisateur ou son fournisseur d’accès.\n\nEn production, l’hébergement est assuré par :\n{{hostName}}\n{{hostAddress}}\n{{hostPhone}}\nPays : {{hostCountry}}\n\nLes données techniques (logs, adresses IP) peuvent transiter par cet hébergeur.`,
    },
    {
      heading: 'Activité du service',
      body: `Soundy est une application sociale autour de la musique : salons d’écoute géolocalisés, lives, messagerie, carte des utilisateurs et contenus musicaux via des liens vers Spotify et YouTube. Soundy n’est pas un service de rencontre sentimental.\n\nVersion actuelle : environnement msdev (démonstration / développement local). Les fonctionnalités et la disponibilité peuvent évoluer sans préavis.`,
    },
    {
      heading: 'Propriété intellectuelle',
      body: `L’ensemble des éléments composant Soundy (textes, interface, logo, charte, code source, sauf composants open source et contenus tiers) est protégé par le droit d’auteur. Toute reproduction ou représentation non autorisée est interdite.\n\nLes marques Spotify, YouTube, Google et autres mentionnées appartiennent à leurs propriétaires respectifs. Soundy n’est pas affilié, sponsorisé ou approuvé par ces sociétés, sauf accord écrit contraire.`,
    },
    {
      heading: 'Données personnelles et cookies',
      body: `Le traitement des données personnelles est décrit dans la Politique de confidentialité et le document Conformité RGPD accessibles depuis les paramètres de l’application.\n\nL’application utilise le stockage local du navigateur (localStorage) pour conserver le jeton de session, certaines préférences (rayon de recherche, langue, confidentialité) et des réglages d’affichage.`,
    },
    {
      heading: 'Signalement de contenu illicite',
      body: `Conformément à la réglementation applicable, vous pouvez signaler tout contenu illicite via le bouton « Signaler » dans l’application ou par e-mail : {{contactEmail}}, en précisant le contexte (salon, live, message, profil), la nature du contenu et vos coordonnées.`,
    },
    {
      heading: 'Médiation et litiges',
      body: `En cas de litige de consommation, vous pouvez recourir gratuitement à un médiateur de la consommation conformément aux articles L.612-1 et suivants du Code de la consommation, ou à la plateforme européenne de règlement en ligne des litiges : https://ec.europa.eu/consumers/odr/\n\nDroit applicable : droit français. Tribunaux compétents : selon les règles de droit commun, sous réserve des dispositions impératives protectrices du consommateur.`,
    },
  ],
};
