import type { AiChatMessage } from './types';

export type LlmProvider = 'anthropic' | 'openai';

export interface LlmConfig {
  enabled: boolean;
  configured: boolean;
  provider: LlmProvider | null;
  model: string | null;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8000;

/** Modèles retirés par Anthropic (ex. 2026-06-15) → remplacement recommandé. */
const RETIRED_ANTHROPIC_MODEL_ALIASES: Record<string, string> = {
  'claude-sonnet-4-20250514': 'claude-sonnet-4-6',
  'claude-sonnet-4-0': 'claude-sonnet-4-6',
  'claude-opus-4-20250514': 'claude-opus-4-8',
  'claude-opus-4-0': 'claude-opus-4-8',
};

function normalizeAnthropicModel(model: string): string {
  return RETIRED_ANTHROPIC_MODEL_ALIASES[model] ?? model;
}

function resolveProvider(): LlmProvider | null {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  const forced = process.env.AI_AGENTS_PROVIDER?.trim().toLowerCase();
  if (forced === 'anthropic' && process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (forced === 'openai' && process.env.OPENAI_API_KEY?.trim()) return 'openai';
  return null;
}

function resolveModel(provider: LlmProvider): string {
  const custom = process.env.AI_AGENTS_MODEL?.trim();
  if (custom) {
    return provider === 'anthropic' ? normalizeAnthropicModel(custom) : custom;
  }
  return provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini';
}

export function getLlmConfig(): LlmConfig {
  const enabled = process.env.AI_AGENTS_ENABLED !== '0';
  const provider = resolveProvider();
  return {
    enabled,
    configured: Boolean(provider),
    provider,
    model: provider ? resolveModel(provider) : null,
  };
}

function trimMessages(messages: AiChatMessage[]): AiChatMessage[] {
  const sliced = messages.slice(-MAX_HISTORY);
  return sliced.map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_CHARS),
  }));
}

async function callAnthropic(
  system: string,
  messages: AiChatMessage[],
  model: string
): Promise<LlmCompletionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Anthropic API ${res.status}`);
  }

  const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
  if (!text) throw new Error('Réponse Anthropic vide');

  return {
    content: text,
    model,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callOpenAi(
  system: string,
  messages: AiChatMessage[],
  model: string
): Promise<LlmCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY manquant');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI API ${res.status}`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Réponse OpenAI vide');

  return {
    content: text,
    model,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function completeChat(
  system: string,
  messages: AiChatMessage[]
): Promise<LlmCompletionResult> {
  const config = getLlmConfig();
  if (!config.enabled) {
    throw new Error('Agents IA désactivés (AI_AGENTS_ENABLED=0)');
  }
  if (!config.provider || !config.model) {
    throw new Error('Clé API manquante — définir ANTHROPIC_API_KEY ou OPENAI_API_KEY');
  }

  const trimmed = trimMessages(messages);
  if (trimmed.length === 0) {
    throw new Error('Historique de conversation vide');
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(system, trimmed, config.model);
  }
  return callOpenAi(system, trimmed, config.model);
}
