import fs from 'fs';
import path from 'path';
import { getAppRoot, getMsdevEnvPath } from '../../paths';

/** Données stratégiques fournies par le fondateur (hors Git — voir .example). */
export interface CeoFounderContext {
  updatedAt?: string;
  company?: {
    legalName?: string;
    legalForm?: string;
    siren?: string;
    professionalAddress?: string;
    foundingDate?: string;
    pitchOneLiner?: string;
  };
  financials?: {
    monthlyBurnEur?: number | null;
    cashOnHandEur?: number | null;
    personalRunwayMonths?: number | null;
    revenueActualMrrEur?: number | null;
    sponsorContractsSigned?: number | null;
    sponsorPipelineEur?: number | null;
    fundraisingStatus?: string;
  };
  strategy?: {
    primaryCity?: string;
    targetCities?: string[];
    northStarMetric?: string;
    northStarCurrentValue?: number | null;
    currentFocusQuarter?: string;
    ambitionHorizon?: string;
    competitorsToWatch?: string[];
  };
  goToMarket?: {
    creatorPilotsTarget?: number;
    creatorPilotsActive?: number | null;
    founderSponsorsTarget?: number;
    founderSponsorsSigned?: number | null;
    activePartnerships?: string[];
  };
  team?: {
    headcount?: number;
    rolesCovered?: string[];
    hiringNext?: string[];
  };
  founderNotes?: string;
}

export interface CeoDataGap {
  id: string;
  category: 'legal' | 'financial' | 'strategy' | 'gtm' | 'team' | 'product';
  severity: 'critical' | 'high' | 'medium';
  question: string;
  whyItMatters: string;
  suggestedField: string;
}

export function getCeoFounderContextPaths(): string[] {
  const msdevDir = path.dirname(getMsdevEnvPath());
  return [
    path.join(getAppRoot(), 'ceo-founder-context.json'),
    path.join(msdevDir, 'ceo-founder-context.json'),
    '/opt/soundy/ceo-founder-context.json',
    '/opt/soundly/ceo-founder-context.json',
  ];
}

export function loadCeoFounderContext(): {
  context: CeoFounderContext | null;
  loadedFrom: string | null;
} {
  for (const file of getCeoFounderContextPaths()) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as CeoFounderContext;
      return { context: parsed, loadedFrom: file };
    } catch {
      continue;
    }
  }
  return { context: null, loadedFrom: null };
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    return !t || /compl|renseigner|acompleter|à compléter/i.test(t);
  }
  if (typeof v === 'number') return !Number.isFinite(v);
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Lacunes critiques pour un CEO IA complet (style Tang Yu). */
export function computeCeoDataGaps(
  founder: CeoFounderContext | null,
  live: {
    legalPublisherComplete: boolean;
    totalUsers: number;
    simulationDonations: boolean;
  }
): CeoDataGap[] {
  const gaps: CeoDataGap[] = [];

  if (!live.legalPublisherComplete) {
    gaps.push({
      id: 'legal_address',
      category: 'legal',
      severity: 'critical',
      question: 'Quelle est votre adresse professionnelle LCEN (domiciliation ou siège déclaré INSEE) ?',
      whyItMatters: 'Obligation légale + crédibilité sponsors/investisseurs.',
      suggestedField: 'company.professionalAddress ou LEGAL_PUBLISHER_ADDRESS',
    });
  }

  if (!founder) {
    gaps.push({
      id: 'founder_context_file',
      category: 'strategy',
      severity: 'critical',
      question:
        'Pouvez-vous créer msdev/ceo-founder-context.json (copie de ceo-founder-context.example.json) avec trésorerie, ville pivot et objectifs du trimestre ?',
      whyItMatters: 'Sans ce fichier, je pilote à l’aveugle sur burn, runway et priorités GTM.',
      suggestedField: 'msdev/ceo-founder-context.json',
    });
    return gaps;
  }

  const f = founder.financials ?? {};
  const s = founder.strategy ?? {};
  const g = founder.goToMarket ?? {};
  const c = founder.company ?? {};

  if (isEmpty(c.professionalAddress)) {
    gaps.push({
      id: 'pro_address',
      category: 'legal',
      severity: 'critical',
      question: 'Adresse pro éditeur (domiciliation) — laquelle figure sur votre SIRENE ?',
      whyItMatters: 'Mentions légales + due diligence sponsors.',
      suggestedField: 'company.professionalAddress',
    });
  }
  if (isEmpty(f.cashOnHandEur)) {
    gaps.push({
      id: 'cash',
      category: 'financial',
      severity: 'critical',
      question: 'Trésorerie disponible pour Soundy aujourd’hui (€) ?',
      whyItMatters: 'Runway et tempo d’investissement (infra, marketing, legal).',
      suggestedField: 'financials.cashOnHandEur',
    });
  }
  if (isEmpty(f.monthlyBurnEur)) {
    gaps.push({
      id: 'burn',
      category: 'financial',
      severity: 'high',
      question: 'Burn rate mensuel actuel (infra + outils + marketing + legal, en €) ?',
      whyItMatters: 'Arbitrage croissance vs survie.',
      suggestedField: 'financials.monthlyBurnEur',
    });
  }
  if (isEmpty(f.revenueActualMrrEur) && live.totalUsers > 0) {
    gaps.push({
      id: 'mrr',
      category: 'financial',
      severity: 'high',
      question: 'Revenus récurrents mensuels actuels (sponsors signés + abos + tips nets plateforme, €) ?',
      whyItMatters: 'North star financière vs coûts fixes ~45 €/mois + variable streaming.',
      suggestedField: 'financials.revenueActualMrrEur',
    });
  }
  if (live.simulationDonations) {
    gaps.push({
      id: 'stripe_live',
      category: 'product',
      severity: 'high',
      question: 'Stripe Connect est-il activé en prod pour tips réels, ou toujours en simulation ?',
      whyItMatters: 'Monétisation créateurs = levier de rétention et preuve business.',
      suggestedField: 'founderNotes (statut Stripe)',
    });
  }
  if (isEmpty(s.primaryCity)) {
    gaps.push({
      id: 'primary_city',
      category: 'gtm',
      severity: 'high',
      question: 'Ville pivot GTM (une seule pour densifier l’effet réseau) ?',
      whyItMatters: 'Soundy gagne par densité locale, pas par lancement national dilué.',
      suggestedField: 'strategy.primaryCity',
    });
  }
  if (isEmpty(s.northStarMetric)) {
    gaps.push({
      id: 'north_star',
      category: 'strategy',
      severity: 'medium',
      question:
        'North star metric du trimestre (ex. salons actifs/semaine, lives >10 min, sponsors signés) ?',
      whyItMatters: 'Aligner toute l’équipe (même solo) sur une seule métrique.',
      suggestedField: 'strategy.northStarMetric + northStarCurrentValue',
    });
  }
  if (isEmpty(g.creatorPilotsActive)) {
    gaps.push({
      id: 'creators',
      category: 'gtm',
      severity: 'medium',
      question: 'Combien de créateurs pilotes actifs cette semaine (DJ, collectifs, bars) ?',
      whyItMatters: 'Objectif pitch : 30–50 pilotes ; sans ce chiffre je ne peux pas calibrer la roadmap.',
      suggestedField: 'goToMarket.creatorPilotsActive',
    });
  }
  if (isEmpty(g.founderSponsorsSigned)) {
    gaps.push({
      id: 'sponsors',
      category: 'gtm',
      severity: 'medium',
      question: 'Combien de contrats sponsors signés ou en négociation avancée ?',
      whyItMatters: '45–55 % du revenu cible M24 = sponsors natifs.',
      suggestedField: 'goToMarket.founderSponsorsSigned',
    });
  }
  if (isEmpty(founder.founderNotes)) {
    gaps.push({
      id: 'founder_notes',
      category: 'strategy',
      severity: 'medium',
      question:
        'Y a-t-il une contrainte ou opportunité non visible dans les données (partenariat, levée, deadline) ?',
      whyItMatters: 'Contexte humain que les dashboards ne capturent pas.',
      suggestedField: 'founderNotes',
    });
  }

  return gaps.sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[a.severity] - rank[b.severity];
  });
}
