import type { AiAgentDefinition, AiAgentId } from './types';

export const AI_AGENTS: AiAgentDefinition[] = [
  {
    id: 'ceo',
    name: 'CEO IA',
    description: 'Tang Yu — stratégie, finances, évolution entreprise, brief exécutif',
    emoji: '🎯',
    accentColor: '#9333ea',
  },
  {
    id: 'dev',
    name: 'Dev Agent',
    description: 'Staff engineer — plans d’implémentation, innovation, scale, dette technique',
    emoji: '⚙️',
    accentColor: '#2563eb',
  },
];

export function getAgentDefinition(id: AiAgentId): AiAgentDefinition | undefined {
  return AI_AGENTS.find((a) => a.id === id);
}

export function isValidAgentId(id: unknown): id is AiAgentId {
  return id === 'ceo' || id === 'dev';
}
