import type { CeoFounderContext } from './ceoFounderContext';
import type { CeoDataGap } from './ceoFounderContext';
import { getCeoStrategicKnowledge } from './ceoStrategicKnowledge';
import { AI_AGENTS } from './agents';

export type AiTeamRecPriority = 'critical' | 'high' | 'medium' | 'low' | 'not_now';

export interface AiTeamRecommendation {
  agentId: string;
  name: string;
  suggestedEmoji: string;
  priority: AiTeamRecPriority;
  urgencyScore: number;
  alreadyExists: boolean;
  /** Résumé une ligne pour l'admin UI */
  headline: string;
  /** Pourquoi recruter MAINTENANT — preuves [FACT] */
  whyNow: string[];
  /** Limites du CEO IA seul sur ce domaine */
  whyCeoAloneIsInsufficient: string[];
  /** Bénéfices concrets pour Soundy / fondateur */
  whatYouGain: string[];
  /** Coût de ne PAS recruter (opportunité, risque, temps) */
  costOfWaiting: string[];
  /** Livrables attendus du nouvel agent (hebdo / mensuel) */
  expectedDeliverables: string[];
  /** Métriques de succès à 30 jours */
  successMetrics30d: string[];
  /** Prérequis avant création */
  prerequisites: string[];
  /** Quand NE PAS recruter */
  whenNotToHire: string[];
  /** Coût API estimé */
  estimatedApiCostEurMonth: string;
  /** Première semaine — 3 actions concrètes */
  firstWeekActions: string[];
  /** Questions types que l'agent répondrait */
  exampleQuestions: string[];
}

export interface AiTeamRecruitmentAnalysis {
  philosophy: string;
  currentRoster: { id: string; name: string; emoji: string }[];
  missingRolesCount: number;
  topRecommendation: string | null;
  summaryForFounder: string;
  recommendations: AiTeamRecommendation[];
}

interface LiveSignals {
  totalUsers: number;
  activeSponsorCampaigns: number;
  totalSponsors: number;
  legalPublisherComplete: boolean;
  simulationDonations: boolean;
  creatorSubscriptionsActive: number;
  pendingReports: number;
  openSupportTickets: number;
  activeLives: number;
  totalSalons: number;
  cloudflareCostEur: number | null;
  redisConfigured: boolean;
  dataGaps: CeoDataGap[];
}

function n(v: number | null | undefined, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, Math.round(s)));
}

function priorityFromScore(score: number, forceCritical = false): AiTeamRecPriority {
  if (forceCritical || score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'not_now';
}

function existingAgentIds(): Set<string> {
  return new Set(AI_AGENTS.map((a) => a.id));
}

function buildSalesRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const signed = n(founder?.goToMarket?.founderSponsorsSigned, live.activeSponsorCampaigns);
  const target = n(founder?.goToMarket?.founderSponsorsTarget, 2);
  const pipeline = n(founder?.financials?.sponsorPipelineEur);
  const gap = Math.max(0, target - signed);
  const mrr = n(founder?.financials?.revenueActualMrrEur);

  let score = 0;
  if (live.activeSponsorCampaigns === 0) score += 35;
  if (gap > 0) score += gap * 20;
  if (pipeline === 0) score += 15;
  if (mrr === 0) score += 15;
  score = clampScore(score);

  const whyNow: string[] = [
    `[FACT] Sponsors actifs en prod : ${live.activeSponsorCampaigns} (objectif fondateur : ${target}).`,
    `[FACT] 4 emplacements sponsors natifs déjà en prod — le produit est prêt à monétiser, pas le pipeline commercial.`,
    `[FACT] Modèle économique Soundy : sponsors = 45–55 % revenu cible M24 (commun/docs/Soundy-Pitch-Deck.md).`,
  ];
  if (pipeline === 0) {
    whyNow.push('[FACT] Pipeline sponsor déclaré à 0 € — aucune négo formalisée.');
  }
  if (signed < target) {
    whyNow.push(`[FACT] Écart objectif fondateur : ${gap} contrat(s) fondateur manquant(s).`);
  }

  return {
    agentId: 'sales',
    name: 'Sales / Sponsors IA',
    suggestedEmoji: '🤝',
    priority: priorityFromScore(score, gap >= 2 && live.activeSponsorCampaigns === 0),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('sales'),
    headline: `${signed}/${target} sponsors · pipeline ${pipeline} € — priorité revenus B2B`,
    whyNow,
    whyCeoAloneIsInsufficient: [
      'Le CEO IA peut recommander des packages et pricing, mais ne peut pas exécuter une prospection structurée (listes marques/lieux, séquences email, relances, scripts d’appel).',
      'La vente sponsor locale (bars, festivals, marques lifestyle) demande un playbook récurrent que le CEO dilue dans le brief général.',
      'Sans agent Sales dédié, chaque question « quel script pour une brasserie parisienne ? » consomme un brief CEO complet (~0,05–0,15 €) au lieu d’un chat ciblé.',
    ],
    whatYouGain: [
      'Playbooks outreach par segment (lieu musical, marque lifestyle, takeover ville).',
      'Grilles tarifaires contextualisées (map_banner 800–2 000 €, city_takeover 5–15 k€) avec argumentaire ROI.',
      'Pipeline structuré : cibles → message → relance → objection → closing — drafts prêts pour validation fondateur.',
      'Accélération vers les 2 sponsors fondateurs Q2 2026 sans sortir le fondateur du produit.',
    ],
    costOfWaiting: [
      'Chaque mois sans sponsor = ~800–4 000 €/mois de revenu non capté (pack feed minimum).',
      'Crédibilité GTM : difficile de recruter des créateurs pilotes sans preuve de marques partenaires.',
      'Le fondateur reste seul sur dev + legal + vente — risque de sous-investir la vente.',
    ],
    expectedDeliverables: [
      'Liste hebdo de 10 prospects qualifiés (Paris d’abord) avec angle d’approche.',
      '2 scripts outreach + 1 script relance par segment.',
      'Fiche objection/réponse (budget, « on a déjà Instagram », durée engagement).',
      'Draft contrat / email de proposition aligné PLAN-SPONSORING-PAYANT.md.',
    ],
    successMetrics30d: [
      '≥ 20 marques/lieux contactés (drafts validés par fondateur).',
      '≥ 5 réponses ou RDV obtenus.',
      '≥ 1 proposition commerciale formalisée.',
      'Objectif stretch : 1 contrat fondateur signé.',
    ],
    prerequisites: [
      'Grilles docs/PLAN-SPONSORING-PAYANT.md lues et assumées.',
      'Fondateur disponible pour envoyer les messages (CEO/Sales ne contacte pas seul).',
      'Adresse pro LCEN idéalement complétée (crédibilité marques).',
    ],
    whenNotToHire: [
      'Si ≥ 2 sponsors récurrents actifs et pipeline > 10 k€ — le fondateur suffit en exécution.',
      'Si le produit sponsor n’est pas stable (bugs affichage) — prioriser Dev Agent.',
    ],
    estimatedApiCostEurMonth: '3–15 € (usage modéré, ~20–40 échanges/mois)',
    firstWeekActions: [
      'Segmenter 30 cibles Paris (bars live, marques audio, lieux culturels).',
      'Rédiger script fondateur « 2 sponsors pilotes » + offre map_banner -20 % lancement.',
      'Caler 1 KPI : RDV découverte / semaine.',
    ],
    exampleQuestions: [
      'Quel script pour une brasserie avec scène live à Oberkampf ?',
      'Comment répondre à « votre audience est trop petite » ?',
      'Quel package pousser pour un festival électro à Montpellier ?',
    ],
  };
}

function buildCommunityRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const active = n(founder?.goToMarket?.creatorPilotsActive);
  const target = n(founder?.goToMarket?.creatorPilotsTarget, 50);
  const ratio = target > 0 ? active / target : 0;
  const northStar = founder?.strategy?.northStarMetric ?? 'Salons actifs par semaine';
  const northStarVal = n(founder?.strategy?.northStarCurrentValue);

  let score = 0;
  if (active <= 5) score += 40;
  if (ratio < 0.2) score += 25;
  if (live.totalSalons < 10) score += 15;
  if (northStarVal === 0) score += 10;
  score = clampScore(score);

  const whyNow: string[] = [
    `[FACT] Créateurs pilotes actifs : ${active} / cible ${target} (${Math.round(ratio * 100)} %).`,
    `[FACT] Salons totaux plateforme : ${live.totalSalons} · lives actifs : ${live.activeLives}.`,
    `[FACT] North star déclarée : « ${northStar} » = ${northStarVal}.`,
    `[FACT] GTM Q2 : densité Paris + 30–50 pilotes (ceo-founder-context / pitch deck).`,
  ];

  return {
    agentId: 'community',
    name: 'Community / Creators IA',
    suggestedEmoji: '🎤',
    priority: priorityFromScore(score, active <= 1),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('community'),
    headline: `${active}/${target} créateurs pilotes · north star « ${northStar} » = ${northStarVal}`,
    whyNow,
    whyCeoAloneIsInsufficient: [
      'Le CEO arbitre la stratégie globale ; l’activation créateur hebdo (DM templates, rituels salon, feedback loop) demande un rôle opérationnel dédié.',
      'Avec 1 créateur pilote, chaque point de friction produit doit être remonté et transformé en playbook — trop granulaire pour un brief CEO mensuel.',
      'La rétention créateur (onboarding, première semaine, première salon) est un métier distinct de la stratégie financière.',
    ],
    whatYouGain: [
      'Playbook onboarding créateur : J0 → J7 → premier salon actif.',
      'Scripts activation (inviter fans, créer salon, lancer live test).',
      'Synthèse feedback hebdo créateurs → backlog priorisé pour Dev Agent.',
      'Densité Paris : objectif salons actifs/semaine traçable.',
    ],
    costOfWaiting: [
      'Sans masse critique créateurs, la carte et les reels restent vides — effet réseau retardé.',
      'Un seul pilote = point de défaillance ; pas de preuve de rétention D30.',
      'Le fondateur ne scale pas le relationnel créateur manuellement au-delà de ~5 profils.',
    ],
    expectedDeliverables: [
      'Checklist onboarding créateur (1 page).',
      '3 rituels hebdo (ex. « salon du jeudi », « live découverte »).',
      'Template message invitation fans / collabs.',
      'Rapport friction produit hebdo (top 3 blockers).',
    ],
    successMetrics30d: [
      '≥ 3 créateurs pilotes actifs (objectif intermédiaire avant 50).',
      '≥ 5 salons / semaine sur Paris.',
      '≥ 1 live > 10 min / semaine.',
      'NPS ou feedback qualitatif documenté.',
    ],
    prerequisites: [
      'Produit stable enough (auth, salon, live) — sinon coupler avec Dev Agent.',
      'Fondateur identifie les 5–10 premiers profils cibles.',
    ],
    whenNotToHire: [
      'Si ≥ 15 créateurs actifs et salons/semaine > 20 — CEO + fondateur suffisent.',
      'Si le produit live/salon est cassé — fix technique d’abord.',
    ],
    estimatedApiCostEurMonth: '2–10 €',
    firstWeekActions: [
      'Documenter parcours du créateur pilote actuel (succès + blocages).',
      'Proposer kit « lancement salon » en 3 étapes.',
      'Définir KPI activation : % pilotes avec ≥ 1 salon en 7 jours.',
    ],
    exampleQuestions: [
      'Comment relancer un créateur inactif depuis 2 semaines ?',
      'Quel script DM pour inviter des fans au premier salon ?',
      'Quels rituels pour densifier Paris avant Lyon ?',
    ],
  };
}

function buildLegalRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const legalGaps = live.dataGaps.filter((g) => g.category === 'legal');
  const criticalLegal = legalGaps.filter((g) => g.severity === 'critical').length;
  const addressEmpty = !live.legalPublisherComplete;

  let score = 0;
  if (!live.legalPublisherComplete) score += 45;
  score += criticalLegal * 15;
  score += legalGaps.length * 5;
  score = clampScore(score);

  return {
    agentId: 'legal',
    name: 'Legal IA',
    suggestedEmoji: '⚖️',
    priority: priorityFromScore(score, !live.legalPublisherComplete),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('legal'),
    headline: addressEmpty
      ? 'LCEN / adresse pro incomplète — risque conformité & stores'
      : `${legalGaps.length} lacune(s) legal dans dataGaps`,
    whyNow: [
      `[FACT] legalPublisherComplete = ${live.legalPublisherComplete}.`,
      ...legalGaps.slice(0, 4).map((g) => `[FACT] ${g.id} (${g.severity}) : ${g.whyItMatters}`),
      '[FACT] TODO-MANUAL C6 LCEN · docs/RENDEZ-VOUS-AVOCAT.md — RDV avocat prévu.',
      '[FACT] Stores mobile : IAP Apple/Google + Sign in with Apple = conformité obligatoire.',
    ],
    whyCeoAloneIsInsufficient: [
      'Le CEO couvre le risque business ; le Legal IA produit des checklists actionnables, drafts CGU/mentions, briefs avocat structurés.',
      'La conformité LCEN/RGPD/IAP est dense — mélanger avec stratégie sponsor dilue l’attention et retarde la mise en conformité.',
      'Chaque question juridique ponctuelle (domiciliation, DPO, cookies) ne devrait pas relancer un brief CEO complet.',
    ],
    whatYouGain: [
      'Checklist LCEN complète avant prod stricte et avant stores.',
      'Draft sections mentions légales / politique confidentialité alignées produit réel.',
      'Brief avocat pré-rempli (questions, docs, risques) — gain de temps RDV.',
      'Matrice risques : IAP, OAuth Apple, modération, donations, âge minimum.',
    ],
    costOfWaiting: [
      'Blocage re-déploiement si boot strict LCEN réactivé sans adresse pro.',
      'Rejet App Store / Play Store si IAP ou Sign in with Apple non conformes.',
      'Exposition RGPD / LCEN — amendes + crédibilité sponsors/investisseurs.',
      'Le fondateur reporte le RDV avocat faute de dossier structuré.',
    ],
    expectedDeliverables: [
      'Checklist conformité Soundy (LCEN, RGPD, cookies, mineurs).',
      'Gap analysis vs TODO-MANUAL C1/C3/C6/C7.',
      'Draft paragraphes mentions légales (validation avocat requise).',
      'Ordre du jour RDV avocat + questions prioritaires.',
    ],
    successMetrics30d: [
      'Adresse pro LCEN renseignée et déployée.',
      '0 lacune legal critical dans dataGaps.',
      'Brief avocat livré avant RDV.',
      'Roadmap IAP / Apple Sign-In priorisée avec Dev Agent.',
    ],
    prerequisites: [
      'Infos société (SIREN, forme juridique) dans ceo-founder-context.json.',
      'Aucune publication légale sans validation humain + avocat.',
    ],
    whenNotToHire: [
      'Si LCEN complet + avocat mandaté + roadmap stores validée — maintenance légère seulement.',
    ],
    estimatedApiCostEurMonth: '1–8 € (pics avant RDV avocat ou soumission stores)',
    firstWeekActions: [
      'Auditer legal-publisher.json vs domiciliation réelle.',
      'Lister 10 points à valider avec avocat (IAP, DPO, ACRCloud, modération).',
      'Proposer texte type adresse pro + publisher pour validation.',
    ],
    exampleQuestions: [
      'Quelles mentions LCEN manquent exactement ?',
      'Quel ordre du jour pour mon RDV avocat ?',
      'IAP vs Stripe web : quelles règles Apple pour Soundy ?',
    ],
  };
}

function buildCmoRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const active = n(founder?.goToMarket?.creatorPilotsActive);
  const city = founder?.strategy?.primaryCity ?? 'Paris';
  const users = live.totalUsers;

  let score = 0;
  if (users < 500) score += 20;
  if (active < 10) score += 25;
  if (users < 100) score += 20;
  score = clampScore(score);

  return {
    agentId: 'cmo',
    name: 'CMO IA',
    suggestedEmoji: '📣',
    priority: priorityFromScore(score),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('cmo'),
    headline: `Acquisition ${city} · ${users} users · ${active} pilotes — densité réseau`,
    whyNow: [
      `[FACT] Utilisateurs totaux : ${users}.`,
      `[FACT] Ville pivot : ${city} · cibles : ${(founder?.strategy?.targetCities ?? ['Paris']).join(', ')}.`,
      `[FACT] Créateurs pilotes : ${active} — effet réseau non amorcé.`,
      '[FACT] Produit : reels + carte + salons — le GTM doit expliquer la différenciation vs Instagram/Discord.',
    ],
    whyCeoAloneIsInsufficient: [
      'Le CEO fixe la north star ; le CMO produit les campagnes, hooks reels, calendrier éditorial, partenariats micro-influence.',
      'L’acquisition créateur à Paris demande itération créative hebdo (contenu, UGC, loops virales) — hors scope brief CEO.',
    ],
    whatYouGain: [
      'Plan acquisition 30 jours Paris (créateurs + fans).',
      'Hooks reels / stories pour montrer salons sync + carte.',
      'KPIs acquisition : CAC créateur, taux invitation, densité quartier.',
      'Positionnement vs Shotgun/Discord/Instagram — messaging testé.',
    ],
    costOfWaiting: [
      'Produit riche mais invisible — concurrence capte l’attention créateurs FR.',
      'Sans boucle acquisition, les features reels/carte ne génèrent pas de croissance organique.',
    ],
    expectedDeliverables: [
      'Calendrier contenu 4 semaines (founder + pilotes).',
      '3 angles messaging + landing one-liner A/B.',
      'Liste 20 micro-créateurs Paris à approcher.',
      'Playbook parrainage fan → salon.',
    ],
    successMetrics30d: [
      '≥ +10 créateurs contactés via campagne.',
      '≥ 1 reel/salon viral interne (benchmark vues).',
      'Densité mesurable sur 1 arrondissement / quartier test.',
    ],
    prerequisites: ['Au moins 1 créateur pilote actif pour preuve sociale.'],
    whenNotToHire: [
      'Si Community IA pas encore déployé — Community avant CMO (0 pilote = rien à marketer).',
      'Si Sales IA prioritaire et fondateur solo — max 1–2 agents nouveaux/mois.',
    ],
    estimatedApiCostEurMonth: '3–12 €',
    firstWeekActions: [
      'Définir ICP créateur Paris (genre, taille audience, lieu).',
      'Rédiger 3 scripts reels « pourquoi Soundy vs Instagram ».',
      'Choisir 1 quartier test pour densité carte.',
    ],
    exampleQuestions: [
      'Quel hook reel pour montrer un salon sync ?',
      'Comment lancer Soundy à Paris avec 0 budget ads ?',
      'Quel message pour un DJ 5k followers ?',
    ],
  };
}

function buildCfoRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const cash = n(founder?.financials?.cashOnHandEur);
  const burn = n(founder?.financials?.monthlyBurnEur, 85);
  const runway = founder?.financials?.personalRunwayMonths ?? (burn > 0 ? cash / burn : null);
  const mrr = n(founder?.financials?.revenueActualMrrEur);
  const fundraising = founder?.financials?.fundraisingStatus ?? '';

  let score = 0;
  if (runway != null && runway < 24) score += 20;
  if (mrr === 0 && live.activeSponsorCampaigns === 0) score += 15;
  if (/levée|fundraising|invest/i.test(fundraising)) score += 30;
  if (live.simulationDonations) score += 10;
  score = clampScore(score);

  return {
    agentId: 'cfo',
    name: 'CFO IA',
    suggestedEmoji: '📊',
    priority: priorityFromScore(score, runway != null && runway < 12),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('cfo'),
    headline: runway != null
      ? `Runway ~${Math.round(runway)} mois · MRR ${mrr} € · modélisation M12/M24`
      : 'Finances fondateur incomplètes — scénarios à structurer',
    whyNow: [
      runway != null
        ? `[FACT] Trésorerie ${cash} € · burn ~${burn} €/mois · runway ~${Math.round(runway)} mois.`
        : '[FACT] Runway non calculable — cash ou burn manquant dans founder context.',
      `[FACT] MRR réel : ${mrr} € · donations simulation : ${live.simulationDonations}.`,
      `[FACT] Sponsors actifs : ${live.activeSponsorCampaigns}.`,
      '[FACT] Pitch deck contient scénarios M12/M24 — à recaler avec données live.',
    ],
    whyCeoAloneIsInsufficient: [
      'Le CEO intègre les finances au brief ; le CFO IA modélise des scénarios interactifs (sensibilité sponsors, lives, tips, Soundy+).',
      'Unit economics lives (Cloudflare minutes + LiveKit) demandent des calculs récurrents que le CEO résume trop.',
    ],
    whatYouGain: [
      'Tableau 3 scénarios (pessimiste / base / optimiste) M6–M24.',
      'Seuil break-even sponsors + créateurs.',
      'Alertes burn si Cloudflare/LiveKit dérape.',
      'Support dossier levée si fundraising [HYP].',
    ],
    costOfWaiting: [
      'Décisions pricing sponsor ou Soundy+ sans modèle → sous-pricing ou sur-promesse.',
      'Surprise coûts variables lives si trafic décolle sans suivi.',
    ],
    expectedDeliverables: [
      'Modèle unit economics (1 page + hypothèses).',
      'Dashboard KPIs financiers hebdo (template).',
      'Note runway + triggers recrutement / levée.',
    ],
    successMetrics30d: [
      'Modèle M12 validé par fondateur.',
      '1 alerte coût variable configurée (CF/LiveKit).',
      'Pricing sponsor cohérent avec marge cible.',
    ],
    prerequisites: ['ceo-founder-context.json financials à jour.'],
    whenNotToHire: [
      'Runway > 24 mois + 0 levée + revenus stables — CEO suffit pour vue macro.',
      'Priorité absolue Sales/Legal — CFO peut attendre 30–60 j.',
    ],
    estimatedApiCostEurMonth: '2–10 €',
    firstWeekActions: [
      'Recaler burn réel (infra + IA + tools).',
      'Scénario « 2 sponsors + 10 pilotes » vs « 0 sponsor ».',
      'Identifier levier #1 marge (sponsor vs tips vs Soundy+).',
    ],
    exampleQuestions: [
      'Quel MRR à M12 avec 2 sponsors et 30 pilotes ?',
      'À combien de minutes live/mois Cloudflare devient critique ?',
      'Break-even avec burn 85 €/mois ?',
    ],
  };
}

function buildOpsRec(founder: CeoFounderContext | null, live: LiveSignals): AiTeamRecommendation {
  const cfCost = live.cloudflareCostEur ?? 0;

  let score = 0;
  if (!live.redisConfigured) score += 15;
  if (cfCost > 30) score += 25;
  if (live.pendingReports > 5) score += 10;
  if (live.openSupportTickets > 3) score += 10;
  score = clampScore(score);

  return {
    agentId: 'ops',
    name: 'Ops / Infra IA',
    suggestedEmoji: '🛠️',
    priority: priorityFromScore(score, cfCost > 50),
    urgencyScore: score,
    alreadyExists: existingAgentIds().has('ops'),
    headline: `Stack scale · CF ~${cfCost || '?'} € · Redis ${live.redisConfigured ? 'OK' : 'off'}`,
    whyNow: [
      `[FACT] Redis : ${live.redisConfigured ? 'configuré' : 'non configuré'}.`,
      cfCost > 0
        ? `[FACT] Coût Cloudflare estimé : ~${cfCost} €.`
        : '[FACT] Coût Cloudflare non disponible — surveiller avant scale lives.',
      `[FACT] Signalements ouverts : ${live.pendingReports} · tickets support : ${live.openSupportTickets}.`,
      '[FACT] Phase 0 faite (Redis, PM2 cluster, S3) — Phase 1 PostGIS/BullMQ à planifier.',
    ],
    whyCeoAloneIsInsufficient: [
      'Le Dev Agent code ; l’Ops IA suit runbooks, monitoring, incidents, arbitrage infra/coût sans proposer des refactors lourds.',
      'Incidents prod + deploy + health checks demandent réactivité distincte de la roadmap produit.',
    ],
    whatYouGain: [
      'Runbook incident (health, PM2, Redis, PG).',
      'Veille coûts CF/LiveKit + alertes seuils.',
      'Checklist pre-deploy / post-deploy.',
      'Priorisation Phase 1 stack vs burn.',
    ],
    costOfWaiting: [
      'Incident prod non documenté → downtime sponsors/lives.',
      'Dépassement Cloudflare non détecté → burn surprise.',
    ],
    expectedDeliverables: [
      'Rapport santé infra hebdo.',
      'Playbook rollback deploy.',
      'Matrice risques scale (nearby O(n), socket cluster).',
    ],
    successMetrics30d: [
      '0 incident non documenté.',
      'Seuil alerte CF configuré.',
      'Runbook deploy testé en staging.',
    ],
    prerequisites: ['Accès SSH / health endpoints documentés (infra-access.mdc).'],
    whenNotToHire: [
      'Trafic faible + Dev Agent déjà utilisé pour ops — redondance.',
      'Priorité business Sales/Community plus urgente.',
    ],
    estimatedApiCostEurMonth: '1–6 €',
    firstWeekActions: [
      'Auditer health prod + staging.',
      'Documenter procédure deploy_zero_downtime.',
      'Lister signaux Phase 1 (PostGIS, Sentry).',
    ],
    exampleQuestions: [
      'Que faire si Redis tombe en prod ?',
      'Quand passer Phase 1 PostGIS ?',
      'Coût live si 100 h/mois streaming ?',
    ],
  };
}

/** Analyse complète recrutement équipe IA — scores + raisons pour le fondateur. */
export function computeAiTeamRecommendations(
  founder: CeoFounderContext | null,
  live: LiveSignals
): AiTeamRecruitmentAnalysis {
  const knowledge = getCeoStrategicKnowledge();
  const builders = [
    buildSalesRec,
    buildCommunityRec,
    buildLegalRec,
    buildCmoRec,
    buildCfoRec,
    buildOpsRec,
  ];

  const recommendations = builders
    .map((fn) => fn(founder, live))
    .filter((r) => !r.alreadyExists)
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

  const actionable = recommendations.filter((r) => r.priority !== 'not_now');
  const top = actionable[0] ?? recommendations[0] ?? null;

  const missingRolesCount = actionable.length;
  const summaryForFounder = top
    ? `Recommandation #1 : **${top.name}** (score ${top.urgencyScore}/100, priorité ${top.priority}) — ${top.headline}. Raisons : ${top.whyNow.slice(0, 2).join(' ')}`
    : 'Aucun recrutement agent urgent — roster CEO + Dev suffit pour ce cycle.';

  return {
    philosophy: knowledge.aiTeam.philosophy,
    currentRoster: AI_AGENTS.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji })),
    missingRolesCount,
    topRecommendation: top?.agentId ?? null,
    summaryForFounder,
    recommendations,
  };
}
