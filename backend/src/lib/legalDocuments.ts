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
      body: `L’hébergement est assuré par :\n{{hostName}}\n{{hostAddress}}\n{{hostPhone}}\nPays : {{hostCountry}}\n\nLes données techniques (logs, adresses IP) peuvent transiter par cet hébergeur.`,
    },
    {
      heading: 'Activité du service',
      body: `Soundy est une application sociale autour de la musique : salons d’écoute géolocalisés, lives, messagerie, carte des utilisateurs et contenus musicaux via YouTube. Soundy n’est pas un service de rencontre sentimental.\n\nDomaine de production : {{productionDomain}}`,
    },
    {
      heading: 'Propriété intellectuelle',
      body: `L’ensemble des éléments composant Soundy (textes, interface, logo, charte, code source, sauf composants open source) est protégé par le droit d’auteur.\n\nLes marques YouTube, Google, Instagram appartiennent à leurs propriétaires. Soundy n’est pas affilié, sponsorisé ou approuvé par ces sociétés, sauf accord écrit contraire.`,
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

const politiqueConfidentialite: LegalDocument = {
  title: 'Politique de confidentialité',
  updated: '10 juin 2026',
  sections: [
    {
      heading: '1. Responsable du traitement',
      body: `Le responsable du traitement des données personnelles est l’éditeur de Soundy, identifié dans les Mentions légales.\n\nContact données personnelles : {{privacyEmail}}\nContact général : {{contactEmail}}\n\nDélégué à la protection des données (DPO) : {{dpoEmail}}`,
    },
    {
      heading: '2. Données traitées',
      body: `Selon votre utilisation, nous pouvons traiter :\n\n• Données de compte : pseudo, e-mail, mot de passe (stocké de manière hachée), photo(s) de profil, bio, centres d’intérêt, genres et artistes favoris, rôle (auditeur/host).\n• Données de localisation : coordonnées GPS fournies par votre appareil, position floutée affichée sur la carte, préférences de précision (ville / ~50 m), mode fantôme.\n• Données d’usage : salons créés ou rejoints, lives, file d’attente musicale, état de lecture synchronisé.\n• Communications : messages de chat (salon, live), messages privés, commentaires sur reels.\n• Données sociales : abonnements, cœurs/matchs, notifications, blocages, notes aux hosts.\n• Données techniques : jeton de session, identifiants socket, logs techniques, adresse IP lors des connexions au serveur.\n• Connexions plateformes : indicateur de liaison YouTube / Instagram (jetons OAuth le cas échéant).`,
    },
    {
      heading: '3. Finalités et bases légales',
      body: `Nous traitons vos données pour :\n\n• Fournir le Service (exécution du contrat / CGU) : compte, carte, salons, chat, synchronisation.\n• Assurer la sécurité et la modération (intérêt légitime) : prévention des abus, bannissements live, signalements.\n• Respecter nos obligations légales : conservation des logs si requis, réponse aux autorités.\n• Améliorer le Service (intérêt légitime, dans la mesure du nécessaire) : statistiques agrégées, correction de bugs.\n\nLe géolocalisation repose sur votre action positive (activation de la géolocalisation du navigateur) et les paramètres de confidentialité que vous choisissez.\n\nNous ne vendons pas vos données personnelles à des tiers à des fins publicitaires.`,
    },
    {
      heading: '4. Destinataires et sous-traitants',
      body: `Les données peuvent être accessibles :\n• aux autres utilisateurs, selon vos paramètres (profil public, carte, messages) ;\n• à l’éditeur et aux personnes habilitées pour l’exploitation et la maintenance ;\n• à des prestataires techniques (hébergement) ;\n• aux plateformes YouTube et Instagram lorsque vous connectez votre compte ou ouvrez un lien de lecture (politiques propres à ces services).\n\nCartographie : tuiles CARTO / OpenStreetMap. Avatars : service DiceBear (URLs d’images).`,
    },
    {
      heading: '5. Durées de conservation',
      body: `• Compte et profil : pendant la durée du compte, puis suppression ou anonymisation dans un délai raisonnable après clôture.\n• Messages : conservés tant que nécessaire au fonctionnement de l’historique des conversations.\n• Données de localisation : dernière position connue mise à jour à chaque session.\n• Logs techniques : durée limitée (ex. 12 mois en production, sauf obligation légale contraire).`,
    },
    {
      heading: '6. Sécurité',
      body: `Nous mettons en œuvre des mesures appropriées : authentification par jeton (JWT), mots de passe hachés (bcrypt), floutage des coordonnées, contrôles d’accès aux salons sur invitation, chiffrement HTTPS en production.\n\nSignalez toute compromission à {{privacyEmail}}.`,
    },
    {
      heading: '7. Vos droits (RGPD)',
      body: `Vous disposez des droits d’accès, rectification, effacement, limitation, opposition et portabilité, conformément au RGPD.\n\nPour exercer vos droits : {{privacyEmail}}.\n\nRéclamation auprès de la CNIL : www.cnil.fr`,
    },
    {
      heading: '8. Transferts hors UE',
      body: `Certains prestataires (ex. Google/YouTube) peuvent traiter des données hors UE. Des garanties appropriées (clauses contractuelles types, décision d’adéquation) seront mises en place conformément au RGPD.`,
    },
    {
      heading: '9. Mineurs',
      body: `Le Service s’adresse aux personnes de 13 ans et plus. Contactez-nous pour demander la suppression de données concernant un mineur de moins de 13 ans.`,
    },
    {
      heading: '10. Cookies et stockage local',
      body: `L’Application utilise le localStorage du navigateur pour le jeton de connexion, les préférences et certains réglages d’interface. Vous pouvez effacer ces données via les paramètres de votre navigateur.`,
    },
    {
      heading: '11. Autorisations OAuth YouTube et Instagram',
      body: `Lorsque vous connectez YouTube ou Instagram, Soundy demande uniquement les autorisations nécessaires aux fonctionnalités visibles (lecture de playlists YouTube, profil Instagram). Vous pouvez révoquer ces autorisations à tout moment dans Soundy ou depuis votre compte Google/Meta.`,
    },
    {
      heading: '12. Modifications',
      body: `Cette politique peut être mise à jour. La date de dernière mise à jour figure en tête du document.`,
    },
  ],
};

const cgu: LegalDocument = {
  title: "Conditions générales d'utilisation",
  updated: '10 juin 2026',
  sections: [
    {
      heading: '1. Objet et acceptation',
      body: `Les présentes Conditions générales d’utilisation (« CGU ») régissent l’accès et l’utilisation de l’application Soundy (« l’Application », « le Service »), accessible via navigateur web ou PWA.\n\nEn créant un compte ou en utilisant le Service, vous acceptez sans réserve les CGU, la Politique de confidentialité, les Mentions légales et, le cas échéant, les Conditions relatives aux API YouTube.`,
    },
    {
      heading: '2. Description du Service',
      body: `Soundy permet notamment de visualiser sur une carte des salons d’écoute musicale et des lives, de créer ou rejoindre des salons YouTube, d’échanger via chat et messages privés, et de publier ou consulter des contenus sociaux autour de la musique.\n\nLe Service est une plateforme sociale musicale. Il ne constitue pas un service de rencontre.`,
    },
    {
      heading: '3. Éligibilité et compte',
      body: `Vous devez avoir au moins 13 ans pour créer un compte. Lancer un live est réservé aux 16 ans et plus. Les paiements sont réservés aux 18 ans et plus.\n\nL’éditeur peut suspendre ou supprimer un compte en cas de violation des CGU.`,
    },
    {
      heading: '4. Comportement des utilisateurs',
      body: `Vous vous engagez à respecter les lois applicables, à ne pas harceler ou publier de contenus illicites, et à ne pas perturber le Service.`,
    },
    {
      heading: '5. Contenus et musique',
      body: `La lecture musicale s’effectue via YouTube : vous devez respecter les conditions d’utilisation de YouTube et de Google. Soundy ne fournit pas de licence musicale propre.\n\nLes salons YouTube utilisent le lecteur intégré IFrame API ; le consentement cookies tiers peut être requis.`,
    },
    {
      heading: '6. Géolocalisation et visibilité',
      body: `Le Service utilise votre position pour afficher des contenus à proximité. Par défaut, la position affichée est floutée. Vous pouvez masquer votre position ou limiter la précision.`,
    },
    {
      heading: '7. Messages privés et modération',
      body: `Les messages peuvent être stockés pour assurer l’historique des conversations. L’éditeur peut intervenir en cas de signalement d’abus manifeste.`,
    },
    {
      heading: '8. Propriété intellectuelle de Soundy',
      body: `Soundy, son interface et sa marque restent la propriété de l’éditeur. Aucune cession de droits de propriété intellectuelle n’est consentie au-delà d’une licence d’utilisation personnelle.`,
    },
    {
      heading: '9. Disponibilité et évolutions',
      body: `Le Service est fourni « en l’état ». L’éditeur peut faire évoluer les fonctionnalités et les CGU.`,
    },
    {
      heading: '10. Limitation de responsabilité',
      body: `Dans les limites autorisées par la loi, l’éditeur n’est pas responsable des dommages indirects ou des contenus publiés par les utilisateurs.`,
    },
    {
      heading: '11. Résiliation',
      body: `Vous pouvez cesser d’utiliser le Service et supprimer votre compte depuis les paramètres ou en contactant {{contactEmail}}.`,
    },
    {
      heading: '12. Droit applicable et contact',
      body: `Les CGU sont régies par le droit français. Contact : {{contactEmail}}`,
    },
  ],
};

const LEGAL_DOCS: Record<string, LegalDocument> = {
  mentions: mentionsLegales,
  privacy: politiqueConfidentialite,
  terms: cgu,
};

export function getLegalDocument(key: string): LegalDocument | null {
  const doc = LEGAL_DOCS[key];
  if (!doc) return null;
  return mergeDoc(doc);
}

export function listLegalDocumentKeys(): string[] {
  return Object.keys(LEGAL_DOCS);
}
