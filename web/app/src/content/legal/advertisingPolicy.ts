import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL } from './types';

/** Politique publicitaire OnScen (utilisateurs et annonceurs) */
export const politiquePublicitaire: LegalDocument = {
  title: 'Politique publicitaire',
  updated: '3 août 2026',
  sections: [
    {
      heading: '1. Publicités sur OnScen',
      body: `OnScen peut afficher des **communications commerciales** (sponsoring natif) dans l'application : fil d'actualité, carte, reels, onglet Musique, etc.\n\nCes messages sont clairement identifiés par le libellé **« Sponsorisé »** (ou équivalent visible), conformément au **Règlement (UE) 2022/2065 (DSA)** et aux bonnes pratiques de transparence.`,
    },
    {
      heading: '2. Différence avec le contenu organique',
      body: `| | Contenu organique | Publicité OnScen |\n|---|-------------------|------------------|\n| Auteur | Utilisateur / créateur | Annonceur via campagne OnScen |\n| Badge | Non | **Sponsorisé** |\n| Ciblage | Algorithme social | Zone géographique et emplacement contractuels |\n| Paiement | Gratuit (hors options premium) | Campagne payante (B2B) |\n\nLes **partenariés rémunérés** publiés par des créateurs dans leur propre contenu relèvent de la politique **Contenus sponsorisés et partenariats rémunérés**.`,
    },
    {
      heading: '3. Annonceurs et formats',
      body: `Les campagnes sont proposées en **forfait par emplacement et par semaine** (phase de lancement), sans garantie de volume de vues. Emplacements types : fil d'actualité, bandeau carte, icône Sponso sur la carte, reel sponsorisé, onglet Musique.\n\nLes conditions commerciales (devis, contrat) sont transmises aux annonceurs professionnels ; elles ne remplacent pas les présentes règles de transparence vis-à-vis des utilisateurs.`,
    },
    {
      heading: '4. Contenus publicitaires refusés',
      body: `OnScen peut refuser ou retirer une publicité notamment si elle :\n• viole la loi ou les Règles de la communauté ;\n• est trompeuse, diffamatoire ou choquante ;\n• concerne des produits ou services interdits (contenu adulte non légal, jeux d'argent non régulés, etc.) ;\n• ne respecte pas les règles sectorielles applicables (ARPP, alcool, santé).\n\nLes créations sont validées avant diffusion lorsque la campagne est gérée par OnScen.`,
    },
    {
      heading: '5. Données et mesure',
      body: `Les campagnes peuvent faire l'objet de mesures agrégées (impressions, clics) à des fins de reporting annonceur. OnScen **ne vend pas** de données nominatives d'utilisateurs aux annonceurs.\n\nVoir la Politique de confidentialité pour les bases légales et vos droits.`,
    },
    {
      heading: '6. Devenir annonceur',
      body: `Professionnels (bars, salles, labels, marques) : ${LEGAL_CONTACT_EMAIL} — objet « Sponsoring OnScen ».`,
    },
  ],
};
