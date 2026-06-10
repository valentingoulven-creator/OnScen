import { applyPublisherTemplate } from './legalPublisher';

/** Mirrors app/src/content/legal — kept in sync for API-served merged documents. */

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDocument {
  title: string;
  updated: string;
  sections: LegalSection[];
}

function mergeDoc(doc: LegalDocument): LegalDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      body: applyPublisherTemplate(s.body),
    })),
  };
}

const mentionsLegales: LegalDocument = {
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
      body: `Soundy est une application sociale autour de la musique : salons d’écoute géolocalisés, lives, messagerie, carte des utilisateurs et contenus musicaux via des liens vers Spotify et YouTube. Soundy n’est pas un service de rencontre sentimental.\n\nDomaine de production : {{productionDomain}}`,
    },
    {
      heading: 'Propriété intellectuelle',
      body: `L’ensemble des éléments composant Soundy (textes, interface, logo, charte, code source, sauf composants open source) est protégé par le droit d’auteur.\n\nLes marques Spotify, YouTube, Google appartiennent à leurs propriétaires. Soundy n’est pas affilié, sponsorisé ou approuvé par ces sociétés, sauf accord écrit contraire.`,
    },
    {
      heading: 'Données personnelles et cookies',
      body: `Le traitement des données personnelles est décrit dans la Politique de confidentialité accessible depuis les paramètres.\n\nL’application utilise le stockage local du navigateur (localStorage) pour le jeton de session et les préférences.`,
    },
    {
      heading: 'Signalement de contenu illicite',
      body: `Vous pouvez signaler tout contenu illicite via le bouton « Signaler » dans l’application ou par e-mail : {{contactEmail}}, en précisant le contexte (salon, live, message, profil), la nature du contenu et vos coordonnées.\n\nLes signalements sont enregistrés et traités dans un délai raisonnable.`,
    },
    {
      heading: 'Médiation et litiges',
      body: `Médiateur de la consommation : {{mediatorName}}\n{{mediatorUrl}}\n\nPlateforme européenne ODR : https://ec.europa.eu/consumers/odr/\n\nDroit applicable : droit français.`,
    },
  ],
};

const LEGAL_DOCS: Record<string, LegalDocument> = {
  mentions: mentionsLegales,
};

export function getLegalDocument(key: string): LegalDocument | null {
  const doc = LEGAL_DOCS[key];
  if (!doc) return null;
  return mergeDoc(doc);
}

export function listLegalDocumentKeys(): string[] {
  return Object.keys(LEGAL_DOCS);
}
