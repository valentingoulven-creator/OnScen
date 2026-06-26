import type { LlmProvider } from './llmClient';
import { estimateLlmCostEur, estimateLlmCostUsd, usdToEurRate } from './llmPricing';

export interface AiUsageTotals {
  month: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
  requestCount: number;
  usdToEurRate: number;
}

const buckets = new Map<string, AiUsageTotals>();

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function emptyTotals(month: string): AiUsageTotals {
  const rate = usdToEurRate();
  return { month, inputTokens: 0, outputTokens: 0, costUsd: 0, costEur: 0, requestCount: 0, usdToEurRate: rate };
}

export function recordAiUsage(
  provider: LlmProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): AiUsageTotals {
  const month = monthKey();
  const rate = usdToEurRate();
  const prev = buckets.get(month) ?? emptyTotals(month);
  const deltaUsd = estimateLlmCostUsd(provider, model, inputTokens, outputTokens);
  const deltaEur = estimateLlmCostEur(provider, model, inputTokens, outputTokens);
  const next: AiUsageTotals = {
    month,
    inputTokens: prev.inputTokens + inputTokens,
    outputTokens: prev.outputTokens + outputTokens,
    costUsd: Math.round((prev.costUsd + deltaUsd) * 1_000_000) / 1_000_000,
    costEur: Math.round((prev.costEur + deltaEur) * 10_000) / 10_000,
    requestCount: prev.requestCount + 1,
    usdToEurRate: rate,
  };
  buckets.set(month, next);
  return next;
}

export function getAiUsageTotals(): AiUsageTotals {
  const month = monthKey();
  return buckets.get(month) ?? emptyTotals(month);
}
