export type AiAgentId = 'ceo' | 'dev';

export type AiChatRole = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiAgentDefinition {
  id: AiAgentId;
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
}

export interface AiAgentsStatus {
  enabled: boolean;
  configured: boolean;
  provider: 'anthropic' | 'openai' | null;
  model: string | null;
  agents: AiAgentDefinition[];
  usage?: AiUsageTotals;
}

export interface AiUsageTotals {
  month: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
  requestCount: number;
  usdToEurRate?: number;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
}

export interface AiChatUsageCost {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
}

export interface AiChatResponse {
  agentId: AiAgentId;
  message: AiChatMessage;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  cost?: AiChatUsageCost;
  monthUsage?: AiUsageTotals;
}
