import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL, LEGAL_PRIVACY_EMAIL } from './types';

/** Modération, décisions motivées et recours (DSA) */
export const moderationEtRecours: LegalDocument = {
  title: 'Modération et recours',
  updated: '3 août 2026',
  sections: [
    {
      heading: '1. Principes',
      body: `OnScen modère les contenus et comptes signalés ou détectés comme contraires aux **Règles de la communauté**, aux **CGU** ou à la loi.\n\nOnScen n'est pas tenu à une surveillance générale et permanente de tous les contenus (LCEN), mais traite les signalements et peut agir de sa propre initiative en cas de risque grave.`,
    },
    {
      heading: '2. Signalement',
      body: `• Bouton **Signaler** sur les contenus (messages, reels, profils, etc.).\n• E-mail : ${LEGAL_CONTACT_EMAIL} (précisez URL, capture, nature du contenu).\n• Point de contact DSA : voir Mentions légales.\n\n**Délais indicatifs de traitement :**\n• contenus graves (haine, CSAM, terrorisme, menaces) : objectif **24 h** ;\n• autres signalements : objectif **7 jours ouvrés**.\n\nLes signalements de bonne foi ne entraînent pas de sanction contre le signaleur.`,
    },
    {
      heading: '3. Mesures possibles',
      body: `Avertissement · masquage ou suppression de contenu · restriction de fonctionnalités · suspension temporaire · suppression de compte · signalement aux autorités si obligation légale.\n\nPour les **lives** et **chats**, les hôtes peuvent modérer localement (mute, ban) ; l'éditeur peut intervenir en cas d'abus.`,
    },
    {
      heading: '4. Décision motivée (DSA)',
      body: `Lorsque OnScen prend une **décision significative** de restriction ou de suspension (notamment suppression de contenu ou de compte pour violation des règles), nous nous efforçons d'informer l'utilisateur concerné des **motifs principaux** et des **voies de recours**, par notification in-app ou par e-mail associé au compte, sauf interdiction légale ou risque pour la sécurité.\n\nLes motifs peuvent inclure : type de contenu, règle enfreinte (communauté / CGU), gravité, récidive.`,
    },
    {
      heading: '5. Recours interne',
      body: `Si vous contestez une décision de modération :\n1. Répondez à la notification reçue ou écrivez à **${LEGAL_CONTACT_EMAIL}** avec l'objet « Recours modération ».\n2. Indiquez votre identifiant / pseudo, la date, le contenu ou la sanction concernée, et vos arguments.\n3. OnScen réexamine la demande dans un délai indicatif de **14 jours ouvrés** et vous communique la décision.\n\nUn recours ne garantit pas la réactivation du contenu ou du compte si la violation est confirmée.`,
    },
    {
      heading: '6. Médiation et autorités',
      body: `Pour les litiges de consommation relatifs au Service, les CGU et les Mentions légales (médiateur, ODR) s'appliquent.\n\nVous pouvez signaler un contenu illicite aux autorités compétentes (ex. PHAROS pour contenus illicites en ligne en France).\n\nPour l'exercice de vos droits sur vos données personnelles : ${LEGAL_PRIVACY_EMAIL}.`,
    },
  ],
};
