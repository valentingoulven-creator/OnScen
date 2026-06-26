import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateJWT } from '../middleware/auth';
import { db } from '../models/schema';
import { isAccessAdmin } from '../lib/accessControl';
import { AI_AGENTS, getAgentDefinition, isValidAgentId } from '../lib/aiAgents/agents';
import { buildCeoContextMeta, buildCeoDataContext } from '../lib/aiAgents/ceoDataContext';
import { buildDevDataContext } from '../lib/aiAgents/devDataContext';
import { completeChat, getLlmConfig } from '../lib/aiAgents/llmClient';
import { estimateLlmCostEur, estimateLlmCostUsd } from '../lib/aiAgents/llmPricing';
import { getAiUsageTotals, recordAiUsage } from '../lib/aiAgents/usageTracker';
import { getSystemPrompt } from '../lib/aiAgents/systemPrompts';
import type { AiChatMessage, AiChatRequest } from '../lib/aiAgents/types';

export const adminAiAgentsRouter = Router();

const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages — réessayez dans une minute.' },
});

function requireAdmin(req: Request, res: Response): boolean {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentification requise' });
    return false;
  }
  const user = db.users.get(userId);
  if (!user || !isAccessAdmin(user)) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return false;
  }
  return true;
}

function parseMessages(body: unknown): AiChatMessage[] | null {
  if (!body || typeof body !== 'object') return null;
  const messages = (body as AiChatRequest).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const parsed: AiChatMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return null;
    const role = (m as AiChatMessage).role;
    const content = (m as AiChatMessage).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const trimmed = content.trim();
    if (!trimmed) return null;
    parsed.push({ role, content: trimmed });
  }
  if (parsed[parsed.length - 1]?.role !== 'user') return null;
  return parsed;
}

/** GET /api/admin/ai-agents — statut + liste agents */
adminAiAgentsRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const config = getLlmConfig();
  res.json({
    enabled: config.enabled,
    configured: config.configured,
    provider: config.provider,
    model: config.model,
    agents: AI_AGENTS,
    usage: getAiUsageTotals(),
    ceo: buildCeoContextMeta(),
  });
});

/** POST /api/admin/ai-agents/:agentId/chat — envoyer un message */
adminAiAgentsRouter.post(
  '/:agentId/chat',
  authenticateJWT,
  chatLimiter,
  async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const agentId = req.params.agentId;
    if (!isValidAgentId(agentId) || !getAgentDefinition(agentId)) {
      res.status(400).json({ error: 'Agent inconnu' });
      return;
    }

    const messages = parseMessages(req.body);
    if (!messages) {
      res.status(400).json({ error: 'Corps invalide — messages[] requis, dernier message = user' });
      return;
    }

    try {
      const dataContext =
        agentId === 'ceo' ? await buildCeoDataContext() : await buildDevDataContext();
      const system = getSystemPrompt(agentId, dataContext);
      const result = await completeChat(system, messages);
      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;
      const provider = getLlmConfig().provider!;
      const costUsd = estimateLlmCostUsd(provider, result.model, inputTokens, outputTokens);
      const costEur = estimateLlmCostEur(provider, result.model, inputTokens, outputTokens);
      const monthUsage = recordAiUsage(provider, result.model, inputTokens, outputTokens);

      res.json({
        agentId,
        message: { role: 'assistant' as const, content: result.content },
        model: result.model,
        usage: result.usage,
        cost: { inputTokens, outputTokens, costUsd, costEur },
        monthUsage,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur agent IA';
      const status = msg.includes('manquante') || msg.includes('manquant') || msg.includes('désactivés') ? 503 : 502;
      res.status(status).json({ error: msg });
    }
  }
);
