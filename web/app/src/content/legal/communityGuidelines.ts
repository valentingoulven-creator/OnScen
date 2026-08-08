import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL, LEGAL_COPYRIGHT_EMAIL } from './types';

/** Règles de la communauté OnScen (Community Guidelines) */
export const reglesCommunaute: LegalDocument = {
  title: 'Règles de la communauté',
  updated: '3 août 2026',
  sections: [
    {
      heading: '1. Objectif',
      body: `OnScen est un réseau social autour de la **musique et des arts du spectacle**. Ces règles complètent les Conditions générales d'utilisation (CGU). Elles s'appliquent à tous les contenus et comportements : profils, messages, reels, stories, lives, salons et carte.\n\nEn cas de contradiction, les CGU et la loi prévalent.`,
    },
    {
      heading: '2. Contenus attendus',
      body: `Nous encourageons :\n• performances, répétitions, DJ sets, concerts, sorties et événements musicaux ;\n• partage d'affiches, dates de tournée, découverte d'artistes et de lieux ;\n• échanges respectueux entre mélomanes, créateurs et établissements.\n\nLes contenus doivent avoir un **lien direct** avec la musique ou la scène (voir CGU §2 et §5).`,
    },
    {
      heading: '3. Contenus interdits',
      body: `Sont notamment interdits :\n• contenus illégaux, incitation à la haine, violence, terrorisme, apologie de crimes ;\n• contenus sexuels impliquant des mineurs ou les exploitant (CSAM) — signalement immédiat aux autorités ;\n• harcèlement, menaces, doxxing, revenge porn ;\n• spam, arnaques, phishing, malware ;\n• usurpation d'identité ou fausses informations de localisation malveillantes ;\n• contenus sans lien musical (gaming, IRL quotidien, vlogs non artistiques, etc.) ;\n• promotion de jeux d'argent non régulés, produits illicites ou contenus adultes non conformes à la loi.\n\nL'éditeur peut retirer tout contenu ou suspendre un compte, avec information lorsque la loi l'exige.`,
    },
    {
      heading: "4. Musique et droits d'auteur",
      body: `Ne publiez que des créations dont vous détenez les droits ou une autorisation d'exploitation. Les salons YouTube restent soumis aux conditions Google/YouTube.\n\nPour signaler une utilisation non autorisée de votre œuvre : voir la **Politique droits d'auteur** (Paramètres > Légal) ou ${LEGAL_COPYRIGHT_EMAIL}.`,
    },
    {
      heading: '5. Géolocalisation et sécurité',
      body: `La carte et les fonctionnalités « autour de vous » impliquent des risques si vous partagez trop de détails personnels. Utilisez les réglages de confidentialité (précision, mode discret).\n\nNe encouragez pas le harcèlement ou le stalking via la géolocalisation.`,
    },
    {
      heading: '6. Modération et signalement',
      body: `Utilisez le bouton **Signaler** sur les contenus ou profils. Les signalements graves sont traités en priorité (objectif : sous 24 h pour haine, CSAM, terrorisme ; sous 7 jours ouvrés pour les autres cas, sauf force majeure).\n\nPour contester une décision de modération : voir **Modération et recours**.`,
    },
    {
      heading: '7. Sanctions',
      body: `Selon la gravité et la récidive : avertissement, masquage de contenu, restriction de fonctionnalités (live, messages), suspension temporaire ou suppression de compte.\n\nLes manquements graves ou illégaux peuvent être signalés aux autorités compétentes.`,
    },
    {
      heading: '8. Contact',
      body: `Questions sur ces règles : ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};
