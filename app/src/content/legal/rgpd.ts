import type { LegalDocument } from './types';
import { LEGAL_PRIVACY_EMAIL } from './types';

/** Registre synthétique et conformité RGPD (transparence opérationnelle) */
export const conformiteRgpd: LegalDocument = {
  title: 'Conformité RGPD',
  updated: '3 juin 2026',
  sections: [
    {
      heading: '1. Engagement',
      body: `MeloSong s’engage à traiter les données personnelles conformément au Règlement (UE) 2016/679 (RGPD) et à la loi française « Informatique et Libertés ».\n\nCe document complète la Politique de confidentialité en détaillant les traitements principaux, les mesures de conformité et les actions attendues avant une mise en production publique.`,
    },
    {
      heading: '2. Registre des activités de traitement (synthèse)',
      body: `| Traitement | Finalité | Base légale | Catégories de données | Durée |\n| Comptes utilisateurs | Création et gestion du compte | Contrat (CGU) | Identité, contact, profil | Durée du compte |\n| Géolocalisation | Carte, proximité, salons | Contrat + consentement navigateur | Position, préférences | Session / compte |\n| Salons & lecture | Service cœur | Contrat | Contenu musical, présence | Durée du salon / compte |\n| Chat & MP | Communication | Contrat | Contenu des messages | Historique conversation |\n| Modération | Sécurité | Intérêt légitime | Messages, bans, signalements | Durée nécessaire |\n| Logs techniques | Sécurité, debug | Intérêt légitime | IP, horodatage | 12 mois max (prod.) |\n| OAuth Spotify/YouTube | Liaison compte (prod.) | Contrat / consentement | Identifiant plateforme, jetons | Jusqu’à déconnexion |`,
    },
    {
      heading: '3. Minimisation et privacy by design',
      body: `• Position floutée (~50 m) par défaut avant affichage aux autres utilisateurs.\n• Mode fantôme : retrait de la carte « personnes proches ».\n• Option « ville uniquement » sans coordonnées précises pour les autres.\n• Option de ne pas partager la distance en kilomètres.\n• Salons sur invitation : limitation des participants.\n• Pas de profilage publicitaire basé sur les données de navigation dans la version actuelle.`,
    },
    {
      heading: '4. Exercice des droits — procédure interne',
      body: `Toute demande (accès, rectification, effacement, portabilité, opposition) adressée à ${LEGAL_PRIVACY_EMAIL} doit être traitée dans un délai d’un mois (prolongation possible de deux mois si complexité, avec information de l’utilisateur).\n\nVérification d’identité avant divulgation ou suppression de données sensibles.\n\nEn cas de demande d’effacement : suppression du compte, des messages associés (sous réserve des obligations légales de conservation), et retrait de la carte.`,
    },
    {
      heading: '5. Violations de données (data breach)',
      body: `En cas de violation de données personnelles susceptible d’engendrer un risque pour les droits et libertés, l’éditeur notifiera la CNIL dans les 72 heures lorsque requis et informera les personnes concernées lorsque le risque est élevé, conformément aux articles 33 et 34 du RGPD.`,
    },
    {
      heading: '6. Analyse d’impact (AIPD / DPIA)',
      body: `Le traitement de géolocalisation en temps réel et la visibilité sur une carte peuvent nécessiter une analyse d’impact relative à la protection des données (AIPD) avant déploiement à grande échelle, compte tenu des risques de réidentification malgré le floutage.\n\nMesures d’atténuation déjà prévues : floutage, mode fantôme, précision ville, limitation du rayon d’affichage, modération.`,
    },
    {
      heading: '7. Sous-traitants et accords',
      body: `Avant production, l’éditeur doit :\n• recenser tous les sous-traitants (hébergeur, CDN, e-mail, analytics éventuels) ;\n• signer des accords de traitement (DPA / art. 28 RGPD) ;\n• documenter les transferts hors UE et les garanties associées.\n\nServices tiers intégrés ou liés : Spotify AB, Google/YouTube (API Services), hébergeur à définir, CARTO/OSM pour les tuiles carte.`,
    },
    {
      heading: '8. Cookies et consentement',
      body: `Les préférences stockées en localStorage pour le fonctionnement essentiel (session, paramètres) relèvent de l’intérêt du service et ne nécessitent pas de bandeau cookies au sens strict si aucun traceur publicitaire tiers n’est déposé.\n\nSi des outils d’audience (ex. Matomo, Google Analytics) sont ajoutés ultérieurement, un mécanisme de consentement conforme (refus aussi simple qu’acceptation) sera mis en place.`,
    },
    {
      heading: '9. Checklist avant mise en production',
      body: `☐ Compléter les Mentions légales (éditeur, hébergeur, directeur de publication)\n☐ Désigner un contact / DPO si le volume de données l’impose\n☐ Hébergement UE ou garanties de transfert documentées\n☐ Politique de conservation et purge automatique des comptes inactifs\n☐ Procédure de signalement et modération documentée\n☐ Contrats API Spotify et YouTube validés pour l’usage réel\n☐ CGU et Politique de confidentialité acceptées à l’inscription (case à cocher)\n☐ Sauvegardes chiffrées et plan de reprise\n☐ Registre des traitements tenu à jour`,
    },
    {
      heading: '10. Contact',
      body: `Questions relatives à la conformité RGPD : ${LEGAL_PRIVACY_EMAIL}`,
    },
  ],
};
