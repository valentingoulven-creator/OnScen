import type { LegalDocument } from './types';

/** Politique cookies et traceurs (ePrivacy / CNIL) */
export const politiqueCookies: LegalDocument = {
  title: 'Politique cookies',
  updated: '29 juin 2026',
  sections: [
    {
      heading: '1. Qu\'est-ce qu\'un cookie ?',
      body: 'Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone) lors de la visite d\'un site. Soundy utilise également le stockage local du navigateur (localStorage) pour certaines préférences.',
    },
    {
      heading: '2. Cookies strictement nécessaires',
      body: 'Ces cookies sont indispensables au fonctionnement du service. Ils ne nécessitent pas votre consentement préalable (RGPD / directive ePrivacy).\n\n• soundy_auth : cookie httpOnly sécurisé contenant votre jeton de session web. Durée : session ou 7 jours si « rester connecté ».\n• Préférences essentielles en localStorage : langue, consentement cookies (soundy_cookie_consent_v1).\n\nSur l\'application mobile native (Capacitor), la session est stockée dans le Keychain iOS / Keystore Android.',
    },
    {
      heading: '3. Cookies et services tiers (consentement requis)',
      body: 'Ces services ne sont chargés que si vous choisissez « Tout accepter » dans la bannière cookies :\n\n• Stripe.js : traitement sécurisé des paiements (pourboires, abonnements créateurs) sur le web.\n• YouTube IFrame API : lecteur intégré lorsque vous visionnez du contenu YouTube dans l\'application.\n\nVous pouvez retirer votre consentement à tout moment via Paramètres > Préférences cookies.',
    },
    {
      heading: '4. Durée de conservation',
      body: '• Cookie de session : supprimé à la fermeture du navigateur (sauf « rester connecté » : 7 jours).\n• Consentement cookies (localStorage) : conservé jusqu\'à modification ou effacement du stockage local.\n• Cookies tiers : selon les politiques de Stripe et Google/YouTube.',
    },
    {
      heading: '5. Gérer vos choix',
      body: '• Refuser ou accepter les cookies non essentiels via la bannière affichée lors de votre première visite web.\n• Modifier votre choix : Paramètres > Préférences cookies.\n• Effacer les cookies via les paramètres de votre navigateur.\n\nContact : privacy@getsoundy.com',
    },
  ],
};
