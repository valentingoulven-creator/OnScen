import type { LegalDocument } from './types';

/**
 * Conditions d’utilisation des API tierces (Spotify, YouTube).
 * Soundy n’est pas affilié à ces services. Texte informatif — se référer aux documents officiels.
 */
export const conditionsApiPlateformes: LegalDocument = {
  title: 'Spotify & YouTube — conditions des API',
  updated: '3 juin 2026',
  sections: [
    {
      heading: '1. Rôle de Soundy',
      body: `Soundy permet de lier un compte Spotify ou YouTube, d’afficher des métadonnées de morceaux (titre, artiste, pochette) et d’ouvrir la lecture sur la plateforme concernée. Soundy ne stocke ni ne redistribue de fichiers audio en dehors des mécanismes autorisés par ces plateformes.\n\nEn environnement msdev, la connexion peut être simulée à des fins de démonstration sans appel réel aux API de production.`,
    },
    {
      heading: '2. Spotify — conditions développeur',
      body: `Lorsque la connexion Spotify réelle est activée, l’utilisation est soumise aux documents Spotify, notamment :\n\n• Spotify Developer Terms : https://developer.spotify.com/terms\n• Spotify Platform Rules : https://developer.spotify.com/policy\n• Conditions d’utilisation Spotify pour les utilisateurs finaux : https://www.spotify.com/legal/end-user-agreement/\n• Politique de confidentialité Spotify : https://www.spotify.com/legal/privacy-policy/\n\nObligations principales pour Soundy (résumé non exhaustif) :\n• Utiliser les API uniquement pour les finalités déclarées et approuvées par Spotify.\n• Ne pas contourner les restrictions techniques, ne pas surcharger les serveurs.\n• Afficher les attributions et logos conformément au Spotify Branding Guidelines.\n• Ne pas suggérer que Spotify sponsorise Soundy sans autorisation.\n• Les contenus Spotify restent la propriété de Spotify et de ses concédants ; aucun droit de propriété n’est transféré à Soundy.\n• Respecter le Streaming Administrator Policies et les limites d’utilisation des données (pas de base de données dérivée non autorisée des morceaux/utilisateurs Spotify).`,
    },
    {
      heading: '3. YouTube / Google — API Services',
      body: `Lorsque les API YouTube (YouTube Data API, lecteur embarqué, etc.) sont utilisées, l’utilisation est soumise notamment à :\n\n• YouTube Terms of Service : https://www.youtube.com/t/terms\n• YouTube API Services Terms of Service : https://developers.google.com/youtube/terms/api-services-terms-of-service\n• YouTube API Branding Guidelines : https://developers.google.com/youtube/branding_guidelines\n• Google API Services User Data Policy : https://developers.google.com/terms/api-services-user-data-policy\n• Google Privacy Policy : https://policies.google.com/privacy\n• Conditions d’utilisation des API Google : https://developers.google.com/terms\n\nExigences clés pour les applications utilisant les API Google (résumé) :\n• Fournir une politique de confidentialité claire et un lien vers les CGU de Soundy.\n• Obtenir le consentement de l’utilisateur pour l’accès à ses données Google/YouTube lorsque requis (OAuth).\n• Utiliser les données Google uniquement pour fournir ou améliorer les fonctionnalités visibles par l’utilisateur dans Soundy.\n• Ne pas vendre les données utilisateur obtenues via les API Google.\n• Permettre la révocation de l’accès (déconnexion du compte YouTube dans Soundy).\n• Afficher les attributions YouTube requises (logo, texte « YouTube ») lors de l’utilisation du lecteur ou des métadonnées.\n• Ne pas stocker les données API YouTube au-delà de 24 heures (Soundy applique un cache de 1 heure maximum).\n• Ne pas afficher de contenu YouTube dans un player personnalisé contournant le lecteur officiel IFrame API.\n• Ne pas permettre la lecture audio sans afficher le player vidéo YouTube en production (strictCompliance activé).`,
    },
    {
      heading: '4. Données échangées avec les plateformes',
      body: `Selon la connexion choisie, peuvent être traités : identifiant utilisateur sur la plateforme, jetons d’accès OAuth (en production), métadonnées de lecture (titre, artiste, identifiant de piste, état de lecture pour synchronisation des salons).\n\nCes données sont traitées par Spotify ou Google selon leurs propres politiques. Soundy limite sa conservation aux besoins du Service (jetons chiffrés, révocation à la déconnexion).`,
    },
    {
      heading: '5. Responsabilité de l’utilisateur',
      body: `Vous devez disposer d’un compte Spotify et/ou YouTube valide et respecter les conditions de ces plateformes. Toute utilisation illicite du contenu (téléchargement non autorisé, contournement DRM) est interdite et peut entraîner la suspension de votre compte Soundy et des comptes tiers.`,
    },
    {
      heading: '6. Révocation et suppression',
      body: `Vous pouvez déconnecter Spotify ou YouTube depuis les paramètres de profil Soundy. Vous pouvez également révoquer l’accès de Soundy depuis les paramètres de sécurité de votre compte Google ou Spotify.\n\nLa déconnexion supprime l’autorisation de lecture hébergée via la plateforme concernée dans les salons que vous animez.`,
    },
    {
      heading: '7. Évolutions et conformité produit',
      body: `Avant toute mise en production utilisant les API officielles, l’éditeur de Soundy doit :\n• enregistrer le projet auprès des consoles développeur Spotify et Google ;\n• obtenir les quotas et validations requis (ex. audit Google pour certaines scopes sensibles) ;\n• intégrer les écrans d’autorisation OAuth conformes ;\n• mettre à jour la Politique de confidentialité avec le détail des scopes utilisés.\n\nLes liens vers les documents officiels prévalent en cas de divergence avec ce résumé.`,
    },
  ],
};
