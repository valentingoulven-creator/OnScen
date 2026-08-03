import type { LegalDocument } from './types';
import { LEGAL_CONTACT_EMAIL } from './types';

/** Contenus sponsorisés et partenariats rémunérés (Branded Content) */
export const contenusSponsorisesPartenariats: LegalDocument = {
  title: 'Contenus sponsorisés et partenariats rémunérés',
  updated: '3 août 2026',
  sections: [
    {
      heading: "1. Champ d'application",
      body: `Ce document s'applique lorsque vous publiez sur Soundy un contenu **réalisé dans le cadre d'une relation commerciale** : marque, établissement, label, billetterie, produit ou service, en échange d'une **rémunération, avantage ou contrepartie** (argent, produits, invitation, visibilité contractuelle, etc.).\n\nIl complète les CGU et la **Politique publicitaire Soundy**.`,
    },
    {
      heading: '2. Obligation de transparence',
      body: `Vous devez **ne pas induire en erreur** les utilisateurs sur la nature commerciale du contenu.\n\n**Règle Soundy :** indiquez clairement dans le texte ou la description du contenu (reel, story, post, live) une mention du type :\n• « Partenariat rémunéré avec [marque / lieu] »\n• « Contenu sponsorisé »\n• « En collaboration avec [annonceur] »\n\nCette obligation s'ajoute aux règles **ARPP**, **Code de la consommation** (pratiques commerciales) et **DSA** (transparence des communications commerciales) lorsqu'elles s'appliquent.`,
    },
    {
      heading: '3. Campagnes gérées par Soundy',
      body: `Lorsqu'une campagne est vendue et paramétrée par Soundy (sponsoring natif : fil, carte, reel, etc.), le badge **« Sponsorisé »** est affiché par la plateforme. Vous n'avez pas à dupliquer la mention sur ces emplacements techniques.\n\nPour tout **autre** contenu organique faisant la promotion d'un annonceur, vous restez responsable de la mention de partenariat (§2).`,
    },
    {
      heading: '4. Contenu autorisé et interdit',
      body: `Le contenu sponsorisé doit respecter les **Règles de la communauté** et les CGU.\n\nSont notamment interdits sans validation préalable Soundy :\n• alcool/tabac/jeux d'argent selon restrictions légales et ARPP ;\n• allégations santé ou financières non vérifiables ;\n• contenu trompeur sur billetterie, prix ou disponibilité ;\n• promotion de concurrents directe visant à contourner une campagne Soundy contractuelle.\n\nSoundy peut refuser ou retirer un contenu sponsorisé non conforme.`,
    },
    {
      heading: '5. Responsabilité',
      body: `Vous garantissez disposer des autorisations nécessaires (marques, musique, droit à l'image des personnes filmées). Vous êtes responsable des déclarations faites dans le contenu.\n\nL'annonceur et le créateur restent responsables de la conformité de leurs pratiques ; Soundy agit comme intermédiaire technique sauf campagne vendue directement par Soundy (voir contrat annonceur).`,
    },
    {
      heading: '6. Contact',
      body: `Campagne sponsor via Soundy : ${LEGAL_CONTACT_EMAIL}.\n\nQuestion sur l'étiquetage d'un partenariat : ${LEGAL_CONTACT_EMAIL}.`,
    },
  ],
};
