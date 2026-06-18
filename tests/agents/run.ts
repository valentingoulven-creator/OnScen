/**
 * run.ts — Point d'entrée de l'infrastructure de test agents Soundy
 *
 * CE FICHIER N'EXÉCUTE PAS LES TESTS AUTOMATIQUEMENT.
 * Il doit être lancé explicitement avec : npm run test:agents
 *
 * Usage :
 *   npm run test:agents                    # localhost:3000, 24h
 *   npm run test:agents:prod               # getsoundy.com, 24h
 *   npm run test:agents:quick              # localhost:3000, 5 min
 *   TARGET_URL=https://... DURATION_MS=3600000 npm run test:agents
 *
 * Options (variables d'environnement) :
 *   TARGET_URL      URL cible (défaut: http://localhost:3000)
 *   DURATION_MS     Durée en ms (défaut: 86400000 = 24h)
 *   LOG_LEVEL       Niveau: debug | info | warn | error (défaut: info)
 *   AGENT_IDS       IDs d'agents à lancer, ex: "1,2,3" (défaut: tous)
 *   REPORT_DIR      Dossier des rapports (défaut: ./reports)
 *
 * NE PAS MODIFIER les appels automatiques — ce fichier doit rester passif.
 */

import { Orchestrator } from './orchestrator';
import { CONFIG } from './agents.config';

// ── Validation de la configuration ────────────────────────────────────────────

function parseAgentIds(): number[] | undefined {
  const raw = process.env.AGENT_IDS;
  if (!raw) return undefined;
  const ids = raw.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 30);
  return ids.length > 0 ? ids : undefined;
}

function validateConfig(): void {
  const url = CONFIG.BASE_URL;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error(`\x1b[31m❌ TARGET_URL invalide: "${url}" — doit commencer par http:// ou https://\x1b[0m`);
    process.exit(1);
  }

  if (CONFIG.DURATION_MS < 60_000) {
    console.warn(`\x1b[33m⚠️  DURATION_MS très court (${CONFIG.DURATION_MS}ms) — minimum recommandé: 60000ms\x1b[0m`);
  }

  if (CONFIG.DURATION_MS > 48 * 60 * 60 * 1000) {
    console.warn(`\x1b[33m⚠️  DURATION_MS > 48h — durée inhabituellement longue\x1b[0m`);
  }
}

// ── Avertissement prod ─────────────────────────────────────────────────────────

function warnIfProduction(): Promise<void> {
  if (!CONFIG.BASE_URL.includes('getsoundy.com') && !CONFIG.BASE_URL.includes('soundy.com')) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    console.log(`
\x1b[31m╔══════════════════════════════════════════════════════════════╗
║  ⚠️  ATTENTION — CIBLE DE PRODUCTION DÉTECTÉE                 ║
║                                                              ║
║  URL: ${CONFIG.BASE_URL.padEnd(52)} ║
║                                                              ║
║  Les tests vont créer de VRAIS comptes et générer du         ║
║  trafic réel sur la production.                              ║
║                                                              ║
║  Appuyer sur ENTRÉE pour continuer, CTRL+C pour annuler      ║
╚══════════════════════════════════════════════════════════════╝\x1b[0m
`);

    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', () => {
      resolve();
    });
    process.stdin.resume();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Validation
  validateConfig();

  // Avertissement si prod
  await warnIfProduction();

  const agentIds = parseAgentIds();

  console.log(`\x1b[36m\n  Initialisation de l'orchestrateur...\x1b[0m`);

  const orchestrator = new Orchestrator({
    durationMs: CONFIG.DURATION_MS,
    baseUrl: CONFIG.BASE_URL,
    agentIds,
  });

  try {
    await orchestrator.start();
  } catch (err) {
    console.error('\x1b[31m[FATAL] Erreur orchestrateur:', err, '\x1b[0m');
    process.exit(1);
  }

  console.log('\n\x1b[32m✅ Infrastructure de test terminée avec succès.\x1b[0m\n');
  process.exit(0);
}

// Lancement uniquement quand exécuté directement (pas en import)
// ⚠️ Ce bloc ne s'exécute PAS automatiquement lors des tests unitaires
if (require.main === module) {
  main().catch((err) => {
    console.error('\x1b[31m[FATAL] Erreur non gérée:', err, '\x1b[0m');
    process.exit(1);
  });
}

export { main };
