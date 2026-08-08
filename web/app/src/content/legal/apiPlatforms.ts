import type { LegalDocument } from './types';

/** Conditions d’utilisation des API tierces (YouTube). */
export const conditionsApiPlateformes: LegalDocument = {
  title: 'YouTube — conditions des API',
  updated: '28 juin 2026',
  sections: [
    {
      heading: '1. Rôle de OnScen',
      body: `OnScen permet de lier un compte YouTube, d’afficher des métadonnées de morceaux (titre, artiste, miniature) et d’ouvrir la lecture via le lecteur officiel YouTube. OnScen ne stocke ni ne redistribue de fichiers audio en dehors des mécanismes autorisés par Google/YouTube.`,
    },
    {
      heading: '2. YouTube / Google — API Services',
      body: `Lorsque les API YouTube (YouTube Data API, lecteur embarqué, etc.) sont utilisées, l’utilisation est soumise notamment à :\n\n• YouTube Terms of Service : https://www.youtube.com/t/terms\n• YouTube API Services Terms of Service : https://developers.google.com/youtube/terms/api-services-terms-of-service\n• YouTube API Branding Guidelines : https://developers.google.com/youtube/branding_guidelines\n• Google API Services User Data Policy : https://developers.google.com/terms/api-services-user-data-policy\n• Google Privacy Policy : https://policies.google.com/privacy\n• Conditions d’utilisation des API Google : https://developers.google.com/terms\n\nExigences clés pour les applications utilisant les API Google (résumé) :\n• Fournir une politique de confidentialité claire et un lien vers les CGU de OnScen.\n• Obtenir le consentement de l’utilisateur pour l’accès à ses données Google/YouTube lorsque requis (OAuth scope youtube.readonly).\n• Utiliser les données Google uniquement pour fournir ou améliorer les fonctionnalités visibles par l’utilisateur dans OnScen.\n• Ne pas vendre les données utilisateur obtenues via les API Google.\n• Permettre la révocation de l’accès (déconnexion du compte YouTube dans OnScen).\n• Afficher les attributions YouTube requises (badge ou texte « YouTube », lien « Ouvrir sur YouTube ») lors de l’utilisation du lecteur ou des métadonnées, conformément aux YouTube API Branding Guidelines.\n• Ne pas stocker les données API YouTube au-delà de 24 heures (OnScen applique un cache serveur de 1 heure maximum sur toutes les réponses YouTube Data API v3 : recherche, playlists, éléments de playlist).\n• Ne pas afficher de contenu YouTube dans un player personnalisé contournant le lecteur officiel IFrame API.\n• Ne pas permettre la lecture audio sans afficher le player vidéo YouTube en production (strictCompliance activé en production).\n• Aperçu carte : l’écoute YouTube intégrée depuis la carte est limitée à 10 minutes par session pour les participants non-hôtes ; ouvrir le salon complet permet de poursuivre l’écoute conformément aux ToS YouTube.`,
    },
    {
      heading: '3. Données échangées avec YouTube',
      body: `Peuvent être traités : identifiant utilisateur Google, jetons d’accès OAuth (en production), métadonnées de lecture (titre, artiste, identifiant vidéo, état de lecture pour synchronisation des salons).\n\nScope OAuth demandé (production) :\n• YouTube : youtube.readonly (listage des playlists privées de l’hôte).\n\nCes données sont traitées par Google selon sa politique. OnScen limite sa conservation aux besoins du Service (jetons chiffrés, révocation à la déconnexion, cache API YouTube 1 h max).`,
    },
    {
      heading: '4. Responsabilité de l’utilisateur',
      body: `Vous devez disposer d’un compte Google/YouTube valide et respecter les conditions de la plateforme.\n\nPour héberger un salon YouTube : compte Google/YouTube valide.\n\nToute utilisation illicite du contenu (téléchargement non autorisé, contournement DRM) est interdite et peut entraîner la suspension de votre compte OnScen et de votre compte Google/YouTube.`,
    },
    {
      heading: '5. Révocation et suppression',
      body: `Vous pouvez déconnecter YouTube depuis les paramètres de profil OnScen. Vous pouvez également révoquer l’accès de OnScen depuis les paramètres de sécurité de votre compte Google.\n\nLa déconnexion supprime l’autorisation de lecture hébergée via YouTube dans les salons que vous animez.`,
    },
    {
      heading: '6. Évolutions et conformité produit',
      body: `Avant toute mise en production utilisant les API officielles, l’éditeur de OnScen doit :\n• enregistrer le projet auprès de la console développeur Google ;\n• obtenir les quotas et validations requis (audit Google OAuth pour youtube.readonly si nécessaire) ;\n• intégrer les écrans d’autorisation OAuth conformes ;\n• mettre à jour la Politique de confidentialité avec le détail des scopes utilisés.\n\nLes liens vers les documents officiels prévalent en cas de divergence avec ce résumé.`,
    },
  ],
};
