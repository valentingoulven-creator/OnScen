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
    it('includes data context and agent role', () => {
      const prompt = getSystemPrompt('ceo', '{"totalUsers":1}');
      expect(prompt).toContain('CEO IA');
      expect(prompt).toContain('{"totalUsers":1}');
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
});
