import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL, LEGAL_PRIVACY_EMAIL } from './types';

/** Politique de confidentialité (RGPD) */
export const politiqueConfidentialite: LegalDocument = {
  title: 'Politique de confidentialité',
  updated: '3 juin 2026',
  sections: [
    {
      heading: '1. Responsable du traitement',
      body: `Le responsable du traitement des données personnelles est l’éditeur de MeloSong, identifié dans les Mentions légales.\n\nContact données personnelles : ${LEGAL_PRIVACY_EMAIL}\nContact général : ${LEGAL_CONTACT_EMAIL}\n\nDélégué à la protection des données (DPO) : [non désigné / à compléter si applicable]`,
    },
    {
      heading: '2. Données traitées',
      body: `Selon votre utilisation, nous pouvons traiter :\n\n• Données de compte : pseudo, e-mail, mot de passe (stocké de manière hachée), photo(s) de profil, bio, centres d’intérêt, genres et artistes favoris, rôle (auditeur/host).\n• Données de localisation : coordonnées GPS fournies par votre appareil, position floutée affichée sur la carte, préférences de précision (ville / ~50 m), mode fantôme.\n• Données d’usage : salons créés ou rejoints, lives, file d’attente musicale, état de lecture synchronisé.\n• Communications : messages de chat (salon, live), messages privés, commentaires sur reels.\n• Données sociales : abonnements, cœurs/matchs, notifications, blocages, notes aux hosts.\n• Données techniques : jeton de session, identifiants socket, logs techniques, adresse IP lors des connexions au serveur.\n• Connexions plateformes : indicateur de liaison Spotify/YouTube (en msdev, connexion souvent simulée ; en production, jetons OAuth le cas échéant).`,
    },
    {
      heading: '3. Finalités et bases légales',
      body: `Nous traitons vos données pour :\n\n• Fournir le Service (exécution du contrat / CGU) : compte, carte, salons, chat, synchronisation.\n• Assurer la sécurité et la modération (intérêt légitime) : prévention des abus, bannissements live, signalements.\n• Respecter nos obligations légales : conservation des logs si requis, réponse aux autorités.\n• Améliorer le Service (intérêt légitime, dans la mesure du nécessaire) : statistiques agrégées, correction de bugs.\n\nLe géolocalisation repose sur votre action positive (activation de la géolocalisation du navigateur) et les paramètres de confidentialité que vous choisissez.\n\nNous ne vendons pas vos données personnelles à des tiers à des fins publicitaires.`,
    },
    {
      heading: '4. Destinataires et sous-traitants',
      body: `Les données peuvent être accessibles :\n• aux autres utilisateurs, selon vos paramètres (profil public, carte, messages) ;\n• à l’éditeur et aux personnes habilitées pour l’exploitation et la maintenance ;\n• à des prestataires techniques (hébergement, lors du passage en production) ;\n• aux plateformes Spotify et YouTube lorsque vous connectez votre compte ou ouvrez un lien de lecture (politiques propres à ces services).\n\nCartographie : tuiles CARTO / OpenStreetMap (pas de transmission de votre compte MeloSong à OSM par défaut, mais requêtes cartographiques depuis votre appareil).\n\nAvatars de démonstration : service DiceBear (URLs d’images).`,
    },
    {
      heading: '5. Durées de conservation',
      body: `• Compte et profil : pendant la durée du compte, puis suppression ou anonymisation dans un délai raisonnable après clôture.\n• Messages : conservés tant que nécessaire au fonctionnement de l’historique des conversations ; vous pouvez masquer ou supprimer certains messages selon les fonctions proposées.\n• Données de localisation : dernière position connue mise à jour à chaque session ; non conservées au-delà du nécessaire pour le Service.\n• Logs techniques : durée limitée (ex. 12 mois en production, sauf obligation légale contraire).\n\nEn environnement msdev : les données peuvent être stockées dans un fichier local sur le serveur de démonstration ou en mémoire ; un redémarrage sans sauvegarde peut entraîner une perte des données.`,
    },
    {
      heading: '6. Sécurité',
      body: `Nous mettons en œuvre des mesures appropriées : authentification par jeton (JWT), mots de passe hachés (bcrypt), floutage des coordonnées, contrôles d’accès aux salons sur invitation, chiffrement HTTPS recommandé en production.\n\nAucun système n’étant totalement sécurisé, vous devez protéger vos identifiants et signaler toute compromission à ${LEGAL_PRIVACY_EMAIL}.`,
    },
    {
      heading: '7. Vos droits (RGPD)',
      body: `Vous disposez des droits suivants, dans les conditions du RGPD :\n\n• Accès et copie de vos données ;\n• Rectification des données inexactes ;\n• Effacement (« droit à l’oubli ») ;\n• Limitation du traitement ;\n• Opposition, notamment pour les traitements fondés sur l’intérêt légitime ;\n• Portabilité des données que vous nous avez fournies, dans un format structuré ;\n• Retrait du consentement lorsque le traitement est fondé sur le consentement, sans affecter la licéité antérieure.\n\nPour exercer vos droits : ${LEGAL_PRIVACY_EMAIL}. Une pièce d’identité pourra être demandée en cas de doute raisonnable sur votre identité.\n\nRéclamation auprès de la CNIL : www.cnil.fr`,
    },
    {
      heading: '8. Transferts hors UE',
      body: `Certains prestataires (ex. Google/YouTube, Spotify) peuvent traiter des données aux États-Unis ou dans d’autres pays. Le cas échéant, des garanties appropriées (clauses contractuelles types, décision d’adéquation) seront mises en place conformément au RGPD.`,
    },
    {
      heading: '9. Mineurs',
      body: `Le Service s’adresse aux personnes de 16 ans et plus. Nous ne collectons pas sciemment de données concernant des enfants de moins de 16 ans. Si vous êtes parent et pensez qu’un mineur nous a transmis des données, contactez-nous pour demander la suppression.`,
    },
    {
      heading: '10. Cookies et stockage local',
      body: `L’Application utilise le localStorage du navigateur pour : le jeton de connexion (melosong_token), le rayon de recherche sur la carte, la langue, les préférences de confidentialité locales, certains réglages d’interface (ex. chat live masqué).\n\nVous pouvez effacer ces données via les paramètres de votre navigateur ; cela vous déconnectera et réinitialisera certaines préférences.`,
    },
    {
      heading: '11. Modifications',
      body: `Cette politique peut être mise à jour. La date de dernière mise à jour figure en tête du document. En cas de changement important, une information pourra être affichée dans l’Application.`,
    },
  ],
};
