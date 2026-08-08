import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL, LEGAL_COPYRIGHT_EMAIL } from './types';

/** Politique droits d'auteur — notification et retrait */
export const politiqueDroitsAuteur: LegalDocument = {
  title: "Politique droits d'auteur",
  updated: '3 août 2026',
  sections: [
    {
      heading: '1. Respect des droits',
      body: `OnScen respecte les droits de propriété intellectuelle. Les utilisateurs ne doivent publier que des contenus dont ils détiennent les droits ou une autorisation.\n\nLa plateforme peut analyser automatiquement certains uploads audio (empreinte) pour détecter des correspondances avec des enregistrements commerciaux et refuser ou retirer un contenu.`,
    },
    {
      heading: '2. Signalement par le titulaire de droits',
      body: `Si vous estimez qu'un contenu sur OnScen porte atteinte à vos droits (musique, vidéo, image, texte, marque), envoyez une **notification** à :\n\n**${LEGAL_COPYRIGHT_EMAIL}**\n\nIndiquez :\n• vos coordonnées et, le cas échéant, qualité de mandataire ;\n• identification de l'œuvre protégée ;\n• URL ou description précise du contenu sur OnScen (profil, reel, live, etc.) ;\n• déclaration de bonne foi ;\n• signature électronique ou manuscrite du titulaire ou représentant.\n\nVous pouvez aussi utiliser le signalement **« Droits d'auteur »** dans l'application lorsque disponible.`,
    },
    {
      heading: '3. Retrait et information',
      body: `Après réception d'une notification **suffisamment précise et fondée**, OnScen peut retirer ou désactiver l'accès au contenu et informer l'utilisateur concerné.\n\nLes notifications manifestement abusives peuvent être rejetées ; des sanctions peuvent s'appliquer en cas de fausses déclarations répétées.`,
    },
    {
      heading: '4. Contre-notification (utilisateur)',
      body: `Si votre contenu a été retiré et que vous estimez qu'il s'agit d'une erreur ou que vous disposez d'une autorisation, vous pouvez envoyer une **contre-notification** à **${LEGAL_COPYRIGHT_EMAIL}** en précisant :\n• identification du contenu retiré ;\n• motifs pour lesquels le retrait serait infondé (licence, usage autorisé, erreur d'identification) ;\n• consentement à la juridiction française si applicable ;\n• vos coordonnées.\n\nOnScen peut rétablir le contenu si la situation le justifie légalement, sous réserve de litige entre les parties.`,
    },
    {
      heading: '5. Répétition des infractions',
      body: `Les comptes dont les contenus font l'objet de retraits répétés pour atteinte aux droits d'auteur peuvent être suspendus ou supprimés.`,
    },
    {
      heading: '6. Autres contacts',
      body: `Questions générales : ${LEGAL_CONTACT_EMAIL}.\n\nCette politique ne remplace pas un conseil juridique ; les titulaires de droits peuvent aussi recourir aux voies judiciaires.`,
    },
  ],
};
