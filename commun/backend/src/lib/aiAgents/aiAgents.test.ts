import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AI_AGENTS, isValidAgentId } from './agents';
import { buildAiDataContext } from './dataContext';
import { getLlmConfig } from './llmClient';
import { getSystemPrompt } from './systemPrompts';

describe('aiAgents', () => {
  describe('isValidAgentId', () => {
    it('accepts ceo and dev', () => {
      expect(isValidAgentId('ceo')).toBe(true);
      expect(isValidAgentId('dev')).toBe(true);
      expect(isValidAgentId('other')).toBe(false);
    });
  });

  describe('AI_AGENTS', () => {
    it('defines ceo and dev agents', () => {
      expect(AI_AGENTS).toHaveLength(2);
      expect(AI_AGENTS.map((a) => a.id)).toEqual(['ceo', 'dev']);
    });
  });

  describe('getSystemPrompt', () => {
    it('includes CEO Tang Yu role', () => {
      const prompt = getSystemPrompt('ceo', '{"totalUsers":1}');
      expect(prompt).toContain('Tang Yu');
      expect(prompt).toContain('{"totalUsers":1}');
    });

    it('includes Dev Agent staff engineer role for dev', () => {
      const prompt = getSystemPrompt('dev', '{"totalUsers":1}');
      expect(prompt).toContain('Dev Agent OnScen');
      expect(prompt).toContain('force de proposition');
      expect(prompt).toContain('{"totalUsers":1}');
    });
  });

  describe('buildDevDataContext', () => {
    it('returns rich dev context with tech debt and innovation catalog', async () => {
      const { buildDevDataContext } = await import('./devDataContext');
      const ctx = await buildDevDataContext();
      const parsed = JSON.parse(ctx) as {
        technicalKnowledge: { innovationCatalog: unknown[] };
        techDebtSignals: unknown[];
        todoManualExcerpt: string | null;
      };
      expect(parsed.technicalKnowledge.innovationCatalog.length).toBeGreaterThan(3);
      expect(parsed.techDebtSignals.length).toBeGreaterThan(0);
      expect(parsed.todoManualExcerpt).toBeTruthy();
    });
  });

  describe('getDevTechnicalKnowledge', () => {
    it('includes architecture and proposal framework', async () => {
      const { getDevTechnicalKnowledge } = await import('./devTechnicalKnowledge');
      const k = getDevTechnicalKnowledge();
      expect(k.architecture.keyDomains.length).toBeGreaterThan(5);
      expect(k.innovationCatalog.length).toBeGreaterThan(5);
      expect(k.proposalFramework.alwaysInclude.length).toBeGreaterThan(3);
    });
  });

  describe('buildAiDataContext', () => {
    it('returns valid JSON with analytics snapshot', () => {
      const ctx = buildAiDataContext();
      const parsed = JSON.parse(ctx) as { analytics: { totalUsers: number } };
      expect(typeof parsed.analytics.totalUsers).toBe('number');
      expect(parsed.todoManualPriorities).toBeInstanceOf(Array);
    });
  });

  describe('getLlmConfig', () => {
    const env = process.env;

    beforeEach(() => {
      process.env = { ...env };
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      process.env.AI_AGENTS_ENABLED = '1';
    });

    afterEach(() => {
      process.env = env;
    });

    it('reports not configured without API keys', () => {
      const cfg = getLlmConfig();
      expect(cfg.configured).toBe(false);
      expect(cfg.provider).toBeNull();
    });

    it('prefers anthropic when key present', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      const cfg = getLlmConfig();
      expect(cfg.configured).toBe(true);
      expect(cfg.provider).toBe('anthropic');
      expect(cfg.model).toBe('claude-sonnet-4-6');
    });

    it('remaps retired anthropic model ids', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test';
      process.env.AI_AGENTS_MODEL = 'claude-sonnet-4-20250514';
      const cfg = getLlmConfig();
      expect(cfg.model).toBe('claude-sonnet-4-6');
    });
  });

  describe('llmPricing', () => {
    it('estimates sonnet cost from tokens', async () => {
      const { estimateLlmCostUsd, estimateLlmCostEur } = await import('./llmPricing');
      const usd = estimateLlmCostUsd('anthropic', 'claude-sonnet-4-6', 1000, 500);
      expect(usd).toBeGreaterThan(0);
      expect(estimateLlmCostEur('anthropic', 'claude-sonnet-4-6', 1000, 500)).toBeGreaterThan(0);
    });
  });

  describe('usageTracker', () => {
    it('accumulates monthly usage', async () => {
      const { recordAiUsage, getAiUsageTotals } = await import('./usageTracker');
      recordAiUsage('anthropic', 'claude-sonnet-4-6', 100, 50);
      const totals = getAiUsageTotals();
      expect(totals.requestCount).toBeGreaterThanOrEqual(1);
      expect(totals.costEur).toBeGreaterThan(0);
    });
  });

  describe('ceoFounderContext', () => {
    it('lists critical gaps when founder file missing', async () => {
      const { computeCeoDataGaps } = await import('./ceoFounderContext');
      const gaps = computeCeoDataGaps(null, {
        legalPublisherComplete: false,
        totalUsers: 10,
        simulationDonations: true,
      });
      expect(gaps.some((g) => g.id === 'founder_context_file')).toBe(true);
      expect(gaps.some((g) => g.severity === 'critical')).toBe(true);
    });
  });

  describe('ceoStrategicKnowledge', () => {
    it('includes AI team recruitment catalog', async () => {
      const { getCeoStrategicKnowledge } = await import('./ceoStrategicKnowledge');
      const k = getCeoStrategicKnowledge();
      expect(k.aiTeam.candidateAgents.length).toBeGreaterThan(3);
      expect(k.aiTeam.howToCreateNewAgent.length).toBeGreaterThan(0);
      expect(k.aiTeam.recruitmentPrinciples.length).toBeGreaterThan(2);
    });
  });

  describe('ceoAiTeamRecommendations', () => {
    it('scores sales high when no sponsors', async () => {
      const { computeAiTeamRecommendations } = await import('./ceoAiTeamRecommendations');
      const analysis = computeAiTeamRecommendations(
        {
          goToMarket: { founderSponsorsTarget: 2, founderSponsorsSigned: 0, creatorPilotsActive: 1 },
          financials: { sponsorPipelineEur: 0, revenueActualMrrEur: 0 },
        },
        {
          totalUsers: 50,
          activeSponsorCampaigns: 0,
          totalSponsors: 0,
          legalPublisherComplete: false,
          simulationDonations: true,
          creatorSubscriptionsActive: 0,
          pendingReports: 0,
          openSupportTickets: 0,
          activeLives: 0,
          totalSalons: 2,
          cloudflareCostEur: null,
          redisConfigured: true,
          dataGaps: [],
        }
      );
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      const sales = analysis.recommendations.find((r) => r.agentId === 'sales');
      expect(sales).toBeDefined();
      expect(sales!.urgencyScore).toBeGreaterThan(50);
      expect(sales!.whyNow.length).toBeGreaterThan(2);
      expect(sales!.costOfWaiting.length).toBeGreaterThan(1);
      expect(analysis.topRecommendation).toBeTruthy();
    });

    it('includes full reason fields on each recommendation', async () => {
      const { computeAiTeamRecommendations } = await import('./ceoAiTeamRecommendations');
      const analysis = computeAiTeamRecommendations(null, {
        totalUsers: 10,
        activeSponsorCampaigns: 0,
        totalSponsors: 0,
        legalPublisherComplete: false,
        simulationDonations: true,
        creatorSubscriptionsActive: 0,
        pendingReports: 0,
        openSupportTickets: 0,
        activeLives: 0,
        totalSalons: 0,
        cloudflareCostEur: null,
        redisConfigured: false,
        dataGaps: [],
      });
      for (const rec of analysis.recommendations) {
        expect(rec.whyCeoAloneIsInsufficient.length).toBeGreaterThan(1);
        expect(rec.whatYouGain.length).toBeGreaterThan(2);
        expect(rec.expectedDeliverables.length).toBeGreaterThan(2);
        expect(rec.firstWeekActions.length).toBeGreaterThan(2);
      }
    });
  });
});
