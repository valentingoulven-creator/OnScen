import type { LlmProvider } from './llmClient';

/** USD per 1M tokens — indicatif, voir console.anthropic.com/settings/plans */
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

function resolveRates(provider: LlmProvider, model: string): { input: number; output: number } {
  const key = Object.keys(PRICING_USD_PER_MTOK).find((k) => model.includes(k));
  if (key) return PRICING_USD_PER_MTOK[key];
  return provider === 'anthropic' ? PRICING_USD_PER_MTOK['claude-sonnet-4'] : PRICING_USD_PER_MTOK['gpt-4o-mini'];
}

export function usdToEurRate(): number {
  const raw = process.env.AI_AGENTS_USD_TO_EUR?.trim();
  const n = raw ? Number(raw) : 0.92;
  return Number.isFinite(n) && n > 0 ? n : 0.92;
}

export function estimateLlmCostUsd(
  provider: LlmProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = resolveRates(provider, model);
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

export function estimateLlmCostEur(
  provider: LlmProvider,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const usd = estimateLlmCostUsd(provider, model, inputTokens, outputTokens);
  return Math.round(usd * usdToEurRate() * 10_000) / 10_000;
}
