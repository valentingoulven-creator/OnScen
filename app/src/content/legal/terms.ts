import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL } from './types';

/** Conditions générales d’utilisation (CGU) */
export const cgu: LegalDocument = {
  title: "Conditions générales d'utilisation",
  updated: '10 juin 2026',
  sections: [
    {
      heading: '1. Objet et acceptation',
      body: `Les présentes Conditions générales d’utilisation (« CGU ») régissent l’accès et l’utilisation de l’application Soundy (« l’Application », « le Service »), accessible via navigateur web ou PWA.\n\nEn créant un compte ou en utilisant le Service, vous acceptez sans réserve les CGU, la Politique de confidentialité, les Mentions légales et, le cas échéant, les Conditions relatives aux API Spotify et YouTube.\n\nSi vous n’acceptez pas ces documents, vous ne devez pas utiliser le Service.`,
    },
    {
      heading: '2. Description du Service',
      body: `Soundy permet notamment :\n• de visualiser sur une carte des salons d’écoute musicale et des lives à proximité ;\n• de créer ou rejoindre des salons (Spotify ou YouTube) et d’écouter de façon synchronisée via les plateformes tierces ;\n• d’échanger via chat public (salon, live) et messages privés ;\n• de publier ou consulter des reels, de suivre des utilisateurs, d’envoyer des réactions gratuites, des pourboires volontaires en live ou des abonnements mensuels créateurs / Soundy+ (simulation en msdev ; paiement Stripe en production, réservé aux 18 ans et plus — voir « Pourboires, abonnements et monétisation »).\n\nLe Service est une plateforme sociale musicale. Il ne constitue pas un service de rencontre, de conseil juridique, médical ou financier.`,
    },
    {
      heading: '3. Éligibilité et compte',
      body: `Vous devez avoir au moins 13 ans pour créer un compte et utiliser Soundy. Si vous avez entre 13 et 18 ans, vous déclarez avoir l’autorisation de votre représentant légal.\n\nLancer un live (diffusion artistique) est réservé aux utilisateurs de 16 ans et plus.\n\nLes paiements (pourboires, abonnements) et la réception de monétisation en tant que créateur sont réservés aux 18 ans et plus (voir « Pourboires, abonnements et monétisation »).\n\nVous vous engagez à fournir des informations exactes lors de l’inscription et à maintenir la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est réputée effectuée par vous.\n\nL’éditeur peut suspendre ou supprimer un compte en cas de violation des CGU, sans indemnité, après notification lorsque la loi l’exige.`,
    },
    {
      heading: '4. Comportement des utilisateurs',
      body: `Vous vous engagez à :\n• respecter les lois applicables et les droits des tiers ;\n• ne pas harceler, menacer, discriminer ou publier de contenus illicites, haineux, pornographiques impliquant des mineurs, ou portant atteinte à la vie privée d’autrui ;\n• ne pas usurper l’identité d’une personne ou d’une entité ;\n• ne pas perturber le Service (spam, bots non autorisés, attaques informatiques) ;\n• ne pas collecter des données d’autres utilisateurs à des fins commerciales non consenties.\n\nLes hosts de salons et lives peuvent modérer le chat (suppression de messages, bannissement) dans les limites prévues par l’Application.`,
    },
    {
      heading: '5. Contenus et musique',
      body: `Vous êtes seul responsable des contenus que vous publiez (messages, propositions de morceaux, reels, photos de profil).\n\nLa lecture musicale s’effectue via Spotify ou YouTube : vous devez disposer des droits et abonnements nécessaires auprès de ces plateformes. Soundy ne fournit pas de licence musicale propre et ne remplace pas les conditions d’utilisation de Spotify ou YouTube.\n\nSalons Spotify :\n• L’hôte doit disposer d’un abonnement Spotify Premium et maintenir l’application Spotify ouverte (Spotify Connect) pour synchroniser la lecture.\n• Soundy affiche un chrono partagé et des métadonnées ; l’audio est lu dans l’application Spotify de chaque participant, pas dans le navigateur Soundy.\n• Spotify Jam : faute d’API publique Spotify pour les sessions Jam, l’hôte partage manuellement un lien socialsession dans le salon. Soundy stocke ce lien pour faciliter le partage ; la session Jam reste gérée par Spotify.\n\nSalons YouTube :\n• La lecture utilise le lecteur officiel YouTube IFrame API ; en production, la vidéo doit rester visible (pas de mode audio seul).\n• L’aperçu d’écoute depuis la carte est limité à 10 minutes par session pour les participants ; ouvrez le salon pour poursuivre.\n\nVous accordez à l’éditeur une licence non exclusive, mondiale et gratuite pour héberger, afficher et diffuser vos contenus dans le cadre du fonctionnement du Service.`,
    },
    {
      heading: '6. Géolocalisation et visibilité',
      body: `Le Service utilise votre position pour afficher des contenus à proximité. Par défaut, la position affichée aux autres utilisateurs est floutée (environ 50 m). Vous pouvez masquer votre position sur la carte (icône œil barré en haut de l’écran), limiter la précision (ville uniquement) ou refuser le partage de distance via le même menu.\n\nVous restez responsable des risques liés à la divulgation de votre localisation approximative.`,
    },
    {
      heading: '7. Messages privés et modération',
      body: `Les messages privés et chats peuvent être stockés sur les serveurs du Service pour assurer la délivrabilité et l’historique des conversations. En environnement msdev, les données peuvent être conservées localement sur le serveur de démonstration.\n\nL’éditeur peut intervenir en cas de signalement d’abus manifeste, sans obligation de surveillance générale et préalable de tous les contenus.`,
    },
    {
      heading: '8. Propriété intellectuelle de Soundy',
      body: `Soundy, son interface, sa marque et ses éléments originaux restent la propriété de l’éditeur ou de ses concédants. Aucune cession de droits de propriété intellectuelle n’est consentie au-delà d’une licence d’utilisation personnelle, non exclusive et révocable, pour la durée d’utilisation du Service conformément aux CGU.`,
    },
    {
      heading: '9. Disponibilité et évolutions',
      body: `Le Service est fourni « en l’état ». En version msdev, il peut être interrompu, réinitialisé ou modifié sans préavis (notamment redémarrage du serveur entraînant une perte temporaire des données non sauvegardées).\n\nL’éditeur peut faire évoluer les fonctionnalités, les CGU et les tarifs éventuels. Les CGU applicables sont celles en vigueur à la date d’utilisation ; en cas de changement substantiel, une information pourra être affichée dans l’Application.`,
    },
    {
      heading: '10. Limitation de responsabilité',
      body: `Dans les limites autorisées par la loi, l’éditeur n’est pas responsable des dommages indirects, pertes de données, préjudices résultant de l’utilisation de services tiers (Spotify, YouTube, réseau mobile), ou de contenus publiés par les utilisateurs.\n\nLa responsabilité totale de l’éditeur, si elle devait être engagée, est limitée au montant éventuellement payé par l’utilisateur au cours des douze derniers mois pour le Service, ou à 100 € en l’absence de paiement.`,
    },
    {
      heading: '11. Résiliation',
      body: `Vous pouvez cesser d’utiliser le Service à tout moment et demander la suppression de votre compte via ${LEGAL_CONTACT_EMAIL}.\n\nL’éditeur peut résilier l’accès en cas de manquement grave ou répété aux CGU.`,
    },
    {
      heading: '12. Droit applicable et contact',
      body: `Les CGU sont régies par le droit français. Tout litige relève des tribunaux français compétents, sous réserve des règles impératives applicables aux consommateurs.\n\nContact : ${LEGAL_CONTACT_EMAIL}`,
    },
  ],
};
