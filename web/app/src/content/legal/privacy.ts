import type { LegalDocument } from './types';
import { LEGAL_PRIVACY_EMAIL } from './types';

/** Politique de confidentialité (RGPD) */
export const politiqueConfidentialite: LegalDocument = {
  title: 'Politique de confidentialité',
  updated: '15 juillet 2026',
  sections: [
    {
      heading: '1. Responsable du traitement',
      body: 'Le responsable du traitement des données personnelles est l\'éditeur de OnScen, identifié dans les Mentions légales.\n\nContact données personnelles : {{privacyEmail}}\nContact général : {{contactEmail}}\n\nDélégué à la protection des données (DPO) : {{dpoEmail}}',
    },
    {
      heading: '2. Données traitées',
      body: 'Selon votre utilisation, nous pouvons traiter :\n\n• Données de compte : pseudo, e-mail, mot de passe (stocké de manière hachée), photo(s) de profil, bio, centres d\'intérêt, genres et artistes favoris, rôle (auditeur/host).\n• Données de localisation : coordonnées GPS fournies par votre appareil, position floutée affichée sur la carte, préférences de précision (ville / ~50 m), mode fantôme.\n• Données d\'usage : salons créés ou rejoints, lives, file d\'attente musicale, état de lecture synchronisé.\n• Communications : messages de chat (salon, live), messages privés, commentaires sur reels.\n• Données sociales : abonnements, cœurs/matchs, notifications, blocages, notes aux hosts.\n• Données techniques : jeton de session, identifiants socket, logs techniques, adresse IP lors des connexions au serveur.\n• Connexions plateformes : indicateur de liaison YouTube (jetons OAuth le cas échéant).\n• Médias uploadés : compositions audio, reels, stories, pièces jointes chat — analysés pour modération (Sightengine) et, le cas échéant, détection de correspondances catalogue (ACRCloud).',
    },
    {
      heading: '3. Finalités et bases légales',
      body: 'Nous traitons vos données pour :\n\n• Fournir le Service (exécution du contrat / CGU) : compte, carte, salons, chat, synchronisation.\n• Assurer la sécurité et la modération (intérêt légitime) : prévention des abus, bannissements live, signalements.\n• Respecter nos obligations légales : conservation des logs si requis, réponse aux autorités.\n• Améliorer le Service (intérêt légitime, dans la mesure du nécessaire) : statistiques agrégées, correction de bugs.\n\nLe géolocalisation repose sur votre action positive (activation de la géolocalisation du navigateur) et les paramètres de confidentialité que vous choisissez.\n\nNous ne vendons pas vos données personnelles à des tiers à des fins publicitaires.',
    },
    {
      heading: '4. Destinataires et sous-traitants',
      body: 'Les données peuvent être accessibles :\n• aux autres utilisateurs, selon vos paramètres (profil public, carte, messages) ;\n• à l\'éditeur et aux personnes habilitées pour l\'exploitation et la maintenance ;\n• à des prestataires techniques listés ci-dessous ;\n• à Google/YouTube lorsque vous connectez votre compte ou ouvrez un lien de lecture (politiques propres à ces services).\n\nSous-traitants et services intégrés :\n• Scaleway (hébergement, base de données, stockage fichiers) — France/UE\n• Cloudflare (CDN, WAF, DNS, protection DDoS) — transit IP et métadonnées HTTP\n• LiveKit (salons audio temps réel WebRTC) — signalisation et métadonnées de session\n• Cloudflare Stream (retransmission vidéo live HLS) — flux et métadonnées de diffusion\n• Sightengine (modération automatique images/vidéos UGC) — contenus analysés, pas de profilage\n• ACRCloud (empreinte audio catalogue commercial) — fichiers audio/vidéo uploadés, si activé\n• Sentry (monitoring erreurs application) — uniquement avec votre consentement cookies « tout accepter » ; stack traces anonymisées, pas de PII par défaut\n• Stripe (paiements) — données de transaction tokenisées\n• Resend (e-mails transactionnels) — adresse e-mail et contenu des messages système\n\nCartographie : tuiles CARTO / OpenStreetMap (pas de transmission de votre compte OnScen à OSM par défaut, mais requêtes cartographiques depuis votre appareil).\n\nAvatars par défaut : service DiceBear (URLs d\'images).',
    },
    {
      heading: '5. Durées de conservation',
      body: '• Compte et profil : pendant la durée du compte, puis suppression ou anonymisation dans un délai raisonnable après clôture.\n• Messages : conservés tant que nécessaire au fonctionnement de l\'historique des conversations ; vous pouvez masquer ou supprimer certains messages selon les fonctions proposées.\n• Données de localisation : dernière position connue mise à jour à chaque session ; non conservées au-delà du nécessaire pour le Service.\n• Logs techniques : durée limitée (ex. 12 mois en production, sauf obligation légale contraire).',
    },
    {
      heading: '6. Sécurité',
      body: `Nous mettons en œuvre des mesures appropriées : authentification par jeton (JWT), mots de passe hachés (bcrypt), floutage des coordonnées, contrôles d'accès aux salons sur invitation, chiffrement HTTPS recommandé en production.\n\nAucun système n'étant totalement sécurisé, vous devez protéger vos identifiants et signaler toute compromission à ${LEGAL_PRIVACY_EMAIL}.`,
    },
    {
      heading: '7. Vos droits (RGPD)',
      body: `Vous disposez des droits suivants, dans les conditions du RGPD :\n\n• Accès et copie de vos données ;\n• Rectification des données inexactes ;\n• Effacement (« droit à l'oubli ») ;\n• Limitation du traitement ;\n• Opposition, notamment pour les traitements fondés sur l'intérêt légitime ;\n• Portabilité des données que vous nous avez fournies, dans un format structuré ;\n• Retrait du consentement lorsque le traitement est fondé sur le consentement, sans affecter la licéité antérieure.\n\nPour exercer vos droits : ${LEGAL_PRIVACY_EMAIL}. Une pièce d'identité pourra être demandée en cas de doute raisonnable sur votre identité.\n\nFonctionnalités disponibles directement dans l'app :\n• Export de vos données (JSON) → Paramètres > Exporter mes données\n• Suppression de votre compte → Paramètres > Supprimer mon compte\n\nRéclamation auprès de la CNIL : www.cnil.fr`,
    },
    {
      heading: '8. Transferts hors UE',
      body: 'Certains prestataires (ex. Google/YouTube) peuvent traiter des données aux États-Unis ou dans d\'autres pays. Le cas échéant, des garanties appropriées (clauses contractuelles types, décision d\'adéquation) seront mises en place conformément au RGPD.',
    },
    {
      heading: '9. Mineurs',
      body: `Le Service s'adresse aux personnes de 13 ans et plus. Lors de l'inscription, chaque utilisateur confirme activement avoir au moins 13 ans (case à cocher obligatoire). Les paiements et la monétisation créateur sont réservés aux 18 ans et plus. Nous ne collectons pas sciemment de données concernant des enfants de moins de 13 ans. Si vous êtes parent et pensez qu'un mineur nous a transmis des données, contactez-nous à ${LEGAL_PRIVACY_EMAIL} pour demander la suppression.`,
    },
    {
      heading: '10. Cookies et stockage local',
      body: 'OnScen utilise :\n\n• Un cookie httpOnly sécurisé (onscen_auth) pour la session web — inaccessible au JavaScript, protégé contre le vol par XSS.\n• Sur l’application mobile native (Capacitor), le jeton de session est conservé dans le stockage sécurisé de l’appareil (Keychain iOS / Keystore Android), et non dans le stockage WebView.\n• localStorage pour les préférences non sensibles : langue, rayon carte, réglages d’interface, choix de consentement cookies (onscen_cookie_consent_v1).\n• Des services tiers (YouTube lecteur intégré, Stripe paiements sur web) — sur mobile natif, les lecteurs et paiements suivent les règles de la plateforme.\n• Sentry (monitoring erreurs) — chargé uniquement si vous acceptez les cookies non essentiels (« tout accepter »).\n\nVous pouvez effacer le stockage local via les paramètres du navigateur (web) ou en vous déconnectant / supprimant l’application (mobile).',
    },
    {
      heading: '11. Autorisations OAuth YouTube',
      body: 'Lorsque vous connectez YouTube en production, OnScen demande uniquement les autorisations nécessaires aux fonctionnalités visibles :\n\nYouTube :\n• youtube.readonly : lister vos playlists YouTube privées lorsque vous hébergez un salon.\n\nLes métadonnées YouTube obtenues via la Data API (titres, chaînes, miniatures) sont mises en cache côté serveur au maximum 1 heure, conformément aux YouTube API Services Terms.\n\nVous pouvez révoquer ces autorisations à tout moment en déconnectant YouTube dans OnScen ou depuis les paramètres de votre compte Google.',
    },
    {
      heading: '12. Modifications',
      body: 'Cette politique peut être mise à jour. La date de dernière mise à jour figure en tête du document. En cas de changement important, une information pourra être affichée dans l\'Application.',
    },
  ],
};
